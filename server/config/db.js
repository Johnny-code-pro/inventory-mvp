// 数据库连接池(mysql2/promise)
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_mvp',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  decimalNumbers: true, // 让 DECIMAL 字段返回为数字而非字符串
  dateStrings: true, // 让 DATETIME/DATE 返回 'YYYY-MM-DD HH:mm:ss' 可读格式(不带 T/Z/毫秒)
});

module.exports = pool;
