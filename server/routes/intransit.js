// 采购订单/在途物料路由: 下单在途, 分批到货入库(到一点入一点, 直到全部到齐)
const express = require('express');
const pool = require('../config/db');
const { auth, requireAdmin } = require('../middleware/auth');
const { nextFlowNo } = require('../utils/flowNo');
const { logAction } = require('../utils/audit');

const router = express.Router();

// GET /api/intransit  订单列表(status 0在途/未到齐 1全部到齐)
router.get('/', auth, async (req, res) => {
  const { status = 0 } = req.query;
  try {
    const [rows] = await pool.query(
      `SELECT i.id, i.material_id, i.quantity, i.received,
              (i.quantity - i.received) AS remaining,
              i.supplier, i.remark, i.status, i.created_at, i.done_at,
              m.code AS material_code, m.name AS material_name, m.spec, m.unit
       FROM intransit i JOIN materials m ON m.id = i.material_id
       WHERE i.status = ? ORDER BY i.created_at DESC`,
      [Number(status)]
    );
    res.json({ code: 200, data: rows });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// POST /api/intransit  新增采购订单(在途登记, 仅管理员及以上)
router.post('/', auth, requireAdmin, async (req, res) => {
  const { material_id, quantity, supplier = '', remark = '' } = req.body || {};
  const qty = Number(quantity);
  if (!material_id || !qty || qty <= 0) return res.json({ code: 400, msg: '请选择物料并填写大于0的订购数量' });
  try {
    const [mats] = await pool.query('SELECT id FROM materials WHERE id = ? AND status = 1', [material_id]);
    if (!mats.length) return res.json({ code: 400, msg: '物料不存在或已停用' });
    await pool.query(
      'INSERT INTO intransit (material_id, quantity, received, supplier, remark, created_by) VALUES (?,?,0,?,?,?)',
      [material_id, qty, supplier, remark, req.user.id]
    );
    await logAction(req, 'intransit_add', `采购下单 物料#${material_id} x${qty}`);
    res.json({ code: 200, msg: '采购订单已创建' });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// POST /api/intransit/:id/receive  分批到货入库(本次到货数量)
router.post('/:id/receive', auth, async (req, res) => {
  const arrival = Number(req.body?.quantity);
  if (!arrival || arrival <= 0) return res.json({ code: 400, msg: '请填写本次到货数量' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT id, material_id, quantity, received, supplier, remark FROM intransit WHERE id = ? AND status = 0',
      [req.params.id]
    );
    if (!rows.length) { await conn.rollback(); return res.json({ code: 400, msg: '订单不存在或已全部到齐' }); }
    const it = rows[0];
    const remaining = Number(it.quantity) - Number(it.received);
    if (arrival > remaining) { await conn.rollback(); return res.json({ code: 400, msg: `到货数量超过待入库 ${remaining}` }); }

    const flowNo = await nextFlowNo(conn, 'IN');
    const purpose = it.remark ? `[采购到货] ${it.remark}` : '[采购到货]';
    await conn.query(
      'INSERT INTO flows (flow_no, material_id, type, quantity, counterparty, purpose, operator_id) VALUES (?,?,?,?,?,?,?)',
      [flowNo, it.material_id, 'IN', arrival, it.supplier, purpose, req.user.id]
    );
    const newReceived = Number(it.received) + arrival;
    const done = newReceived >= Number(it.quantity);
    await conn.query(
      'UPDATE intransit SET received = ?, status = ?, done_at = IF(?=1, NOW(), NULL) WHERE id = ?',
      [newReceived, done ? 1 : 0, done ? 1 : 0, it.id]
    );
    await conn.commit();
    await logAction(req, 'intransit_receive', `订单#${it.id} 到货 ${arrival}, 剩余 ${(Number(it.quantity) - newReceived).toFixed(2)}`);
    res.json({ code: 200, msg: done ? '已全部到货入库，订单完成' : `已入库 ${arrival}，剩余 ${(Number(it.quantity) - newReceived).toFixed(2)} 待入库`, data: { flow_no: flowNo } });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') return res.json({ code: 400, msg: '流水号冲突，请重试' });
    console.error('到货入库失败:', e.message);
    res.json({ code: 500, msg: '服务器异常' });
  } finally {
    conn.release();
  }
});

// DELETE /api/intransit/:id  删除订单(仅未到货的, 仅管理员及以上)
router.delete('/:id', auth, requireAdmin, async (req, res) => {
  try {
    const [r] = await pool.query('DELETE FROM intransit WHERE id = ? AND received = 0', [req.params.id]);
    if (r.affectedRows === 0) return res.json({ code: 400, msg: '订单不存在或已有到货，不能删除' });
    res.json({ code: 200, msg: '已删除' });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

module.exports = router;
