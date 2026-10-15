// 一次性: 新建注塑零件物料档案 + 8个成品BOM + 加入库存
// 规则: 库存=各次出现数量之和; BOM单件耗用默认1, M款-中轴=2; 百折括号笔误合并; 零件归原材料(CL)
require('dotenv').config();
const pool = require('../config/db');

// 8个成品配方: [成品名, [[零件名, 材质/颜色, 库存量, 单件耗用], ...]]
const products = [
  { name: 'A款', items: [
    ['A2款前盖(条形磁吸版)', 'ABS/齐家白色', 2000, 1], ['A款后壳(经典版)', 'ABS/齐家白色', 2000, 1],
    ['A款中壳', 'ABS/灰色', 2000, 1], ['A款左中轴', 'ABS/灰色', 2000, 1], ['A款右中轴', 'ABS/灰色', 2000, 1],
    ['A款左支架', 'ABS/灰色', 2000, 1], ['A款右支架', 'ABS/灰色', 2000, 1],
    ['刀头', 'ABS/齐家白色', 2000, 1], ['百折(加增韧剂)', 'PP本色', 2000, 1],
  ]},
  { name: 'B款-齐家白', items: [
    ['B款-前盖', 'ABS/齐家白色', 2000, 1], ['B款-后壳', 'ABS/齐家白色', 2000, 1], ['B款-中壳', 'ABS/灰色', 2000, 1],
    ['B款-底座左', 'ABS/灰色', 2000, 1], ['B款-底座右', 'ABS/灰色', 2000, 1],
    ['B款-左中轴', 'ABS/灰色', 2000, 1], ['B款-右中轴', 'ABS/灰色', 2000, 1],
    ['刀头', 'ABS/齐家白色', 2000, 1], ['百折(加增韧剂)', 'PP本色', 2000, 1],
  ]},
  { name: 'B款-米白YC5229', items: [
    ['B款-前盖', 'ABS/米白色YC5229', 2000, 1], ['B款-后壳', 'ABS/米白色YC5229', 2000, 1], ['B款-中壳', 'ABS/浅棕色YC5230', 2000, 1],
    ['B款-底座左', 'ABS/浅棕色YC5230', 2000, 1], ['B款-底座右', 'ABS/浅棕色YC5230', 2000, 1],
    ['B款-左中轴', 'ABS/浅棕色YC5230', 2000, 1], ['B款-右中轴', 'ABS/浅棕色YC5230', 2000, 1],
    ['刀头', 'ABS/米白色YC5229', 2000, 1], ['百折(加增韧剂)', 'PP本色', 2000, 1],
  ]},
  { name: 'B款-中国红', items: [
    ['B款-前盖', 'ABS/中国红色', 1000, 1], ['B款-后壳', 'AS/中国红色', 1000, 1], ['B款-中壳', 'ABS/黑色', 1000, 1],
    ['B款-底座左', 'ABS/黑色', 1000, 1], ['B款-底座右', 'ABS/黑色', 1000, 1],
    ['B款-左中轴', 'ABS/黑色', 1000, 1], ['B款-右中轴', 'ABS/黑色', 1000, 1],
    ['刀头', 'ABS/中国红色', 1000, 1], ['百折(加增韧剂)', 'PP本色', 1000, 1],
  ]},
  { name: 'E款-E1灰色盖', items: [
    ['E款-方型下壳', 'ABS/齐家白色', 2000, 1], ['E1款-方型上盖', 'ABS/灰色', 2000, 1],
    ['E款-左轴', 'ABS/灰色', 2000, 1], ['E款-右轴', 'ABS/灰色', 2000, 1], ['刀头', 'ABS/齐家白色', 2000, 1],
  ]},
  { name: 'E款-E2竹纹盖', items: [
    ['E款-方型下壳', 'ABS/齐家白色', 2000, 1], ['E2款-方型上盖', 'ABS/竹纹', 2000, 1],
    ['E款-左轴', 'ABS/灰色', 2000, 1], ['E款-右轴', 'ABS/灰色', 2000, 1], ['刀头', 'ABS/齐家白色', 2000, 1],
  ]},
  { name: 'E款-E3透明盖', items: [
    ['E款-方型下壳', 'ABS/齐家白色', 2000, 1], ['E3款-方型上盖', 'ABS/透明', 2000, 1],
    ['E款-左轴', 'ABS/灰色', 2000, 1], ['E款-右轴', 'ABS/灰色', 2000, 1], ['刀头', 'ABS/齐家白色', 2000, 1],
  ]},
  { name: 'M款', items: [
    ['M款-底座', 'ABS/黑色', 2000, 1], ['M款-主体', 'ABS/黑色', 2000, 1], ['M款-上盖', 'ABS920/黑透', 2000, 1],
    ['M款-中轴', 'ABS/黑色', 4000, 2], ['M款-刀头', 'ABS/电镀银色', 2000, 1],
  ]},
];

