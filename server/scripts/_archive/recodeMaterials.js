// 一次性脚本: 把导入自动建档的 ZZ-xxxx 物料编码改为 大类编码(CL/BZ/WL)
// 运行: node scripts/recodeMaterials.js
require('dotenv').config();
const pool = require('../config/db');
const { classifyCategory } = require('../utils/materialCat');

// 人工校正(按实际内容): 说明书/空白纸盒等归包装辅料
// key 为物料 id, 值覆盖为大类
const OVERRIDE = { 23: 'BZ', 24: 'BZ', 62: 'BZ' };

(async () => {
  const [rows] = await pool.query("SELECT id, name FROM materials WHERE code LIKE 'ZZ-%' ORDER BY id");
  if (!rows.length) { console.log('没有待重编码的 ZZ 物料'); process.exit(0); }

  const counter = { CL: 0, BZ: 0, WL: 0 };
  const updates = [];
  for (const r of rows) {
    const cat = OVERRIDE[r.id] || classifyCategory(r.name);
    counter[cat]++;
    const newCode = `${cat}-${String(counter[cat]).padStart(3, '0')}`;
    updates.push([newCode, r.id]);
  }

  // 先校验新编码不与库内现有编码冲突
  for (const [code] of updates) {
    const [dup] = await pool.query('SELECT id FROM materials WHERE code = ? AND id NOT IN (SELECT id FROM materials WHERE code LIKE "ZZ-%")', [code]);
    if (dup.length) { console.error(`编码冲突: ${code} 已被占用`); process.exit(1); }
  }

  for (const [code, id] of updates) {
    await pool.query('UPDATE materials SET code = ? WHERE id = ?', [code, id]);
  }
  console.log(`已重编码 ${updates.length} 条: CL=${counter.CL}, BZ=${counter.BZ}, WL=${counter.WL}`);
  process.exit(0);
})().catch((e) => { console.error('重编码失败:', e.message); process.exit(1); });
