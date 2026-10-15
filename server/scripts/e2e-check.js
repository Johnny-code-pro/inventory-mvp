// 进销存系统全链路 E2E 冒烟测试(在服务器上运行, 自包含: 建临时账号→跑测试→清理)
// 用法: cd server && node scripts/e2e-check.js
// 退出码: 0=全部通过, 1=有失败(供 cron/告警使用)
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const base = 'http://127.0.0.1:3000';
const results = [];
let adminToken = '', opToken = '', superToken = '';
let mid1 = null, mid2 = null, pid = null;

function db() {
  return mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1', user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
}

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return r.json();
}
async function stock(id, token) {
  const r = await api(`/api/inventory/${id}`, { token });
  return r.data ? Number(r.data.stock) : null;
}
function ok(cond, msg) { return { pass: !!cond, msg }; }

async function setupUsers() {
  const conn = await db();
  const hash = bcrypt.hashSync('Test123456', 10);
  await conn.query("DELETE FROM users WHERE username IN ('test_super','test_op')");
  await conn.query('INSERT INTO users (username, password, real_name, role) VALUES (?,?,?,?)', ['test_super', hash, '测试超管', 'superadmin']);
  await conn.query('INSERT INTO users (username, password, real_name, role) VALUES (?,?,?,?)', ['test_op', hash, '测试操作员', 'operator']);
  await conn.end();
}

async function cleanup() {
  const conn = await db();
  await conn.query("DELETE FROM flows WHERE material_id IN (SELECT id FROM materials WHERE code LIKE 'TEST-E2E-%')");
  await conn.query("DELETE FROM intransit WHERE material_id IN (SELECT id FROM materials WHERE code LIKE 'TEST-E2E-%')");
  await conn.query("DELETE FROM bom WHERE product_id IN (SELECT id FROM products WHERE code='TEST-PROD-01')");
  await conn.query("DELETE FROM products WHERE code='TEST-PROD-01'");
  await conn.query("DELETE FROM materials WHERE code LIKE 'TEST-E2E-%'");
  await conn.query("DELETE FROM users WHERE username IN ('test_super','test_op','E2E_user')");
  await conn.end();
}

