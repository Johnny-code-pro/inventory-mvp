// 库存看板路由: 库存全部由流水实时推导, 无任何"库存字段"
const express = require('express');
const pool = require('../config/db');
const { auth, requireAdmin } = require('../middleware/auth');
const { nextFlowNo } = require('../utils/flowNo');
const { logAction } = require('../utils/audit');

const router = express.Router();

// 单物料当前库存(事务内, 排除作废)
async function queryStock(conn, materialId) {
  const [rows] = await conn.query(
    `SELECT COALESCE(SUM(CASE WHEN f.type='IN' AND f.status=1 THEN f.quantity ELSE 0 END),0)
          - COALESCE(SUM(CASE WHEN f.type='OUT' AND f.status=1 THEN f.quantity ELSE 0 END),0) AS stock
     FROM flows f WHERE f.material_id=?`,
    [materialId]
  );
  return Number(rows[0].stock);
}

// 获取所有启用物料的实时库存(联表汇总流水)
async function queryInventory(conn) {
  const [rows] = await conn.query(
    `SELECT m.id, m.code, m.name, m.spec, m.unit, m.category, m.product_group, m.material_cat, m.safety_stock,
       COALESCE(SUM(CASE WHEN f.type='IN' THEN f.quantity ELSE 0 END),0) AS total_in,
       COALESCE(SUM(CASE WHEN f.type='OUT' THEN f.quantity ELSE 0 END),0) AS total_out,
       COALESCE(SUM(CASE WHEN f.type='IN' THEN f.quantity ELSE 0 END),0)
     - COALESCE(SUM(CASE WHEN f.type='OUT' THEN f.quantity ELSE 0 END),0) AS stock
     FROM materials m
     LEFT JOIN flows f ON f.material_id = m.id AND f.status = 1
     WHERE m.status = 1
     GROUP BY m.id, m.code, m.name, m.spec, m.unit, m.category, m.product_group, m.material_cat, m.safety_stock
     ORDER BY m.product_group ASC, m.code ASC`
  );
  return rows;
}

