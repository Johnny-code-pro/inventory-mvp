// ============================================================
// 四工作表库存管理 Excel 生成脚本
// 运行: node scripts/generateStockExcel.js [输出路径]
// 生成: 物料档案表 / 入库记录表 / 出库记录表 / 实时库存余额表
// 入库记录表按用户模板: 日期|成品|货物名称|规格及材质|单位|数量|备注
// 库存余额按 名称+规格+单位 自动匹配汇总
// ============================================================
const ExcelJS = require('exceljs');
const path = require('path');
const os = require('os');

// ---------- 物料档案示例(按大类整理, 可替换为真实数据) ----------
const materials = [
  // CL = 原材料
  { code: 'CL-001', name: '铝管', spec: '6063铝 25mm×1m', unit: '米', app: 'A款/E款', note: '' },
  { code: 'CL-002', name: '铝轴', spec: 'φ8mm', unit: '件', app: 'A款/B款', note: '' },
  { code: 'CL-003', name: '不锈钢外壳', spec: '304不锈钢', unit: '件', app: 'M金属款', note: '' },
  { code: 'CL-004', name: '拉簧', spec: '线径1.2mm 长50mm', unit: '个', app: 'A款/B款', note: '' },
  { code: 'CL-005', name: '压簧', spec: '线径1.5mm 长30mm', unit: '个', app: 'E款', note: '' },
  { code: 'CL-006', name: '磁铁', spec: 'D6×2mm 强磁', unit: '片', app: 'A款/B款', note: '多成品通用物料' },
  { code: 'CL-007', name: '硅胶吸盘', spec: '直径20mm', unit: '个', app: 'M金属款', note: '' },
  // BZ = 包装辅料
  { code: 'BZ-001', name: '彩盒', spec: 'A款专用彩盒', unit: '个', app: 'A款', note: '' },
  { code: 'BZ-002', name: '外箱', spec: '五层瓦楞 60×40×30cm', unit: '个', app: '通用', note: '多成品通用物料' },
  { code: 'BZ-003', name: '快递盒', spec: '13号 17×12×10cm', unit: '个', app: '通用', note: '多成品通用物料' },
  { code: 'BZ-004', name: '磨砂袋', spec: 'A4磨砂', unit: '个', app: '通用', note: '多成品通用物料' },
  { code: 'BZ-005', name: '气泡袋', spec: '20×30cm', unit: '个', app: '通用', note: '多成品通用物料' },
  { code: 'BZ-006', name: '说明书', spec: '中文版 4页', unit: '本', app: '通用', note: '多成品通用物料' },
  { code: 'BZ-007', name: '子扣', spec: '通用子扣', unit: '个', app: 'A款/B款/E款', note: '多成品通用物料' },
  { code: 'BZ-008', name: '保鲜膜', spec: '单卷 50米', unit: '卷', app: '通用', note: '多成品通用物料' },
  { code: 'BZ-009', name: '导轨条', spec: '1m通用导轨', unit: '根', app: 'A款/B款/E款/M款', note: '多成品通用物料' },
  // WL = 配套小件(安鼎物料)
  { code: 'WL-001', name: '安鼎螺钉', spec: 'M3×6', unit: '个', app: '通用', note: '安鼎物料' },
  { code: 'WL-002', name: '安鼎垫圈', spec: 'φ4', unit: '个', app: '通用', note: '安鼎物料' },
];

// 出库方向固定选项
const OUT_DIRECTIONS = ['A 款生产', 'B 款生产', 'E 款生产', 'M 金属款生产', '打包发货', '样品外发', '退换货'];

// 表头样式
function styleHeader(ws) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF305496' } };
  row.height = 22;
  row.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.views = [{ state: 'frozen', ySplit: 1 }]; // 冻结表头
}

