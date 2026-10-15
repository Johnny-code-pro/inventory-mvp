// 日志自动清理: 定期删除保留期(默认90天)之前的审计日志/登录日志, 防止数据表无限膨胀
const pool = require('../config/db');

const RETENTION_DAYS = 90;

async function runCleanup() {
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000);
    const dateStr = cutoff.toISOString().slice(0, 19).replace('T', ' ');
    const [r1] = await pool.query('DELETE FROM audit_logs WHERE created_at < ?', [dateStr]);
    const [r2] = await pool.query('DELETE FROM login_logs WHERE created_at < ?', [dateStr]);
    if (r1.affectedRows || r2.affectedRows) {
      console.log(`[日志清理] 审计 ${r1.affectedRows} 条, 登录 ${r2.affectedRows} 条 (保留${RETENTION_DAYS}天)`);
    }
  } catch (e) {
    console.error('日志清理失败:', e.message);
  }
}

// 启动清理调度: 启动时先清一次, 之后每6小时检查一次(幂等, 只删超期数据)
function startCleanupScheduler() {
  runCleanup();
  setInterval(runCleanup, 6 * 3600 * 1000).unref();
}

module.exports = { startCleanupScheduler, runCleanup };
