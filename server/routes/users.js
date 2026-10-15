// 用户管理路由(仅超级管理员)
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { auth, requireSuperAdmin } = require('../middleware/auth');
const { logAction } = require('../utils/audit');

const router = express.Router();

// 密码强度校验: 至少8位, 同时包含字母和数字
function validatePassword(pwd) {
  if (!pwd || String(pwd).length < 8) return '密码至少8位';
  if (!/[a-zA-Z]/.test(pwd) || !/\d/.test(pwd)) return '密码需同时包含字母和数字';
  return '';
}

// GET /api/users  用户列表(超级管理员)
router.get('/', auth, requireSuperAdmin, async (req, res) => {
  const { keyword = '' } = req.query;
  try {
    const where = ['1=1'];
    const params = [];
    if (keyword) { where.push('(username LIKE ? OR real_name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
    const [list] = await pool.query(
      `SELECT id, username, real_name, role, status, created_at
       FROM users WHERE ${where.join(' AND ')} ORDER BY id`,
      params
    );
    res.json({ code: 200, data: list });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// POST /api/users  新增用户(超级管理员)
router.post('/', auth, requireSuperAdmin, async (req, res) => {
  const { username, password, real_name = '', role = 'operator', status = 1 } = req.body || {};
  if (!username || !password) return res.json({ code: 400, msg: '账号和密码必填' });
  if (!['superadmin', 'admin', 'operator'].includes(role)) return res.json({ code: 400, msg: '角色不正确' });
  const pwdErr = validatePassword(password);
  if (pwdErr) return res.json({ code: 400, msg: pwdErr });
  try {
    const [dup] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (dup.length) return res.json({ code: 400, msg: '账号已存在' });
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password, real_name, role, status) VALUES (?,?,?,?,?)',
      [username.trim(), hash, real_name.trim(), role, status]
    );
    await logAction(req, 'create_user', `新增用户 ${username.trim()} 角色${role}`);
    res.json({ code: 200, msg: '新增成功' });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// PUT /api/users/:id  修改用户(姓名/角色/状态, 超级管理员)
router.put('/:id', auth, requireSuperAdmin, async (req, res) => {
  const { real_name, role, status } = req.body || {};
  if (role && !['superadmin', 'admin', 'operator'].includes(role)) return res.json({ code: 400, msg: '角色不正确' });
  try {
    const [rows] = await pool.query('SELECT id, role FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.json({ code: 400, msg: '用户不存在' });
    // 防止把自己降级/停用
    if (Number(req.params.id) === req.user.id) {
      if (role && role !== 'superadmin') return res.json({ code: 400, msg: '不能修改自己的超级管理员角色' });
      if (status === 0) return res.json({ code: 400, msg: '不能停用自己' });
    }
    const set = [];
    const params = [];
    if (real_name != null) { set.push('real_name=?'); params.push(real_name.trim()); }
    if (role) { set.push('role=?'); params.push(role); }
    if (status != null) { set.push('status=?'); params.push(status); }
    if (!set.length) return res.json({ code: 400, msg: '没有需要修改的内容' });
    params.push(req.params.id);
    await pool.query(`UPDATE users SET ${set.join(',')} WHERE id=?`, params);
    await logAction(req, 'update_user', `修改用户 #${req.params.id}: ${set.join(',')}`);
    res.json({ code: 200, msg: '修改成功' });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// PUT /api/users/:id/password  重置密码(超级管理员)
router.put('/:id/password', auth, requireSuperAdmin, async (req, res) => {
  const { password } = req.body || {};
  const pwdErr = validatePassword(password);
  if (pwdErr) return res.json({ code: 400, msg: pwdErr });
  try {
    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query('UPDATE users SET password=? WHERE id=?', [hash, req.params.id]);
    if (r.affectedRows === 0) return res.json({ code: 400, msg: '用户不存在' });
    await logAction(req, 'reset_password', `重置用户 #${req.params.id} 密码`);
    res.json({ code: 200, msg: '密码已重置' });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

module.exports = router;
