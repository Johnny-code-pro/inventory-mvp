// 一次性: 按现有流水号前缀回填 flow_seq 序列表
require('dotenv').config();
const pool = require('../config/db');

(async () => {
  const [rows] = await pool.query("SELECT flow_no FROM flows WHERE flow_no RLIKE '^[A-Z]+[0-9]{8}[0-9]+$'");
  const map = {};
  for (const r of rows) {
    const m = r.flow_no.match(/^([A-Z]+[0-9]{8})([0-9]+)$/);
    if (m) {
      const seq = parseInt(m[2], 10);
      if (!map[m[1]] || map[m[1]] < seq) map[m[1]] = seq;
    }
  }
  await pool.query('DELETE FROM flow_seq');
  for (const [prefix, seq] of Object.entries(map)) {
    await pool.query('INSERT INTO flow_seq (prefix, seq) VALUES (?,?)', [prefix, seq]);
  }
  console.log('回填完成:', Object.keys(map).length, '个前缀');
  const [check] = await pool.query('SELECT * FROM flow_seq ORDER BY prefix');
  console.log(check.map((x) => `${x.prefix}=${x.seq}`).join(', '));
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