// GET /api/inventory  库存看板(支持关键字/物料大类/商品分组/低库存筛选)
router.get('/', auth, async (req, res) => {
  const { keyword = '', low_stock = '', material_cat = '', product_group = '' } = req.query;
  try {
    let rows = await queryInventory(pool);
    // 内存筛选(数据量小, 便于支持预警过滤)
    if (keyword) {
      const kw = keyword.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(kw) || r.code.toLowerCase().includes(kw));
    }
    if (material_cat) rows = rows.filter((r) => r.material_cat === material_cat);
    if (product_group) rows = rows.filter((r) => (r.product_group || '').split(',').includes(product_group));
    if (low_stock === '1') rows = rows.filter((r) => Number(r.stock) < Number(r.safety_stock));
    res.json({ code: 200, data: rows });
  } catch (e) {
    console.error('查询库存失败:', e.message);
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// GET /api/inventory/products  可组装成品: 按BOM配方计算当前物料库存可组装多少台
router.get('/products', auth, async (req, res) => {
  try {
    // 物料实时库存
    const inv = await queryInventory(pool);
    const stockMap = new Map(inv.map((m) => [m.id, Number(m.stock)]));
    // 成品及其配方
    const [prods] = await pool.query('SELECT id, code, name FROM products WHERE status = 1 ORDER BY code');
    const [boms] = await pool.query(
      `SELECT b.product_id, b.material_id, b.qty_per, m.code AS material_code, m.name AS material_name, m.spec, m.unit
       FROM bom b JOIN materials m ON m.id = b.material_id`
    );
    const byProduct = new Map();
    for (const b of boms) {
      if (!byProduct.has(b.product_id)) byProduct.set(b.product_id, []);
      byProduct.get(b.product_id).push(b);
    }

    const data = prods.map((p) => {
      const components = (byProduct.get(p.id) || []).map((c) => {
        const stock = stockMap.get(c.material_id) || 0;
        const qtyPer = Number(c.qty_per);
        return {
          material_id: c.material_id, material_code: c.material_code, material_name: c.material_name,
          spec: c.spec, unit: c.unit, qty_per: qtyPer, stock,
          cover: Math.floor(stock / qtyPer), // 该配件可覆盖台数
        };
      });
      const canMake = components.length ? Math.min(...components.map((c) => c.cover)) : 0;
      return { id: p.id, code: p.code, name: p.name, can_make: canMake, component_count: components.length, components };
    });
    res.json({ code: 200, data });
  } catch (e) {
    console.error('查询可组装成品失败:', e.message);
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// POST /api/inventory/adjust  库存调整(管理员及以上): 直接设置目标库存, 差额自动生成盘盈/盘亏流水
router.post('/adjust', auth, requireAdmin, async (req, res) => {
  const { material_id, target_stock, reason = '' } = req.body || {};
  const target = Number(target_stock);
  if (!material_id || !Number.isFinite(target) || target < 0) return res.json({ code: 400, msg: '请选择物料并填写目标库存(>=0)' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [mats] = await conn.query('SELECT id FROM materials WHERE id=? AND status=1', [material_id]);
    if (!mats.length) { await conn.rollback(); return res.json({ code: 400, msg: '物料不存在或已停用' }); }
    const current = await queryStock(conn, material_id);
    const diff = target - current;
    let flowNo = null;
    if (diff > 0) {
      flowNo = await nextFlowNo(conn, 'IN');
      await conn.query(
        'INSERT INTO flows (flow_no, material_id, type, quantity, counterparty, purpose, operator_id) VALUES (?,?,?,?,?,?,?)',
        [flowNo, material_id, 'IN', diff, '', `[库存调整] ${reason}`.trim(), req.user.id]
      );
    } else if (diff < 0) {
      flowNo = await nextFlowNo(conn, 'OUT');
      await conn.query(
        'INSERT INTO flows (flow_no, material_id, type, quantity, counterparty, purpose, operator_id) VALUES (?,?,?,?,?,?,?)',
        [flowNo, material_id, 'OUT', -diff, '', `[库存调整] ${reason}`.trim(), req.user.id]
      );
    }
    await conn.commit();
    const msg = diff === 0 ? '库存已等于目标值，无需调整' : `已调整到 ${target}（原 ${current}，${diff > 0 ? '盘盈 +' + diff : '盘亏 ' + diff}）`;
    await logAction(req, 'stock_adjust', `调整物料#${material_id} ${current}->${target}, ${reason}`);
    res.json({ code: 200, msg, data: { old: current, new: target, diff, flow_no: flowNo } });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') return res.json({ code: 400, msg: '流水号冲突，请重试' });
    console.error('库存调整失败:', e.message);
    res.json({ code: 500, msg: '服务器异常' });
  } finally {
    conn.release();
  }
});

// GET /api/inventory/stats  看板统计卡片数据
// 注意: 需声明在 /:id 之前, 避免被动态参数路由吞掉
router.get('/stats', auth, async (req, res) => {
  try {
    const rows = await queryInventory(pool);
    const materialCount = rows.length;
    const lowStock = rows.filter((r) => Number(r.stock) < Number(r.safety_stock)).length;
    const totalIn = rows.reduce((s, r) => s + Number(r.total_in), 0);
    const totalOut = rows.reduce((s, r) => s + Number(r.total_out), 0);
    res.json({ code: 200, data: { materialCount, lowStock, totalIn, totalOut } });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// GET /api/inventory/:id  单个物料实时库存(出库单选料时展示当前可用库存)
router.get('/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT m.id, m.code, m.name, m.unit, m.safety_stock,
         COALESCE(SUM(CASE WHEN f.type='IN' THEN f.quantity ELSE 0 END),0)
       - COALESCE(SUM(CASE WHEN f.type='OUT' THEN f.quantity ELSE 0 END),0) AS stock
       FROM materials m
       LEFT JOIN flows f ON f.material_id = m.id AND f.status = 1
       WHERE m.id = ? AND m.status = 1
       GROUP BY m.id, m.code, m.name, m.unit, m.safety_stock`,
      [req.params.id]
    );
    if (rows.length === 0) return res.json({ code: 400, msg: '物料不存在或已停用' });
    res.json({ code: 200, data: rows[0] });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

module.exports = router;