async function nextFlowNo(conn, type) {
  const d = new Date(); const p = (x) => String(x).padStart(2, '0');
  const prefix = type + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
  await conn.query('INSERT INTO flow_seq (prefix, seq) VALUES (?,1) ON DUPLICATE KEY UPDATE seq = seq + 1', [prefix]);
  const [[r]] = await conn.query('SELECT seq FROM flow_seq WHERE prefix=?', [prefix]);
  return prefix + String(r.seq).padStart(4, '0');
}

(async () => {
  // 汇总物料库存: key = 零件名|材质/颜色
  const matMap = new Map();
  for (const pr of products) {
    for (const [name, mat, qty] of pr.items) {
      const key = `${name}|${mat}`;
      if (!matMap.has(key)) matMap.set(key, { name, mat, qty: 0 });
      matMap.get(key).qty += qty;
    }
  }
  const mats = [...matMap.values()];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. 建物料档案(CL类, 从现有最大CL继续)
    const [maxRow] = await conn.query("SELECT MAX(CAST(SUBSTRING(code,4) AS UNSIGNED)) m FROM materials WHERE code LIKE 'CL-%'");
    let seq = (maxRow[0].m || 0) + 1;
    const matIdMap = new Map(); // key -> material_id
    const matCodeMap = new Map();
    for (const m of mats) {
      const code = `CL-${String(seq).padStart(3, '0')}`;
      const [ins] = await conn.query(
        'INSERT INTO materials (code, name, spec, unit, category, safety_stock, created_by) VALUES (?,?,?,?,?,0,1)',
        [code, m.name, m.mat, '个', '原材料']
      );
      matIdMap.set(`${m.name}|${m.mat}`, ins.insertId);
      matCodeMap.set(`${m.name}|${m.mat}`, code);
      seq++;
    }
    console.log('已建物料:', mats.length, '个 (CL-019 ~ CL-' + String(seq - 1).padStart(3, '0') + ')');

    // 2. 建8个成品
    const prodIdMap = new Map();
    const prodCodes = ['CP-A', 'CP-B1', 'CP-B2', 'CP-B3', 'CP-E1', 'CP-E2', 'CP-E3', 'CP-M'];
    for (let i = 0; i < products.length; i++) {
      const [ins] = await conn.query('INSERT INTO products (code, name, created_by) VALUES (?,?,1)', [prodCodes[i], products[i].name]);
      prodIdMap.set(products[i].name, ins.insertId);
    }
    console.log('已建成品:', products.length, '个');

    // 3. 建BOM(按成品名匹配)
    let bomCount = 0;
    for (const pr of products) {
      const pid = prodIdMap.get(pr.name);
      for (const [name, mat, , qtyPer] of pr.items) {
        const mid = matIdMap.get(`${name}|${mat}`);
        await conn.query('INSERT INTO bom (product_id, material_id, qty_per) VALUES (?,?,?)', [pid, mid, qtyPer]);
        bomCount++;
      }
    }
    console.log('已建BOM:', bomCount, '条');

    // 4. 加入库存(每种零件 = 各次之和)
    let flowCount = 0;
    for (const m of mats) {
      const mid = matIdMap.get(`${m.name}|${m.mat}`);
      const flowNo = await nextFlowNo(conn, 'IN');
      await conn.query(
        'INSERT INTO flows (flow_no, material_id, type, quantity, counterparty, purpose, operator_id) VALUES (?,?,?,?,?,?,1)',
        [flowNo, mid, 'IN', m.qty, '', '[零件期初入库]', 1]
      );
      flowCount++;
    }
    console.log('已入库:', flowCount, '笔');

    await conn.commit();
    console.log('=== 全部完成 ===');
    // 输出物料对照
    for (const m of mats) console.log(`  ${matCodeMap.get(`${m.name}|${m.mat}`)} ${m.name} | ${m.mat} | 库存 ${m.qty}`);
  } catch (e) {
    await conn.rollback();
    console.error('失败已回滚:', e.message);
    process.exit(1);
  } finally {
    conn.release();
  }
})();
