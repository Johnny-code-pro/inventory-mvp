// 全量数据导出(仅超级管理员): 一次性返回全部业务数据, 供前端生成多 Sheet Excel
const express = require('express');
const pool = require('../config/db');
const { auth, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/export/full  导出全部: 物料档案/实时库存/出入库流水/成品配方/采购订单
router.get('/full', auth, requireSuperAdmin, async (req, res) => {
  try {
    const [materials] = await pool.query(
      `SELECT m.id, m.code, m.name, m.spec, m.unit, m.category, m.material_cat, m.product_group, m.safety_stock, m.status, m.created_at
       FROM materials m ORDER BY m.product_group ASC, m.code ASC`
    );

    const [inventory] = await pool.query(
      `SELECT m.code, m.name, m.spec, m.unit, m.category, m.material_cat, m.product_group, m.safety_stock,
         COALESCE(SUM(CASE WHEN f.type='IN' THEN f.quantity ELSE 0 END),0) AS total_in,
         COALESCE(SUM(CASE WHEN f.type='OUT' THEN f.quantity ELSE 0 END),0) AS total_out,
         COALESCE(SUM(CASE WHEN f.type='IN' THEN f.quantity ELSE 0 END),0)
       - COALESCE(SUM(CASE WHEN f.type='OUT' THEN f.quantity ELSE 0 END),0) AS stock
       FROM materials m LEFT JOIN flows f ON f.material_id = m.id AND f.status = 1
       WHERE m.status = 1
       GROUP BY m.id, m.code, m.name, m.spec, m.unit, m.category, m.material_cat, m.product_group, m.safety_stock
       ORDER BY m.product_group ASC, m.code ASC`
    );

    const [flows] = await pool.query(
      `SELECT f.flow_no, f.type, f.quantity, f.counterparty, f.purpose, f.status AS flow_status, f.created_at,
              m.code AS material_code, m.name AS material_name, m.spec, m.unit,
              u.username AS operator
       FROM flows f
       JOIN materials m ON m.id = f.material_id
       LEFT JOIN users u ON u.id = f.operator_id
       ORDER BY f.id DESC`
    );

    const [products] = await pool.query(
      `SELECT p.id, p.code, p.name, p.status, p.created_at FROM products p ORDER BY p.code`
    );

    const [boms] = await pool.query(
      `SELECT p.code AS product_code, p.name AS product_name, m.code AS material_code, m.name AS material_name, b.qty_per
       FROM bom b JOIN products p ON p.id = b.product_id JOIN materials m ON m.id = b.material_id
       ORDER BY p.code, b.id`
    );

    const [intransit] = await pool.query(
      `SELECT i.id, m.code AS material_code, m.name AS material_name, i.quantity, i.received,
              (i.quantity - i.received) AS remaining, i.supplier, i.remark, i.status, i.created_at
       FROM intransit i JOIN materials m ON m.id = i.material_id ORDER BY i.id DESC`
    );

    res.json({ code: 200, data: { materials, inventory, flows, products, boms, intransit } });
  } catch (e) {
    console.error('导出失败:', e.message);
    res.json({ code: 500, msg: '服务器异常' });
  }
});

module.exports = router;
