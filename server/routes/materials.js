// 物料档案路由: 查询任意登录用户可看, 写操作仅管理员
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const pool = require('../config/db');
const { auth, requireAdmin } = require('../middleware/auth');
const { logAction } = require('../utils/audit');
const { parsePage } = require('../utils/paginate');

const router = express.Router();

// 内存存储文件, 限制5MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// 归一化商品分组: 支持数组(多选)或逗号字符串, 统一存为逗号分隔
function normGroup(g) {
  if (Array.isArray(g)) return g.map((x) => String(x).trim()).filter(Boolean).join(',') || null;
  const s = String(g || '').trim();
  return s || null;
}

// GET /api/materials  分页查询, 支持关键字(编码/名称)/分类/商品分组/物料大类筛选
// 操作员也可查看(录单时需选择物料)
router.get('/', auth, async (req, res) => {
  const { page = 1, pageSize = 10, keyword = '', category = '', product_group = '', material_cat = '' } = req.query;
  const where = ['m.status = 1'];
  const params = [];
  if (keyword) { where.push('(m.code LIKE ? OR m.name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
  if (category) { where.push('m.category = ?'); params.push(category); }
  if (product_group) { where.push('FIND_IN_SET(?, m.product_group)'); params.push(product_group); }
  if (material_cat) { where.push('m.material_cat = ?'); params.push(material_cat); }
  const whereSql = 'WHERE ' + where.join(' AND ');
  const { pageSize: limit, offset } = parsePage(req.query);

  try {
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM materials m ${whereSql}`, params);
    const [list] = await pool.query(
      `SELECT m.id, m.code, m.name, m.spec, m.unit, m.category, m.product_group, m.material_cat, m.safety_stock, m.created_at
       FROM materials m ${whereSql}
       ORDER BY m.product_group ASC, m.code ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ code: 200, data: { list, total, page: parsePage(req.query).page, pageSize: limit } });
  } catch (e) {
    console.error('查询物料失败:', e.message);
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// GET /api/materials/groups  商品分组列表(下拉/筛选用)
router.get('/groups', auth, async (req, res) => {
  try {
    // 分组字段存逗号分隔多组, 拆分去重返回
    const [rows] = await pool.query(
      `SELECT product_group AS name FROM materials
       WHERE status = 1 AND product_group IS NOT NULL AND product_group <> ''`
    );
    const set = new Set();
    for (const r of rows) {
      for (const g of String(r.name).split(',')) {
        const t = g.trim();
        if (t) set.add(t);
      }
    }
    res.json({ code: 200, data: [...set].sort((a, b) => a.localeCompare(b, 'zh')) });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// GET /api/materials/material-cats  物料大类列表(预定义 + 已用值, 下拉筛选用)
router.get('/material-cats', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT material_cat AS name FROM materials
       WHERE status = 1 AND material_cat IS NOT NULL AND material_cat <> ''`
    );
    const set = new Set(['原材料', '包装辅料', '配套小件']);
    for (const r of rows) set.add(r.name);
    res.json({ code: 200, data: [...set] });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// GET /api/materials/all  全量启用物料(下拉选择用, 数量通常不大)
router.get('/all', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, code, name, spec, unit, category, product_group, safety_stock
       FROM materials WHERE status = 1
       ORDER BY product_group ASC, code ASC`
    );
    res.json({ code: 200, data: rows });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});


// POST /api/materials/import  Excel批量导入物料(仅管理员)
// 支持: 前端客户端解析后提交 JSON {rows:[{code,name,spec,unit,category,product_group,safety_stock}]} 或 上传Excel文件
router.post('/import', auth, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    let raw = req.body?.rows;
    if (Array.isArray(raw)) {
      // 前端已解析为对象数组
    } else if (req.file) {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
    } else {
      return res.json({ code: 400, msg: '请选择Excel文件' });
    }
    // 统一字段(兼容中英文键)
    const rows = raw.map((r) => ({
      code: String(r.code ?? r['物料编码'] ?? '').trim(),
      name: String(r.name ?? r['物料名称'] ?? '').trim(),
      spec: String(r.spec ?? r['规格型号'] ?? '').trim(),
      unit: String(r.unit ?? r['单位'] ?? '').trim(),
      category: String(r.category ?? r['分类'] ?? '').trim(),
      material_cat: String(r.material_cat ?? r['物料大类'] ?? '').trim() || '其他',
      product_group: String(r.product_group ?? r['商品分组'] ?? '').trim(),
      safety_stock: Number(r.safety_stock ?? r['安全库存']) || 0,
    }));
    if (!rows.length) return res.json({ code: 400, msg: 'Excel内容为空' });

    const results = { total: rows.length, success: 0, errors: [] };
    const seen = new Map(); // 批内编码查重
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNo = i + 2; // 表头占第1行, 数据从第2行起
      const { code, name } = r;
      if (!code || !name) { results.errors.push(`第${rowNo}行: 物料编码和名称必填`); continue; }
      if (seen.has(code)) { results.errors.push(`第${rowNo}行: 编码 ${code} 与第${seen.get(code)}行重复`); continue; }
      seen.set(code, rowNo);

      const [dup] = await pool.query('SELECT id FROM materials WHERE code = ? AND status = 1', [code]);
      if (dup.length) { results.errors.push(`第${rowNo}行: 编码 ${code} 已存在`); continue; }

      try {
        await pool.query(
          'INSERT INTO materials (code, name, spec, unit, category, material_cat, product_group, safety_stock, created_by) VALUES (?,?,?,?,?,?,?,?,?)',
          [code, name, r.spec, r.unit, r.category, r.material_cat, r.product_group || null, r.safety_stock, req.user.id]
        );
        results.success++;
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') results.errors.push(`第${rowNo}行: 编码 ${code} 已存在`);
        else results.errors.push(`第${rowNo}行: 写入失败(${e.message})`);
      }
    }
    await logAction(req, 'create_material', `导入物料 ${results.success} 条`);
    res.json({ code: 200, msg: `导入完成：成功 ${results.success} 条，失败 ${results.errors.length} 条`, data: results });
  } catch (e) {
    console.error('导入物料失败:', e.message);
    res.json({ code: 500, msg: '导入失败，请检查文件是否为有效Excel' });
  }
});

// POST /api/materials  新增物料(仅管理员)
router.post('/', auth, requireAdmin, async (req, res) => {
  const { code, name, spec = '', unit = '', category = '', material_cat = '', product_group = '', safety_stock = 0 } = req.body || {};
  const pg = normGroup(product_group);
  if (!code || !name) return res.json({ code: 400, msg: '物料编码和名称必填' });
  try {
    const [dup] = await pool.query('SELECT id FROM materials WHERE code = ? AND status = 1', [code]);
    if (dup.length) return res.json({ code: 400, msg: '物料编码已存在' });
    const [r] = await pool.query(
      'INSERT INTO materials (code, name, spec, unit, category, material_cat, product_group, safety_stock, created_by) VALUES (?,?,?,?,?,?,?,?,?)',
      [code.trim(), name.trim(), spec, unit, category, String(material_cat).trim() || '其他', pg, Number(safety_stock) || 0, req.user.id]
    );
    await logAction(req, 'create_material', `新增物料 ${code} ${name.trim()}`);
    res.json({ code: 200, msg: '新增成功', data: { id: r.insertId } });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.json({ code: 400, msg: '物料编码已存在' });
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// PUT /api/materials/:id  修改物料(仅管理员)
router.put('/:id', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { code, name, spec, unit, category, material_cat, product_group, safety_stock } = req.body || {};
  const pg = normGroup(product_group);
  if (!code || !name) return res.json({ code: 400, msg: '物料编码和名称必填' });
  try {
    const [dup] = await pool.query(
      'SELECT id FROM materials WHERE code = ? AND status = 1 AND id <> ?', [code, id]);
    if (dup.length) return res.json({ code: 400, msg: '物料编码已存在' });
    const [r] = await pool.query(
      'UPDATE materials SET code=?, name=?, spec=?, unit=?, category=?, material_cat=?, product_group=?, safety_stock=? WHERE id=? AND status=1',
      [code.trim(), name.trim(), spec, unit, category, String(material_cat || '').trim() || '其他', pg, Number(safety_stock) || 0, id]
    );
    if (r.affectedRows === 0) return res.json({ code: 400, msg: '物料不存在或已停用' });
    await logAction(req, 'update_material', `修改物料 ${id} → ${code} ${name.trim()}`);
    res.json({ code: 200, msg: '修改成功' });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// DELETE /api/materials/:id  停用物料(软删除, 仅管理员; 保留流水引用)
router.delete('/:id', auth, requireAdmin, async (req, res) => {
  try {
    const [r] = await pool.query('UPDATE materials SET status = 0 WHERE id = ? AND status = 1', [req.params.id]);
    if (r.affectedRows === 0) return res.json({ code: 400, msg: '物料不存在或已停用' });
    await logAction(req, 'disable_material', `停用物料 #${req.params.id}`);
    res.json({ code: 200, msg: '已停用' });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

module.exports = router;
