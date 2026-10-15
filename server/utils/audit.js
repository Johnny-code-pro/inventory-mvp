// 操作审计: 记录谁在何时做了什么
const pool = require('../config/db');

// req: 请求对象; action: 动作标识; detail: 描述(截断500字)
async function logAction(req, action, detail = '') {
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_id, username, action, target, detail, ip) VALUES (?,?,?,?,?,?)',
      [req.user?.id || null, req.user?.username || '', action, req.path, String(detail).slice(0, 500), req.ip || '']
    );
  } catch (e) { /* 审计失败不影响主流程 */ }
}

module.exports = { logAction };