async function main() {
  await setupUsers();

  // 1. 认证
  const l = await api('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'Admin2026' } });
  adminToken = l.data?.token;
  results.push(ok(l.code === 200, `登录成功 → ${l.code}`));
  const lb = await api('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'wrong' } });
  results.push(ok(lb.code === 400, `错误密码应400 → ${lb.code}`));
  opToken = (await api('/api/auth/login', { method: 'POST', body: { username: 'test_op', password: 'Test123456' } })).data?.token;
  superToken = (await api('/api/auth/login', { method: 'POST', body: { username: 'test_super', password: 'Test123456' } })).data?.token;
  results.push(ok(!!opToken && !!superToken, '操作员/超管登录'));

  // 2. 物料
  results.push(ok((await api('/api/materials', { method: 'POST', token: adminToken, body: { code: 'X' } })).code === 400, '物料缺名称应400'));
  const m1 = await api('/api/materials', { method: 'POST', token: adminToken, body: { code: 'TEST-E2E-01', name: 'E2E料A', spec: 'X', unit: '个', material_cat: '原材料', safety_stock: 10 } });
  mid1 = m1.data?.id;
  results.push(ok(m1.code === 200, '新增物料A'));
  results.push(ok((await api('/api/materials', { method: 'POST', token: adminToken, body: { code: 'TEST-E2E-01', name: '重复' } })).code === 400, '重复编码应400'));
  const m2 = await api('/api/materials', { method: 'POST', token: adminToken, body: { code: 'TEST-E2E-02', name: 'E2E料B', spec: 'Y', unit: '个', material_cat: '原材料', safety_stock: 0 } });
  mid2 = m2.data?.id;

  // 3. 产品/BOM
  const p = await api('/api/products', { method: 'POST', token: adminToken, body: { code: 'TEST-PROD-01', name: 'E2E成品' } });
  pid = p.data?.id;
  results.push(ok((await api(`/api/products/${pid}/bom`, { method: 'POST', token: adminToken, body: { material_id: mid1, qty_per: 2 } })).code === 200, 'BOM添加'));
  results.push(ok((await api(`/api/products/${pid}/bom`, { method: 'POST', token: adminToken, body: { material_id: mid1, qty_per: 1 } })).code === 400, 'BOM重复应400'));
  results.push(ok((await api('/api/products/calc-need', { method: 'POST', token: adminToken, body: { items: [{ product_id: pid, quantity: 5 }] } })).code === 200, '缺料计算'));

  // 4. 出入库
  await api('/api/flows/in', { method: 'POST', token: adminToken, body: { items: [{ material_id: mid1, quantity: 100 }] } });
  results.push(ok((await stock(mid1, adminToken)) === 100, '入库100=库存100'));
  results.push(ok((await api('/api/flows/out', { method: 'POST', token: adminToken, body: { items: [{ material_id: mid1, quantity: -5 }] } })).code === 400, '负数出库应400'));
  results.push(ok((await api('/api/flows/out', { method: 'POST', token: adminToken, body: { items: [{ material_id: mid1, quantity: 999 }] } })).code === 400, '超库存出库应400'));
  await api('/api/flows/out', { method: 'POST', token: adminToken, body: { items: [{ material_id: mid1, quantity: 30 }] } });
  results.push(ok((await stock(mid1, adminToken)) === 70, '出库30=库存70'));
  const fl = await api(`/api/flows?material_id=${mid1}&type=OUT&pageSize=5`, { token: adminToken });
  const outFlowId = fl.data?.list?.find((x) => x.status === 1)?.id;

  // 5. 退货
  results.push(ok((await api('/api/flows/in-return', { method: 'POST', token: adminToken, body: { items: [{ material_id: mid1, quantity: 999 }] } })).code === 400, '入库退货超库存应400'));
  await api('/api/flows/in-return', { method: 'POST', token: adminToken, body: { items: [{ material_id: mid1, quantity: 20 }] } });
  results.push(ok((await stock(mid1, adminToken)) === 50, '入库退货20=库存50'));
  await api('/api/flows/out-return', { method: 'POST', token: adminToken, body: { items: [{ material_id: mid1, quantity: 10 }] } });
  results.push(ok((await stock(mid1, adminToken)) === 60, '出库退货10=库存60'));

  // 6. 作废(权限)
  results.push(ok((await api(`/api/flows/${outFlowId}/void`, { method: 'POST', token: opToken, body: { reason: 'E2E' } })).code === 403, '操作员作废应403'));
  results.push(ok((await api(`/api/flows/${outFlowId}/void`, { method: 'POST', token: adminToken, body: { reason: 'E2E' } })).code === 200, '管理员作废'));

  // 7. 采购(权限+到货)
  results.push(ok((await api('/api/intransit', { method: 'POST', token: opToken, body: { material_id: mid2, quantity: 10 } })).code === 403, '操作员采购下单应403'));
  await api('/api/intransit', { method: 'POST', token: adminToken, body: { material_id: mid2, quantity: 50 } });
  const po = (await api('/api/intransit?status=0', { token: adminToken })).data?.find((x) => x.material_code === 'TEST-E2E-02');
  results.push(ok((await api(`/api/intransit/${po.id}/receive`, { method: 'POST', token: adminToken, body: { quantity: 999 } })).code === 400, '超量到货应400'));
  await api(`/api/intransit/${po.id}/receive`, { method: 'POST', token: adminToken, body: { quantity: 20 } });
  results.push(ok((await stock(mid2, adminToken)) === 20, '到货20=库存20'));

  // 8. 库存调整
  results.push(ok((await api('/api/inventory/adjust', { method: 'POST', token: adminToken, body: { material_id: mid1, target_stock: 500, reason: 'E2E' } })).code === 200, '库存调整'));

  // 9. 库存/流水/报表
  results.push(ok((await api('/api/inventory', { token: adminToken })).code === 200, '库存看板'));
  results.push(ok((await api('/api/inventory/stats', { token: adminToken })).code === 200, '库存统计'));
  results.push(ok((await api('/api/inventory/products', { token: adminToken })).code === 200, '可组装成品'));
  results.push(ok((await api('/api/flows?category=in_return', { token: adminToken })).code === 200, '退货流水筛选'));
  results.push(ok((await api('/api/report/trend', { token: adminToken })).code === 200, '趋势报表'));
  results.push(ok((await api('/api/report/stale', { token: adminToken })).code === 200, '呆滞库存'));

  // 10. 权限边界
  results.push(ok((await api('/api/export/full', { token: adminToken })).code === 403, '管理员导出应403'));
  results.push(ok((await api('/api/backup/list', { token: adminToken })).code === 403, '管理员备份应403'));
  results.push(ok((await api('/api/users', { token: adminToken })).code === 403, '管理员用户管理应403'));
  results.push(ok((await api('/api/export/full', { token: superToken })).code === 200, '超管导出'));
  results.push(ok((await api('/api/login-logs', { token: superToken })).code === 200, '超管登录日志'));

  // 11. 用户管理(超管)
  results.push(ok((await api('/api/users', { method: 'POST', token: superToken, body: { username: 'E2E_w', password: '123', role: 'operator' } })).code === 400, '弱密码应400'));
  results.push(ok((await api('/api/users', { method: 'POST', token: superToken, body: { username: 'E2E_user', password: 'Abcd1234', role: 'operator' } })).code === 200, '超管创建用户'));

  // 汇总
  const fail = results.filter((r) => !r.pass);
  console.log(`[E2E] ${results.length} 项: 通过 ${results.length - fail.length}, 失败 ${fail.length}`);
  fail.forEach((r) => console.log('  FAIL:', r.msg));

  await cleanup();
  process.exit(fail.length ? 1 : 0);
}

main().catch(async (e) => { console.error('[E2E] 脚本异常:', e.message); await cleanup().catch(() => {}); process.exit(1); });
