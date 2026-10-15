// 操作审计日志查询(管理员及以上)
const express = require('express');
const pool = require('../config/db');
const { auth, requireAdmin } = require('../middleware/auth');
const { parsePage } = require('../utils/paginate');

const router = express.Router();

// GET /api/audit  审计日志分页
router.get('/', auth, requireAdmin, async (req, res) => {
  const { keyword = '' } = req.query;
  const where = ['1=1'];
  const params = [];
  if (keyword) { where.push('(username LIKE ? OR action LIKE ? OR detail LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
  const whereSql = 'WHERE ' + where.join(' AND ');
  const { page, pageSize: limit, offset } = parsePage(req.query);
  try {
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM audit_logs ${whereSql}`, params);
    const [list] = await pool.query(
      `SELECT id, username, action, target, detail, ip, created_at
       FROM audit_logs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ code: 200, data: { list, total, page, pageSize: limit } });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

module.exports = router;
