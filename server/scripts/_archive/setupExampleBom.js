// 一次性: 按示例配方为产品配置BOM(按物料编码)
require('dotenv').config();
const pool = require('../config/db');

const recipes = [
  { productMatch: 'A款', items: [
    ['CL-003', 2], ['BZ-001', 2], ['BZ-002', 1], ['CL-013', 4], ['CL-015', 1], ['BZ-034', 1],
  ]},
  { productMatch: '金属款', items: [
    ['CL-009', 1], ['CL-008', 1], ['BZ-012', 1], ['BZ-004', 1], ['WL-001', 1],
  ]},
];

(async () => {
  for (const recipe of recipes) {
    const [prods] = await pool.query('SELECT id, code, name FROM products WHERE status=1 AND name LIKE ?', [`%${recipe.productMatch}%`]);
    for (const p of prods) {
      let added = 0, skipped = [];
      for (const [mcode, qty] of recipe.items) {
        const [mats] = await pool.query('SELECT id FROM materials WHERE code=? AND status=1', [mcode]);
        if (!mats.length) { skipped.push(mcode); continue; }
        await pool.query('INSERT INTO bom (product_id, material_id, qty_per) VALUES (?,?,?) ON DUPLICATE KEY UPDATE qty_per=VALUES(qty_per)', [p.id, mats[0].id, qty]);
        added++;
      }
      console.log(`${p.code} ${p.name}: 配方 ${added} 项` + (skipped.length ? `, 跳过: ${skipped.join(',')}` : ''));
    }
  }
  const [rows] = await pool.query('SELECT p.code, p.name, COUNT(b.id) cnt FROM products p LEFT JOIN bom b ON b.product_id=p.id GROUP BY p.id, p.code, p.name');
  console.log('验证:', rows.map((r) => `${r.code}:${r.cnt}配件`).join(', '));
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
