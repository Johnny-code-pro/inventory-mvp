// 认证路由: 登录
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { auth, SECRET } = require('../middleware/auth');
const { logAction } = require('../utils/audit');

const router = express.Router();

// 简单登录频率限制(内存): 同一IP 10分钟内失败5次则锁定15分钟, 防暴力破解
const loginAttempts = new Map();
function rateCheck(ip) {
  const rec = loginAttempts.get(ip);
  if (rec && rec.lockUntil && Date.now() < rec.lockUntil) {
    return Math.ceil((rec.lockUntil - Date.now()) / 60000);
  }
  return 0;
}
function rateFail(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip) || { count: 0, first: now };
  if (now - rec.first > 10 * 60000) { rec.count = 0; rec.first = now; }
  rec.count++;
  if (rec.count >= 5) rec.lockUntil = now + 15 * 60000;
  loginAttempts.set(ip, rec);
}
function rateClear(ip) { loginAttempts.delete(ip); }

// 定期清理过期记录, 防止 Map 无限增长(内存泄漏): 每10分钟清一次30分钟前且未锁定的IP
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of loginAttempts) {
    const locked = rec.lockUntil && rec.lockUntil > now;
    if (!locked && now - rec.first > 30 * 60000) loginAttempts.delete(ip);
  }
}, 10 * 60000).unref();

// 获取客户端真实IP(考虑反向代理 X-Forwarded-For)
function getClientIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.ip || '';
}
// 记录登录日志(独立于登录主流程, 失败不影响登录)
async function logLogin({ username, real_name = '', role = '', ip, ua, status, msg }) {
  try {
    await pool.query(
      'INSERT INTO login_logs (username, real_name, role, ip, ua, status, msg) VALUES (?,?,?,?,?,?,?)',
      [username, real_name, role, ip, String(ua || '').slice(0, 250), status, msg]
    );
  } catch (e) { /* 日志写入失败忽略 */ }
}

// POST /api/auth/login  登录
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.json({ code: 400, msg: '请输入账号和密码' });

  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] || '';
  const waitMin = rateCheck(ip);
  if (waitMin > 0) return res.json({ code: 400, msg: `登录尝试过多，请 ${waitMin} 分钟后再试` });

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      rateFail(ip);
      await logLogin({ username, ip, ua, status: 0, msg: '账号或密码错误' });
      return res.json({ code: 400, msg: '账号或密码错误' });
    }

    const user = rows[0];
    if (user.status !== 1) {
      await logLogin({ username, real_name: user.real_name, role: user.role, ip, ua, status: 0, msg: '账号已停用' });
      return res.json({ code: 400, msg: '账号已被停用，请联系管理员' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      rateFail(ip);
      await logLogin({ username, real_name: user.real_name, role: user.role, ip, ua, status: 0, msg: '账号或密码错误' });
      return res.json({ code: 400, msg: '账号或密码错误' });
    }

    rateClear(ip);
    // 签发 JWT, 有效期 12 小时
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, real_name: user.real_name },
      SECRET,
      { expiresIn: '12h' }
    );
    await logAction(req, 'login', `${username} 登录成功(${user.role})`);
    await logLogin({ username, real_name: user.real_name, role: user.role, ip, ua, status: 1, msg: '登录成功' });
    res.json({
      code: 200,
      msg: '登录成功',
      data: { token, user: { id: user.id, username: user.username, role: user.role, real_name: user.real_name } },
    });
  } catch (e) {
    console.error('登录失败:', e.message);
    res.json({ code: 500, msg: '服务器异常，请稍后重试' });
  }
});

// GET /api/auth/me  获取当前登录用户(用于刷新页面后恢复登录态)
router.get('/me', auth, (req, res) => {
  res.json({ code: 200, data: req.user });
});

module.exports = router;
