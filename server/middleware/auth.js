// 认证与权限中间件 (JWT)
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'inventory-mvp-secret-please-change';

// 校验登录态: 解析请求头 Authorization: Bearer <token>
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ code: 401, msg: '未登录或登录已失效' });
  try {
    req.user = jwt.verify(token, SECRET); // { id, username, role, real_name }
    next();
  } catch (e) {
    return res.status(401).json({ code: 401, msg: '登录已过期，请重新登录' });
  }
}

// 是否管理员(含超级管理员)
function isAdminRole(role) {
  return role === 'admin' || role === 'superadmin';
}

// 角色校验: 管理员或超级管理员可过(用于物料/产品等写操作)
function requireAdmin(req, res, next) {
  if (!isAdminRole(req.user.role)) {
    return res.status(403).json({ code: 403, msg: '无权限：该操作仅管理员可用' });
  }
  next();
}

// 角色校验: 仅超级管理员可过(用户管理/系统设置)
function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ code: 403, msg: '无权限：该操作仅超级管理员可用' });
  }
  next();
}

module.exports = { auth, requireAdmin, requireSuperAdmin, isAdminRole, SECRET };
