// 出入库流水路由: 录单(生成流水) + 台账查询 + Excel 导出
// 核心铁则: 入库/出库只往 flows 表写流水, 库存由 累计入库-累计出库 实时推导
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const pool = require('../config/db');
const { auth, requireAdmin } = require('../middleware/auth');
const { nextFlowNo } = require('../utils/flowNo');
const { logAction } = require('../utils/audit');
const { parsePage } = require('../utils/paginate');

const router = express.Router();

// 内存存储文件, 限制5MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Excel 日期序号(1899-12-30 基准)转 Date; 兼容 8位数字日期(20260729)与文本日期
function excelDateToJS(v) {
  if (typeof v === 'number') {
    // 8位数字如 20260729 视为 YYYYMMDD
    if (v >= 19000101 && v <= 21001231) {
      const s = String(v);
      return new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)));
    }
    return new Date(Math.round((v - 25569) * 86400 * 1000));
  }
  const s = String(v || '').trim();
  if (!s) return null;
  const d = new Date(s.replace(/\//g, '-')); // 兼容 2026/8/8
  return isNaN(d.getTime()) ? null : d;
}

function fmtDateTime(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// 查询某物料当前库存 = 累计入库 - 累计出库 (事务内调用; 作废流水不计)
async function queryStock(conn, materialId) {
  const [rows] = await conn.query(
    `SELECT
       COALESCE(SUM(CASE WHEN f.type='IN' AND f.status=1 THEN f.quantity ELSE 0 END),0) AS total_in,
       COALESCE(SUM(CASE WHEN f.type='OUT' AND f.status=1 THEN f.quantity ELSE 0 END),0) AS total_out
     FROM flows f WHERE f.material_id = ?`,
    [materialId]
  );
  return rows[0].total_in - rows[0].total_out;
}

// 通用: 写入一条流水(事务内), 返回 flowNo; createdAt/direction/category 可选
async function insertFlow(conn, { materialId, type, quantity, counterparty, purpose, operatorId, createdAt, direction, category }) {
  const flowNo = await nextFlowNo(conn, type);
  const cols = ['flow_no', 'material_id', 'type', 'quantity', 'counterparty', 'purpose', 'operator_id'];
  const vals = [flowNo, materialId, type, quantity, counterparty, purpose, operatorId];
  if (createdAt) { cols.push('created_at'); vals.push(createdAt); }
  if (direction) { cols.push('direction'); vals.push(direction); }
  if (category) { cols.push('category'); vals.push(category); }
  await conn.query(
    `INSERT INTO flows (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, vals
  );
  return flowNo;
}

// 归一化录单参数: 支持批量 items 数组, 兼容旧的单物料 material_id 方式
function normalizeItems(body) {
  if (Array.isArray(body.items) && body.items.length) return body.items;
  if (body.material_id) return [{ material_id: body.material_id, quantity: body.quantity }];
  return [];
}

// POST /api/flows/in  入库单 -> 批量生成入库流水
router.post('/in', auth, async (req, res) => {
  const body = req.body || {};
  const list = normalizeItems(body);
  const supplier = body.supplier ?? '';
  const remark = body.remark ?? '';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const flowNos = [];
    for (const it of list) {
      const qty = Number(it.quantity);
      if (!it.material_id || !qty || qty <= 0) {
        await conn.rollback();
        return res.json({ code: 400, msg: '请选择物料并填写大于0的数量' });
      }
      const [mats] = await conn.query('SELECT id FROM materials WHERE id = ? AND status = 1', [it.material_id]);
      if (mats.length === 0) {
        await conn.rollback();
        return res.json({ code: 400, msg: '存在已停用或不存在的物料' });
      }
      const flowNo = await insertFlow(conn, {
        materialId: it.material_id, type: 'IN', quantity: qty,
        counterparty: supplier, purpose: remark, operatorId: req.user.id,
      });
      flowNos.push(flowNo);
    }
    if (flowNos.length === 0) { await conn.rollback(); return res.json({ code: 400, msg: '请至少选择一种物料' }); }
    await conn.commit();
    await logAction(req, 'inbound', `入库 ${flowNos.length} 笔, 供应商:${supplier}`);
    res.json({ code: 200, msg: `入库成功 ${flowNos.length} 笔`, data: { flow_nos: flowNos } });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') return res.json({ code: 400, msg: '流水号冲突，请重试' });
    console.error('入库失败:', e.message);
    res.json({ code: 500, msg: '服务器异常' });
  } finally {
    conn.release();
  }
});

// POST /api/flows/out  出库单 -> 逐物料校验库存后批量生成出库流水
router.post('/out', auth, async (req, res) => {
  const body = req.body || {};
  const list = normalizeItems(body);
  const receiver = body.receiver ?? '';
  const purpose = body.purpose ?? '';
  const direction = body.direction ?? '';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const flowNos = [];
    const seen = new Set();
    for (const it of list) {
      const qty = Number(it.quantity);
      if (!it.material_id || !qty || qty <= 0) {
        await conn.rollback();
        return res.json({ code: 400, msg: '请选择物料并填写大于0的数量' });
      }
      if (seen.has(it.material_id)) {
        await conn.rollback();
        return res.json({ code: 400, msg: '同一物料不能重复选择' });
      }
      seen.add(it.material_id);
      const [mats] = await conn.query('SELECT id FROM materials WHERE id = ? AND status = 1', [it.material_id]);
      if (mats.length === 0) {
        await conn.rollback();
        return res.json({ code: 400, msg: '存在已停用或不存在的物料' });
      }
      const stock = await queryStock(conn, it.material_id);
      if (qty > stock) {
        await conn.rollback();
        return res.json({ code: 400, msg: `库存不足：当前库存 ${stock}，本次出库 ${qty}` });
      }
      const flowNo = await insertFlow(conn, {
        materialId: it.material_id, type: 'OUT', quantity: qty,
        counterparty: receiver, purpose, operatorId: req.user.id, direction,
      });
      flowNos.push(flowNo);
    }
    if (flowNos.length === 0) { await conn.rollback(); return res.json({ code: 400, msg: '请至少选择一种物料' }); }
    await conn.commit();
    await logAction(req, 'outbound', `出库 ${flowNos.length} 笔, 领用人:${receiver}`);
    res.json({ code: 200, msg: `出库成功 ${flowNos.length} 笔`, data: { flow_nos: flowNos } });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') return res.json({ code: 400, msg: '流水号冲突，请重试' });
    console.error('出库失败:', e.message);
    res.json({ code: 500, msg: '服务器异常' });
  } finally {
    conn.release();
  }
});

// POST /api/flows/in-return  入库退货: 把之前入库的货退回供应商 -> 减少库存(OUT), 类别标记入库退货
router.post('/in-return', auth, async (req, res) => {
  const body = req.body || {};
  const list = normalizeItems(body);
  const supplier = body.supplier ?? '';
  const remark = body.remark ?? '';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const flowNos = [];
    const seen = new Set();
    for (const it of list) {
      const qty = Number(it.quantity);
      if (!it.material_id || !qty || qty <= 0) { await conn.rollback(); return res.json({ code: 400, msg: '请选择物料并填写大于0的数量' }); }
      if (seen.has(it.material_id)) { await conn.rollback(); return res.json({ code: 400, msg: '同一物料不能重复选择' }); }
      seen.add(it.material_id);
      const [mats] = await conn.query('SELECT id FROM materials WHERE id = ? AND status = 1', [it.material_id]);
      if (mats.length === 0) { await conn.rollback(); return res.json({ code: 400, msg: '存在已停用或不存在的物料' }); }
      const stock = await queryStock(conn, it.material_id);
      if (qty > stock) { await conn.rollback(); return res.json({ code: 400, msg: `库存不足：当前库存 ${stock}，退货 ${qty}` }); }
      const flowNo = await insertFlow(conn, {
        materialId: it.material_id, type: 'OUT', quantity: qty,
        counterparty: supplier, purpose: `[入库退货] ${remark}`.trim(), operatorId: req.user.id, category: 'in_return',
      });
      flowNos.push(flowNo);
    }
    if (flowNos.length === 0) { await conn.rollback(); return res.json({ code: 400, msg: '请至少选择一种物料' }); }
    await conn.commit();
    await logAction(req, 'in_return', `入库退货 ${flowNos.length} 笔, 供应商:${supplier}`);
    res.json({ code: 200, msg: `退货成功 ${flowNos.length} 笔`, data: { flow_nos: flowNos } });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') return res.json({ code: 400, msg: '流水号冲突，请重试' });
    console.error('入库退货失败:', e.message);
    res.json({ code: 500, msg: '服务器异常' });
  } finally {
    conn.release();
  }
});

// POST /api/flows/out-return  出库退货: 客户退回 -> 增加库存(IN), 类别标记出库退货
router.post('/out-return', auth, async (req, res) => {
  const body = req.body || {};
  const list = normalizeItems(body);
  const customer = body.customer ?? '';
  const remark = body.remark ?? '';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const flowNos = [];
    for (const it of list) {
      const qty = Number(it.quantity);
      if (!it.material_id || !qty || qty <= 0) { await conn.rollback(); return res.json({ code: 400, msg: '请选择物料并填写大于0的数量' }); }
      const [mats] = await conn.query('SELECT id FROM materials WHERE id = ? AND status = 1', [it.material_id]);
      if (mats.length === 0) { await conn.rollback(); return res.json({ code: 400, msg: '存在已停用或不存在的物料' }); }
      const flowNo = await insertFlow(conn, {
        materialId: it.material_id, type: 'IN', quantity: qty,
        counterparty: customer, purpose: `[出库退货] ${remark}`.trim(), operatorId: req.user.id, category: 'out_return',
      });
      flowNos.push(flowNo);
    }
    if (flowNos.length === 0) { await conn.rollback(); return res.json({ code: 400, msg: '请至少选择一种物料' }); }
    await conn.commit();
    await logAction(req, 'out_return', `出库退货 ${flowNos.length} 笔, 客户:${customer}`);
    res.json({ code: 200, msg: `退货成功 ${flowNos.length} 笔`, data: { flow_nos: flowNos } });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') return res.json({ code: 400, msg: '流水号冲突，请重试' });
    console.error('出库退货失败:', e.message);
    res.json({ code: 500, msg: '服务器异常' });
  } finally {
    conn.release();
  }
});

// POST /api/flows/out-product  按成品出库: 根据BOM配方自动扣减各配件库存
// body: { product_id, quantity, direction, receiver, purpose }
router.post('/out-product', auth, async (req, res) => {
  const { product_id, quantity, direction = '', receiver = '', purpose = '' } = req.body || {};
  const qty = Number(quantity);
  if (!product_id || !qty || qty <= 0) return res.json({ code: 400, msg: '请选择成品并填写大于0的生产数量' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [prods] = await conn.query('SELECT id, code, name FROM products WHERE id = ? AND status = 1', [product_id]);
    if (!prods.length) { await conn.rollback(); return res.json({ code: 400, msg: '成品不存在或已停用' }); }
    const prod = prods[0];

    const [boms] = await conn.query(
      `SELECT b.material_id, b.qty_per, m.name AS material_name, m.code AS material_code
       FROM bom b JOIN materials m ON m.id = b.material_id
       WHERE b.product_id = ? ORDER BY b.id`,
      [product_id]
    );
    if (!boms.length) { await conn.rollback(); return res.json({ code: 400, msg: `成品 ${prod.name} 未配置配方，请先在"产品配方"中添加配件` }); }

    const flowNos = [];
    const detail = [];
    for (const b of boms) {
      const need = Number(b.qty_per) * qty;
      const stock = await queryStock(conn, b.material_id);
      if (need > stock) {
        await conn.rollback();
        return res.json({ code: 400, msg: `配件库存不足：${b.material_code} ${b.material_name} 需出库 ${need}，当前库存 ${stock}` });
      }
      const p = `[产品出库]${prod.name} ${purpose}`.replace(/\s+/g, ' ').trim();
      const flowNo = await insertFlow(conn, {
        materialId: b.material_id, type: 'OUT', quantity: need,
        counterparty: receiver, purpose: p, operatorId: req.user.id, direction,
      });
      flowNos.push(flowNo);
      detail.push({ material_code: b.material_code, material_name: b.material_name, quantity: need });
    }
    await conn.commit();
    await logAction(req, 'out_product', `成品 ${prod.name} 出库 ${qty} 台, 扣减配件 ${detail.length} 种`);
    res.json({ code: 200, msg: `成品 ${prod.name} 出库成功，${detail.length} 种配件已扣减`, data: { flow_nos: flowNos, detail } });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') return res.json({ code: 400, msg: '流水号冲突，请重试' });
    console.error('成品出库失败:', e.message);
    res.json({ code: 500, msg: '服务器异常' });
  } finally {
    conn.release();
  }
});

// POST /api/flows/in-product  按成品入库: 根据BOM配方自动增加各配件库存
router.post('/in-product', auth, async (req, res) => {
  const { product_id, quantity, supplier = '', remark = '' } = req.body || {};
  const qty = Number(quantity);
  if (!product_id || !qty || qty <= 0) return res.json({ code: 400, msg: '请选择成品并填写大于0的数量' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [prods] = await conn.query('SELECT id, code, name FROM products WHERE id = ? AND status = 1', [product_id]);
    if (!prods.length) { await conn.rollback(); return res.json({ code: 400, msg: '成品不存在或已停用' }); }
    const prod = prods[0];
    const [boms] = await conn.query('SELECT material_id, qty_per FROM bom WHERE product_id = ?', [product_id]);
    if (!boms.length) { await conn.rollback(); return res.json({ code: 400, msg: `成品 ${prod.name} 未配置配方` }); }

    const flowNos = [];
    for (const b of boms) {
      const need = Number(b.qty_per) * qty;
      const flowNo = await insertFlow(conn, {
        materialId: b.material_id, type: 'IN', quantity: need,
        counterparty: supplier, purpose: `[产品入库]${prod.name} ${remark}`.replace(/\s+/g, ' ').trim(), operatorId: req.user.id,
      });
      flowNos.push(flowNo);
    }
    await conn.commit();
    await logAction(req, 'in_product', `成品 ${prod.name} 入库 ${qty} 台, 配件 ${boms.length} 种`);
    res.json({ code: 200, msg: `成品 ${prod.name} 入库成功，${boms.length} 种配件已增加`, data: { flow_nos: flowNos } });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') return res.json({ code: 400, msg: '流水号冲突，请重试' });
    console.error('成品入库失败:', e.message);
    res.json({ code: 500, msg: '服务器异常' });
  } finally {
    conn.release();
  }
});

// POST /api/flows/:id/void  作废流水(红冲, 作废后不计入库存)
router.post('/:id/void', auth, requireAdmin, async (req, res) => {
  const { reason = '' } = req.body || {};
  try {
    const [r] = await pool.query('UPDATE flows SET status=0, void_by=?, void_at=NOW(), void_reason=? WHERE id=? AND status=1', [req.user.id, reason, req.params.id]);
    if (r.affectedRows === 0) return res.json({ code: 400, msg: '流水不存在或已作废' });
    await logAction(req, 'void_flow', `作废流水#${req.params.id} 原因:${reason}`);
    res.json({ code: 200, msg: '已作废，该流水不再计入库存' });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// POST /api/flows/import-in  入库单 Excel 批量导入(仅管理员)
// 支持: 前端客户端解析后提交 JSON {rows:[{date,product,name,spec,unit,qty,remark}]} 或 上传Excel文件
// 物料按 名称+规格+单位 匹配, 不存在则报错提示先建档
router.post('/import-in', auth, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    let rows;
    if (Array.isArray(req.body?.rows)) {
      rows = req.body.rows; // 前端已解析
    } else if (req.file) {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (arr.length < 2) return res.json({ code: 400, msg: 'Excel内容为空' });
      const header = arr[0].map((h) => String(h || '').trim());
      const ci = {
        date: header.indexOf('日期'),
        name: header.indexOf('货物名称'),
        spec: header.indexOf('规格及材质') > -1 ? header.indexOf('规格及材质') : header.indexOf('规格材质'),
        unit: header.indexOf('单位'),
        qty: header.indexOf('数量'),
        remark: header.indexOf('备注'),
      };
      ci.product = header.indexOf('成品') > -1 ? header.indexOf('成品') : (ci.date > -1 ? ci.date + 1 : -1);
      if (ci.name < 0 || ci.qty < 0) return res.json({ code: 400, msg: '未识别到货物名称/数量列，请使用标准模板' });
      rows = [];
      for (let i = 1; i < arr.length; i++) {
        const r = arr[i];
        const name = String(r[ci.name] || '').trim();
        const qty = Number(r[ci.qty]);
        if (!name && !qty) continue;
        rows.push({
          date: r[ci.date], product: ci.product > -1 ? String(r[ci.product] || '').trim() : '',
          name, spec: String(r[ci.spec] || '').trim(), unit: String(r[ci.unit] || '').trim(), qty, remark: String(r[ci.remark] || '').trim(),
        });
      }
    } else {
      return res.json({ code: 400, msg: '请选择Excel文件' });
    }
    if (!rows.length) return res.json({ code: 400, msg: 'Excel内容为空' });

    const results = { total: 0, success: 0, errors: [] };
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      let rowNo = 1;
      for (const r of rows) {
        rowNo++;
        const name = String(r.name || r['货物名称'] || '').trim().replace(/\s+/g, ''); // 去空格合并同名物料
        const qty = Number(r.qty ?? r['数量']);
        if (!name && !qty) continue; // 跳过空行
        if (!name || !qty || qty <= 0) { results.errors.push(`第${rowNo}行: 货物名称或数量无效`); continue; }
        results.total++;

        const spec = String(r.spec ?? r['规格及材质'] ?? r['规格材质'] ?? '').trim();
        const unit = String(r.unit ?? r['单位'] ?? '').trim();
        const remark = String(r.remark ?? r['备注'] ?? '').trim();
        const product = String(r.product ?? r['成品'] ?? '').trim();
        // 日期范围校验: 异常序号/文本导致的超范围日期按当前时间处理
        const date = excelDateToJS(r.date ?? r['日期']);
        const y = date ? date.getFullYear() : 0;
        const createdAt = date && y >= 2000 && y <= 2100 ? fmtDateTime(date) : null;

        // 按 名称+规格+单位 匹配物料
        const [mats] = await conn.query(
          'SELECT id FROM materials WHERE name=? AND IFNULL(spec,"")=? AND IFNULL(unit,"")=? AND status=1 LIMIT 1',
          [name, spec, unit]
        );
        let materialId = mats.length ? mats[0].id : null;
        if (!materialId) {
          // 编码/大类由用户维护, 未建档物料不再自动建档, 提示先建档案
          results.errors.push(`第${rowNo}行: 物料「${name}」不存在，请先在「物料档案」建档后再导入`);
          continue;
        }

        const purpose = product ? `[成品:${product}] ${remark}`.trim() : remark;
        try {
          await insertFlow(conn, { materialId, type: 'IN', quantity: qty, counterparty: '', purpose, operatorId: req.user.id, createdAt });
          results.success++;
        } catch (e) {
          results.errors.push(`第${rowNo}行: 生成流水失败(${e.message})`);
        }
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    await logAction(req, 'inbound', `Excel导入入库 ${results.success} 条, 失败 ${results.errors.length} 条`);
    res.json({ code: 200, msg: `入库导入完成：成功 ${results.success} 条，失败 ${results.errors.length} 条`, data: results });
  } catch (e) {
    console.error('导入入库失败:', e.message);
    res.json({ code: 500, msg: '导入失败，请检查文件格式' });
  }
});

// 校验日期字符串是否为合法 YYYY-MM-DD, 防止空串/字母/非法日期拼入SQL导致MySQL报错
function isValidDate(s) {
  if (typeof s !== 'string') return false;
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

// 拼装台账查询条件
function buildWhere(q) {
  const where = ['1=1'];
  const params = [];
  if (q.type) { where.push('f.type = ?'); params.push(q.type); }
  if (q.category) { where.push('f.category = ?'); params.push(q.category); }
  if (q.material_id) { where.push('f.material_id = ?'); params.push(q.material_id); }
  if (q.start_date && isValidDate(q.start_date)) { where.push('f.created_at >= ?'); params.push(`${q.start_date} 00:00:00`); }
  if (q.end_date && isValidDate(q.end_date)) { where.push('f.created_at <= ?'); params.push(`${q.end_date} 23:59:59`); }
  return { whereSql: 'WHERE ' + where.join(' AND '), params };
}

// GET /api/flows  流水台账分页查询(支持 物料/时间段/类型 筛选)
router.get('/', auth, async (req, res) => {
  const { whereSql, params } = buildWhere(req.query);
  const { pageSize: limit, offset } = parsePage(req.query);

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM flows f ${whereSql}`, params);
    const [list] = await pool.query(
      `SELECT f.id, f.flow_no, f.type, f.category, f.quantity, f.counterparty, f.purpose, f.created_at,
              f.status, f.direction, f.void_reason, f.void_at,
              m.code AS material_code,
              CONCAT(m.name, IF(m.spec IS NOT NULL AND m.spec <> '', CONCAT(' (', m.spec, ')'), '')) AS material_name,
              m.unit AS material_unit,
              u.real_name AS operator_name
       FROM flows f
       JOIN materials m ON m.id = f.material_id
       LEFT JOIN users u ON u.id = f.operator_id
       ${whereSql}
       ORDER BY f.created_at DESC, f.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ code: 200, data: { list, total, page: parsePage(req.query).page, pageSize: limit } });
  } catch (e) {
    console.error('查询流水失败:', e.message);
    res.json({ code: 500, msg: '服务器异常' });
  }
});

module.exports = router;
