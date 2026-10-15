// 生成单据流水号: 类型(IN/OUT) + 日期 + 序号, 如 IN202608080001
// 用 flow_seq 序列表保证并发下原子自增, 不撞号; 序号超9999自动扩展位数
const pool = require('../config/db');

function pad(n) {
  return String(n).padStart(4, '0');
}

function today() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

// conn: 事务连接; type: 'IN' | 'OUT'
async function nextFlowNo(conn, type) {
  const prefix = `${type}-${today()}`;
  // 原子自增: INSERT...ON DUPLICATE KEY 借行锁保证同一前缀串行, 永不重复
  // 插入(新前缀 seq=1)或更新(seq=seq+1)后, 在同一事务内读取该行序号(行锁串行化并发)
  await conn.query(
    'INSERT INTO flow_seq (prefix, seq) VALUES (?, 1) ON DUPLICATE KEY UPDATE seq = seq + 1',
    [prefix]
  );
  const [[{ seq }]] = await conn.query('SELECT seq FROM flow_seq WHERE prefix = ?', [prefix]);
  // 格式: IN-20260813-0020 (类型-日期-序号), 可读性优先
  return `${prefix}-${pad(seq)}`;
}

module.exports = { nextFlowNo };
