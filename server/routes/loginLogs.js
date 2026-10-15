// 登录日志查询路由(仅超级管理员)
const express = require('express');
const pool = require('../config/db');
const { auth, requireSuperAdmin } = require('../middleware/auth');
const { parsePage } = require('../utils/paginate');

const router = express.Router();

// GET /api/login-logs  登录日志分页(支持账号/姓名/状态/日期范围)
router.get('/', auth, requireSuperAdmin, async (req, res) => {
  const { keyword = '', status = '', start = '', end = '' } = req.query;
  const where = ['1=1'];
  const params = [];
  if (keyword) { where.push('(username LIKE ? OR real_name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
  if (status !== '') { where.push('status = ?'); params.push(Number(status)); }
  if (start) { where.push('created_at >= ?'); params.push(start); }
  if (end) { where.push('created_at <= ?'); params.push(`${end} 23:59:59`); }
  const whereSql = 'WHERE ' + where.join(' AND ');
  const { page, pageSize: limit, offset } = parsePage(req.query);

  try {
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM login_logs ${whereSql}`, params);
    const [list] = await pool.query(
      `SELECT id, username, real_name, role, ip, ua, status, msg, created_at
       FROM login_logs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ code: 200, data: { list, total, page, pageSize: limit } });
  } catch (e) {
    console.error('查询登录日志失败:', e.message);
    res.json({ code: 500, msg: '服务器异常' });
  }
});

module.exports = router;
