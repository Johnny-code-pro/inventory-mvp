// 手动/定时备份入口(供 crontab 每日调用)
require('dotenv').config();
const { createBackup } = require('../utils/backup');
createBackup()
  .then((r) => console.log(`[备份] 完成 ${r.filename} (${(r.size / 1024 / 1024).toFixed(2)} MB)`))
  .catch((e) => { console.error('[备份] 失败:', e.message); process.exit(1); });
