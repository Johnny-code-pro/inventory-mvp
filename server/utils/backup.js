// 数据库备份工具: mysqldump + gzip 到备份目录, 保留最近 KEEP_DAYS 天
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'backups');
const KEEP_DAYS = 14;

function ensureDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// 创建一份完整备份(带时间戳), 返回 { filename, path, size }
function createBackup() {
  ensureDir();
  const ts = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '').slice(0, 14);
  const filename = `inventory_${ts}.sql.gz`;
  const filePath = path.join(BACKUP_DIR, filename);
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT || '3306';
  const user = process.env.DB_USER || 'root';
  const pass = process.env.DB_PASSWORD || '';
  const db = process.env.DB_NAME || 'inventory_mvp';
  const dumpCmd = `mysqldump -h ${host} -P ${port} -u ${user} --single-transaction --routines --triggers ${db} | gzip > "${filePath}"`;

  return new Promise((resolve, reject) => {
    exec(dumpCmd, { env: { ...process.env, MYSQL_PWD: pass } }, (err) => {
      if (err) return reject(err);
      const st = fs.statSync(filePath);
      cleanupOldBackups();
      resolve({ filename, path: filePath, size: st.size, mtime: st.mtime });
    });
  });
}

// 列出备份文件(新→旧)
function listBackups() {
  ensureDir();
  return fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.sql.gz'))
    .map((f) => {
      const st = fs.statSync(path.join(BACKUP_DIR, f));
      return { filename: f, size: st.size, mtime: st.mtime };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

// 清理超过 KEEP_DAYS 的旧备份
function cleanupOldBackups() {
  const cutoff = Date.now() - KEEP_DAYS * 24 * 3600 * 1000;
  for (const b of listBackups()) {
    if (b.mtime.getTime() < cutoff) {
      try { fs.unlinkSync(path.join(BACKUP_DIR, b.filename)); } catch (e) { /* ignore */ }
    }
  }
}

module.exports = { createBackup, listBackups, cleanupOldBackups, BACKUP_DIR, KEEP_DAYS };
