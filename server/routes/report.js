// 库存报表路由: 出入库趋势 + 呆滞库存
const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/report/trend?months=6  出入库月度趋势(近N个月)
router.get('/trend', auth, async (req, res) => {
  const months = Math.min(24, Math.max(1, parseInt(req.query.months, 10) || 6));
  try {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(f.created_at, '%Y-%m') AS ym,
         SUM(CASE WHEN f.type='IN' THEN f.quantity ELSE 0 END) AS in_qty,
         SUM(CASE WHEN f.type='OUT' THEN f.quantity ELSE 0 END) AS out_qty
       FROM flows f
       WHERE f.status = 1 AND f.created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY ym ORDER BY ym`,
      [months]
    );
    res.json({ code: 200, data: rows.map((r) => ({ ym: r.ym, in_qty: Number(r.in_qty), out_qty: Number(r.out_qty) })) });
  } catch (e) {
    console.error('查询趋势失败:', e.message);
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// GET /api/report/stale?days=90  呆滞库存(库存>0 但长期无出入库)
router.get('/stale', auth, async (req, res) => {
  const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 90));
  try {
    const [rows] = await pool.query(
      `SELECT m.code, m.name, m.spec, m.unit, m.safety_stock,
         COALESCE(SUM(CASE WHEN f.type='IN' THEN f.quantity ELSE 0 END),0)
       - COALESCE(SUM(CASE WHEN f.type='OUT' THEN f.quantity ELSE 0 END),0) AS stock,
         MAX(f.created_at) AS last_flow_at,
         DATEDIFF(CURDATE(), IFNULL(MAX(f.created_at), CURDATE())) AS stale_days
       FROM materials m
       LEFT JOIN flows f ON f.material_id = m.id AND f.status = 1
       WHERE m.status = 1
       GROUP BY m.id, m.code, m.name, m.spec, m.unit, m.safety_stock
       HAVING stock > 0 AND stale_days >= ?
       ORDER BY stale_days DESC`,
      [days]
    );
    res.json({ code: 200, data: rows.map((r) => ({ ...r, stock: Number(r.stock), stale_days: Number(r.stale_days) })) });
  } catch (e) {
    console.error('查询呆滞库存失败:', e.message);
    res.json({ code: 500, msg: '服务器异常' });
  }
});

module.exports = router;
