// 数据库初始化: 建库 -> 执行建表SQL -> 若用户表为空则写入默认账号
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const SQL_PATH = path.join(__dirname, '..', '..', 'sql', 'init.sql');

// 建库连接(不指定库名, 用于 CREATE DATABASE)
const admin = { user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '' };

async function initDb() {
  // multipleStatements: 建表脚本含多条 CREATE 语句, 需一次提交
  const conn = await mysql.createConnection({ ...admin, host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT) || 3306, charset: 'utf8mb4', multipleStatements: true });

  const dbName = process.env.DB_NAME || 'inventory_mvp';
  // 库不存在则创建(幂等); 远程共享库场景下若远程账号无全局建库权限, 则降级为直接使用已有库
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4`);
  } catch (e) {
    console.log(`提示: 当前账号无建库权限(${e.code}), 尝试直接使用已有库 ${dbName}...`);
  }
  try {
    await conn.query(`USE \`${dbName}\``);
  } catch (e) {
    // USE 失败(如账号无该库权限): 不阻断启动, 交给连接池在首次查询时报明确错误
    console.log(`提示: 无法 USE ${dbName}(${e.code}), 将尝试用连接池默认库继续...`);
  }

  // 表不存在则执行建表脚本(幂等, 已存在的表不重复建)
  const sql = fs.readFileSync(SQL_PATH, 'utf8');
  await conn.query(sql);

  // 用户表为空 -> 初始化默认账号(密码 BCrypt 加密)
  const [[{ cnt }]] = await conn.query('SELECT COUNT(*) AS cnt FROM users');
  if (cnt === 0) {
    const users = [
      ['admin', 'admin123', '系统管理员', 'admin'],
      ['operator', '123456', '操作员', 'operator'],
    ];
    for (const [username, pwd, realName, role] of users) {
      const hash = await bcrypt.hash(pwd, 10);
      await conn.query(
        'INSERT INTO users (username, password, real_name, role) VALUES (?,?,?,?)',
        [username, hash, realName, role]
      );
    }
    console.log('已创建默认账号: admin/admin123, operator/123456');
  }

  await conn.end();
  return { dbName };
}

module.exports = { initDb };
