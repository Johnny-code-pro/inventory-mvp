// 产品(成品)与BOM配方路由: 产品CRUD + 配方(配件)管理
const express = require('express');
const pool = require('../config/db');
const { auth, requireAdmin } = require('../middleware/auth');
const { logAction } = require('../utils/audit');
const { parsePage } = require('../utils/paginate');

const router = express.Router();

// GET /api/products/all  启用产品(下拉用)
router.get('/all', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, code, name FROM products WHERE status = 1 ORDER BY code'
    );
    res.json({ code: 200, data: rows });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// POST /api/products/calc-need  生产缺料计算: 输入成品+数量, 按BOM算各配件需要/库存/缺口(负=缺)
router.post('/calc-need', auth, async (req, res) => {
  const items = req.body?.items || [];
  if (!Array.isArray(items) || !items.length) return res.json({ code: 400, msg: '请至少填写一个成品及数量' });
  try {
    // 逐成品取BOM并汇总配件需求
    const matNeed = new Map(); // material_id -> { required }
    const detail = [];
    for (const it of items) {
      const qty = Number(it.quantity);
      const pid = it.product_id;
      if (!pid || !qty || qty <= 0) { detail.push({ product_id: pid, error: '数量无效' }); continue; }
      const [prods] = await pool.query('SELECT id, code, name FROM products WHERE id = ? AND status = 1', [pid]);
      if (!prods.length) { detail.push({ product_id: pid, error: '成品不存在或已停用' }); continue; }
      const [boms] = await pool.query('SELECT b.material_id, b.qty_per, m.code, m.name, m.spec, m.unit FROM bom b JOIN materials m ON m.id=b.material_id WHERE b.product_id=?', [pid]);
      if (!boms.length) { detail.push({ product_id: pid, code: prods[0].code, name: prods[0].name, quantity: qty, error: '未配置配方' }); continue; }
      detail.push({ product_id: pid, code: prods[0].code, name: prods[0].name, quantity: qty, components: boms.map((b) => ({ material_id: b.material_id, code: b.code, name: b.name, spec: b.spec, unit: b.unit, qty_per: Number(b.qty_per), need: Number(b.qty_per) * qty })) });
      for (const b of boms) {
        const m = matNeed.get(b.material_id) || { material_id: b.material_id, code: b.code, name: b.name, spec: b.spec, unit: b.unit, required: 0 };
        m.required += Number(b.qty_per) * qty;
        matNeed.set(b.material_id, m);
      }
    }

    // 查询相关物料当前库存
    const ids = [...matNeed.keys()];
    const stockMap = new Map();
    if (ids.length) {
      const [inv] = await pool.query(
        `SELECT m.id,
           COALESCE(SUM(CASE WHEN f.type='IN' AND f.status=1 THEN f.quantity ELSE 0 END),0)
         - COALESCE(SUM(CASE WHEN f.type='OUT' AND f.status=1 THEN f.quantity ELSE 0 END),0) AS stock
         FROM materials m LEFT JOIN flows f ON f.material_id=m.id AND f.status=1
         WHERE m.id IN (?) AND m.status=1 GROUP BY m.id`,
        [ids]
      );
      for (const r of inv) stockMap.set(r.id, Number(r.stock));
    }

    const materials = [...matNeed.values()].map((m) => {
      const stock = stockMap.get(m.material_id) || 0;
      return {
        material_id: m.material_id, code: m.code, name: m.name, spec: m.spec, unit: m.unit,
        required: Number(m.required.toFixed(2)),
        stock: Number(stock.toFixed(2)),
        shortage: Number((stock - m.required).toFixed(2)), // 负 = 缺料
      };
    });
    res.json({ code: 200, data: { detail, materials } });
  } catch (e) {
    console.error('缺料计算失败:', e.message);
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// GET /api/products  产品分页列表(含配方数)
router.get('/', auth, async (req, res) => {
  const { page = 1, pageSize = 10, keyword = '' } = req.query;
  const where = ['p.status = 1'];
  const params = [];
  if (keyword) { where.push('(p.code LIKE ? OR p.name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
  const whereSql = 'WHERE ' + where.join(' AND ');
  const { pageSize: limit, offset } = parsePage(req.query);
  try {
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM products p ${whereSql}`, params);
    const [list] = await pool.query(
      `SELECT p.id, p.code, p.name, p.created_at,
         (SELECT COUNT(*) FROM bom b WHERE b.product_id = p.id) AS bom_count
       FROM products p ${whereSql}
       ORDER BY p.code ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ code: 200, data: { list, total, page: parsePage(req.query).page, pageSize: limit } });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// POST /api/products  新增产品(仅管理员)
router.post('/', auth, requireAdmin, async (req, res) => {
  const { code, name } = req.body || {};
  if (!code || !name) return res.json({ code: 400, msg: '成品编码和名称必填' });
  try {
    const [dup] = await pool.query('SELECT id FROM products WHERE code = ?', [code]);
    if (dup.length) return res.json({ code: 400, msg: '成品编码已存在' });
    const [r] = await pool.query(
      'INSERT INTO products (code, name, created_by) VALUES (?,?,?)',
      [code.trim(), name.trim(), req.user.id]
    );
    await logAction(req, 'create_product', `新增成品 ${code} ${name.trim()}`);
    res.json({ code: 200, msg: '新增成功', data: { id: r.insertId } });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.json({ code: 400, msg: '成品编码已存在' });
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// PUT /api/products/:id  修改产品(仅管理员)
router.put('/:id', auth, requireAdmin, async (req, res) => {
  const { code, name } = req.body || {};
  if (!code || !name) return res.json({ code: 400, msg: '成品编码和名称必填' });
  try {
    const [dup] = await pool.query('SELECT id FROM products WHERE code = ? AND id <> ?', [code, req.params.id]);
    if (dup.length) return res.json({ code: 400, msg: '成品编码已存在' });
    const [r] = await pool.query('UPDATE products SET code=?, name=? WHERE id=? AND status=1', [code.trim(), name.trim(), req.params.id]);
    if (r.affectedRows === 0) return res.json({ code: 400, msg: '产品不存在或已停用' });
    await logAction(req, 'update_product', `修改成品 #${req.params.id} → ${code}`);
    res.json({ code: 200, msg: '修改成功' });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// DELETE /api/products/:id  停用产品(软删除, 仅管理员)
router.delete('/:id', auth, requireAdmin, async (req, res) => {
  try {
    const [r] = await pool.query('UPDATE products SET status = 0 WHERE id = ? AND status = 1', [req.params.id]);
    if (r.affectedRows === 0) return res.json({ code: 400, msg: '产品不存在或已停用' });
    await logAction(req, 'disable_product', `停用成品 #${req.params.id}`);
    res.json({ code: 200, msg: '已停用' });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// GET /api/products/:id/bom  某产品配方(配件)列表
router.get('/:id/bom', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.id AS bom_id, b.material_id, b.qty_per,
              m.code AS material_code, m.name AS material_name, m.spec, m.unit
       FROM bom b JOIN materials m ON m.id = b.material_id
       WHERE b.product_id = ? ORDER BY b.id`,
      [req.params.id]
    );
    res.json({ code: 200, data: rows });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// POST /api/products/:id/bom  添加配件到配方(仅管理员)
router.post('/:id/bom', auth, requireAdmin, async (req, res) => {
  const { material_id, qty_per } = req.body || {};
  const qty = Number(qty_per);
  if (!material_id || !qty || qty <= 0) return res.json({ code: 400, msg: '请选择配件物料并填写大于0的耗用量' });
  try {
    const [mats] = await pool.query('SELECT id FROM materials WHERE id = ? AND status = 1', [material_id]);
    if (!mats.length) return res.json({ code: 400, msg: '配件物料不存在或已停用' });
    const [r] = await pool.query(
      'INSERT INTO bom (product_id, material_id, qty_per) VALUES (?,?,?)',
      [req.params.id, material_id, qty]
    );
    await logAction(req, 'bom_add', `成品#${req.params.id} 添加配件#${material_id} 耗用${qty}`);
    res.json({ code: 200, msg: '已添加到配方', data: { id: r.insertId } });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.json({ code: 400, msg: '该物料已在配方中' });
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// PUT /api/products/:id/bom/:bomId  修改配方耗用量(仅管理员)
router.put('/:id/bom/:bomId', auth, requireAdmin, async (req, res) => {
  const qty = Number(req.body?.qty_per);
  if (!qty || qty <= 0) return res.json({ code: 400, msg: '耗用量必须大于0' });
  try {
    const [r] = await pool.query('UPDATE bom SET qty_per = ? WHERE id = ? AND product_id = ?', [qty, req.params.bomId, req.params.id]);
    if (r.affectedRows === 0) return res.json({ code: 400, msg: '配方项不存在' });
    res.json({ code: 200, msg: '修改成功' });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// DELETE /api/products/:id/bom/:bomId  从配方移除配件(仅管理员)
router.delete('/:id/bom/:bomId', auth, requireAdmin, async (req, res) => {
  try {
    const [r] = await pool.query('DELETE FROM bom WHERE id = ? AND product_id = ?', [req.params.bomId, req.params.id]);
    if (r.affectedRows === 0) return res.json({ code: 400, msg: '配方项不存在' });
    await logAction(req, 'bom_remove', `成品#${req.params.id} 移除配方项#${req.params.bomId}`);
    res.json({ code: 200, msg: '已移除' });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

module.exports = router;
