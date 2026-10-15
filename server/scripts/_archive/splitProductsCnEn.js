// 一次性: 每个款拆成中文版+英文版两个产品, 各配对应盒子
// A款无盒; B款: 中文版=中文纸盒/英文版=B款英文纸盒; E款: 中文版=中文纸盒/英文版=英文纸盒+E100说明书; M款: M款彩盒中/英文
require('dotenv').config();
const pool = require('../config/db');

const BOX = { CN: 43, EN: 37, B_EN: 35, M_CN: 20, M_EN: 21, E100: 33 }; // 中文纸盒, 英文纸盒, B款英文纸盒, M款彩盒-中文, M款彩盒-英文, E100说明书

// base产品: id, code, name, boxForCn, boxForEn, extraForEn
const bases = [
  { id: 2, code: 'CP-A', name: 'A款', cn: null, en: null, extra: null },
  { id: 3, code: 'CP-B1', name: 'B款-白色', cn: BOX.CN, en: BOX.B_EN, extra: null },
  { id: 5, code: 'CP-B2', name: 'B款-红色', cn: BOX.CN, en: BOX.B_EN, extra: null },
  { id: 4, code: 'CP-B3', name: 'B款-奶咖', cn: BOX.CN, en: BOX.B_EN, extra: null },
  { id: 6, code: 'CP-E1', name: 'E款-灰色', cn: BOX.CN, en: BOX.EN, extra: BOX.E100 },
  { id: 7, code: 'CP-E2', name: 'E款-竹纹', cn: BOX.CN, en: BOX.EN, extra: BOX.E100 },
  { id: 8, code: 'CP-E3', name: 'E款-透明', cn: BOX.CN, en: BOX.EN, extra: BOX.E100 },
  { id: 9, code: 'CP-M', name: 'M款', cn: BOX.M_CN, en: BOX.M_EN, extra: null },
];

(async () => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let productCount = 0, bomCount = 0;
    for (const b of bases) {
      // 取该款现有塑料件配方(排除纸盒, 只复制塑料件)
      const [parts] = await conn.query(
        'SELECT material_id, qty_per FROM bom WHERE product_id=?',
        [b.id]
      );
      const plasticParts = parts.filter((p) => ![BOX.CN, BOX.EN, BOX.B_EN, BOX.M_CN, BOX.M_EN, BOX.E100].includes(p.material_id));

      for (const [suffix, box] of [['中文', b.cn], ['英文', b.en]]) {
        const code = `${b.code}-${suffix === '中文' ? 'CN' : 'EN'}`;
        const name = `${b.name}-${suffix}`;
        const [ins] = await conn.query('INSERT INTO products (code, name, created_by) VALUES (?,?,1)', [code, name]);
        const pid = ins.insertId;
        productCount++;
        // 复制塑料件
        for (const p of plasticParts) {
          await conn.query('INSERT INTO bom (product_id, material_id, qty_per) VALUES (?,?,?)', [pid, p.material_id, p.qty_per]);
          bomCount++;
        }
        // 加盒子(英文版可能有额外件如E100说明书)
        if (box) {
          await conn.query('INSERT INTO bom (product_id, material_id, qty_per) VALUES (?,?,1)', [pid, box]);
          bomCount++;
        }
        if (suffix === '英文' && b.extra) {
          await conn.query('INSERT INTO bom (product_id, material_id, qty_per) VALUES (?,?,1)', [pid, b.extra]);
          bomCount++;
        }
        console.log(`  新建 ${name} (${code})`);
      }
    }

    // 清理原产品上误加的纸盒(中文/英文/B款英文纸盒/E100, 保留塑料件)
    const boxIds = [BOX.CN, BOX.EN, BOX.B_EN, BOX.M_CN, BOX.M_EN, BOX.E100];
    const [del] = await conn.query(
      `DELETE FROM bom WHERE material_id IN (${boxIds.join(',')}) AND product_id IN (${bases.map((b) => b.id).join(',')})`
    );
    console.log('已清理原产品误加纸盒:', del.affectedRows, '条');

    await conn.commit();
    console.log(`=== 完成: 新建${productCount}个产品, ${bomCount}条BOM ===`);
  } catch (e) {
    await conn.rollback();
    console.error('失败已回滚:', e.message);
    process.exit(1);
  } finally {
    conn.release();
  }
})();