async function main() {
  const wb = new ExcelJS.Workbook();

  // ========== Sheet1 物料档案表 ==========
  const ws1 = wb.addWorksheet('物料档案表');
  ws1.columns = [
    { header: '物料编码', key: 'code', width: 14 },
    { header: '货物名称', key: 'name', width: 16 },
    { header: '规格及材质', key: 'spec', width: 26 },
    { header: '单位', key: 'unit', width: 8 },
    { header: '适用成品', key: 'app', width: 20 },
    { header: '物料大类', key: 'cat', width: 12 },
    { header: '备注说明', key: 'note', width: 22 },
  ];
  styleHeader(ws1);
  for (const m of materials) {
    ws1.addRow([m.code, m.name, m.spec, m.unit, m.app, m.code.startsWith('CL') ? '原材料' : m.code.startsWith('BZ') ? '包装辅料' : '配套小件', m.note]);
  }

  // ========== Sheet2 入库记录表(用户模板: 日期|成品|货物名称|规格及材质|单位|数量|备注) ==========
  const ws2 = wb.addWorksheet('入库记录表');
  ws2.columns = [
    { header: '日期', key: 'date', width: 13 },
    { header: '成品', key: 'product', width: 18 },
    { header: '货物名称', key: 'name', width: 16 },
    { header: '规格及材质', key: 'spec', width: 26 },
    { header: '单位', key: 'unit', width: 8 },
    { header: '数量', key: 'qty', width: 11 },
    { header: '备注', key: 'remark', width: 22 },
  ];
  styleHeader(ws2);
  ws2.getColumn('A').numFmt = 'yyyy-mm-dd';
  const inSample = [
    [new Date(2026, 7, 8), 'A款 B款', '磁铁', 'D6*2', '片', 10000, '首批采购'],
    [new Date(2026, 7, 8), '通用款', '子扣', '6*6CM', '包', 5000, ''],
    [new Date(2026, 7, 9), '牙线盒', '磨砂袋', '牙线盒', '个', 20000, ''],
  ];
  for (const row of inSample) ws2.addRow(row);

  // ========== Sheet3 出库记录表(出库日期|出库方向|货物名称|规格及材质|单位|出库数量|出库备注) ==========
  const ws3 = wb.addWorksheet('出库记录表');
  ws3.columns = [
    { header: '出库日期', key: 'date', width: 13 },
    { header: '出库方向', key: 'direction', width: 18 },
    { header: '货物名称', key: 'name', width: 16 },
    { header: '规格及材质', key: 'spec', width: 26 },
    { header: '单位', key: 'unit', width: 8 },
    { header: '出库数量', key: 'qty', width: 11 },
    { header: '出库备注', key: 'remark', width: 22 },
  ];
  styleHeader(ws3);
  ws3.getColumn('A').numFmt = 'yyyy-mm-dd';
  const outSample = [
    [new Date(2026, 7, 9), 'A 款生产', '磁铁', 'D6*2', '片', 1000, '车间领用'],
    [new Date(2026, 7, 10), '打包发货', '磨砂袋', '牙线盒', '个', 5000, '发A款订单'],
  ];
  for (const row of outSample) ws3.addRow(row);
  // 出库方向下拉(第2~200行)
  const dirValidation = { type: 'list', allowBlank: true, formulae: [`"${OUT_DIRECTIONS.join(',')}"`], showErrorMessage: true, errorTitle: '无效出库方向', error: '请从下拉选项中选择出库方向' };
  for (let r = 2; r <= 200; r++) ws3.getCell(`B${r}`).dataValidation = dirValidation;

  // ========== Sheet4 实时库存余额表(按名称+规格+单位匹配) ==========
  const ws4 = wb.addWorksheet('实时库存余额表');
  ws4.columns = [
    { header: '货物名称', key: 'name', width: 16 },
    { header: '规格及材质', key: 'spec', width: 26 },
    { header: '单位', key: 'unit', width: 8 },
    { header: '适用成品', key: 'app', width: 20 },
    { header: '期初库存', key: 'init', width: 11 },
    { header: '本期总入库', key: 'tin', width: 12 },
    { header: '本期总出库', key: 'tout', width: 12 },
    { header: '当前剩余库存', key: 'balance', width: 13 },
    { header: '库存状态', key: 'status', width: 12 },
  ];
  styleHeader(ws4);
  // 期初库存示例(可自行修改), 按 名称|规格 定位
  const initStock = {
    '磁铁|D6×2mm 强磁': 500, '子扣|通用子扣': 200, '保鲜膜|单卷 50米': 50, '铝管|6063铝 25mm×1m': 100,
    '铝轴|φ8mm': 80, '不锈钢外壳|304不锈钢': 60, '拉簧|线径1.2mm 长50mm': 300, '压簧|线径1.5mm 长30mm': 150,
    '硅胶吸盘|直径20mm': 40, '彩盒|A款专用彩盒': 100, '外箱|五层瓦楞 60×40×30cm': 50, '快递盒|13号 17×12×10cm': 80,
    '磨砂袋|A4磨砂': 200, '气泡袋|20×30cm': 120, '说明书|中文版 4页': 60, '导轨条|1m通用导轨': 30,
    '安鼎螺钉|M3×6': 500, '安鼎垫圈|φ4': 500,
  };
  materials.forEach((m, i) => {
    const r = i + 2;
    const key = `${m.name}|${m.spec}`;
    ws4.addRow([
      m.name, m.spec, m.unit, m.app,
      initStock[key] || 0,
      { formula: `SUMIFS('入库记录表'!$F:$F,'入库记录表'!$C:$C,$A${r},'入库记录表'!$D:$D,$B${r},'入库记录表'!$E:$E,$C${r})` },
      { formula: `SUMIFS('出库记录表'!$F:$F,'出库记录表'!$C:$C,$A${r},'出库记录表'!$D:$D,$B${r},'出库记录表'!$E:$E,$C${r})` },
      { formula: `E${r}+F${r}-G${r}` },
      { formula: `IF(H${r}<0,"库存预警",IF(H${r}=0,"无库存","库存充足"))` },
    ]);
  });

  // ---------- 导出 ----------
  const outPath = process.argv[2] || path.join(os.homedir(), 'Desktop', '进销存四表_库存管理.xlsx');
  await wb.xlsx.writeFile(outPath);
  console.log('已生成:', outPath);
}

main().catch((e) => { console.error('生成失败:', e.message); process.exit(1); });
