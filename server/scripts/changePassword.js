// 修改用户密码工具
// 用法: 在 server 目录下执行
//   node scripts/changePassword.js <账号> <新密码>
// 例:   node scripts/changePassword.js admin MyNewP@ss2024
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const username = process.argv[2];
const newPwd = process.argv[3];

if (!username || !newPwd || newPwd.length < 6) {
  console.log('用法: node scripts/changePassword.js <账号> <新密码(至少6位)>');
  process.exit(1);
}

(async () => {
  try {
    const hash = await bcrypt.hash(newPwd, 10);
    const [r] = await pool.query('UPDATE users SET password = ? WHERE username = ?', [hash, username]);
    if (r.affectedRows === 0) {
      console.log(`未找到账号: ${username}`);
    } else {
      console.log(`已修改账号 ${username} 的密码。`);
    }
  } catch (e) {
    console.error('修改失败:', e.message);
  } finally {
    process.exit(0);
  }
})();
