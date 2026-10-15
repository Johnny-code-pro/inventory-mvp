// ============================================================
// 五工作表库存管理 Excel 模板生成脚本
// 运行: node scripts/generateFiveSheetExcel.js [入库原始文件] [输出路径]
// 工作表: 物料档案表 / BOM配方表 / 入库记录表 / 出库领料记录表 / 实时库存余额表
// 特性: 全部开启自动筛选, BOM批量领料公式, 库存余额SUMIFS, 库存不足条件格式标红
// ============================================================
const ExcelJS = require('exceljs');
const XLSX = require('xlsx');
const path = require('path');
const os = require('os');

const SRC_FILE = process.argv[2] || 'C:\\Users\\Johnny\\Desktop\\副本入库单.xlsx';
const OUT_FILE = process.argv[3] || path.join(os.homedir(), 'Desktop', '五表库存管理模板.xlsx');

// ---------- 物料清单(编码 名称 规格 单位 适用成品 安全库存[示例]) ----------
const materials = [
  { code: 'CL-001', name: '0.3拉簧', spec: '', unit: '个', products: '牙线盒', safety: 10000 },
  { code: 'CL-002', name: '0.2压簧', spec: '', unit: '个', products: '牙线盒', safety: 10000 },
  { code: 'CL-003', name: '磁铁', spec: 'D6*2', unit: '片', products: 'A款,B款', safety: 20000 },
  { code: 'CL-004', name: '磁铁', spec: 'D6*3', unit: '片', products: 'A款,B款', safety: 10000 },
  { code: 'CL-005', name: '201 中轴', spec: '10*0.4*340', unit: 'pcs', products: '340铝管,350铝轴', safety: 2000 },
  { code: 'CL-006', name: '201', spec: '10*0.4*350', unit: 'pcs', products: '350铝轴', safety: 2000 },
  { code: 'CL-007', name: 'EX 磁铁', spec: '250*55*1.5', unit: 'pcs', products: 'E款', safety: 1000 },
  { code: 'CL-008', name: 'M款 磁铁', spec: '249*60*2.0mm', unit: 'pcs', products: 'M金属款', safety: 500 },
  { code: 'CL-009', name: '不锈钢外壳', spec: '304', unit: 'pcs', products: 'M金属款', safety: 500 },
  { code: 'CL-010', name: 'SN 磁铁', spec: '165*58*1.5mm', unit: 'pcs', products: 'SN收纳盒', safety: 500 },
  { code: 'CL-011', name: 'B款 磁铁', spec: '159*28*1.5mm', unit: 'pcs', products: 'B款', safety: 1000 },
  { code: 'CL-012', name: 'B款 磁铁', spec: '54.6*28*1.5mm', unit: 'pcs', products: 'B款', safety: 1000 },
  { code: 'CL-013', name: '硅胶吸盘', spec: '', unit: '套', products: 'A款', safety: 1000 },
  { code: 'CL-014', name: 'CE100款 磁铁', spec: '265*58.5*1.5mm', unit: 'pcs', products: 'CE100款', safety: 200 },
  { code: 'CL-015', name: '条形磁铁', spec: '323*24*1.5', unit: '', products: 'A款', safety: 500 },
  { code: 'BZ-001', name: '子扣', spec: '6*6CM', unit: '包', products: '通用,E款,M款', safety: 10000 },
  { code: 'BZ-002', name: 'PVC导轨条', spec: '330MM', unit: '根', products: '通用', safety: 10000 },
  { code: 'BZ-003', name: '磨砂袋', spec: '牙线盒', unit: '个', products: '牙线盒', safety: 5000 },
  { code: 'BZ-004', name: '气泡袋', spec: '15*43CM', unit: '个', products: 'M金属款', safety: 2000 },
  { code: 'BZ-005', name: 'SN 磨砂袋', spec: '14.5*29cm', unit: 'CPE', products: 'SN收纳盒', safety: 1000 },
  { code: 'BZ-006', name: 'EX 磨砂袋', spec: '14.5*49cm', unit: 'CPE', products: 'E款,B款', safety: 1000 },
  { code: 'BZ-007', name: 'E款 中文', spec: '88*66*380mm', unit: '个', products: 'E款', safety: 2000 },
  { code: 'BZ-008', name: 'E款 英文', spec: '88*66*380mm', unit: '个', products: 'E款', safety: 2000 },
  { code: 'BZ-009', name: 'CE32 外箱', spec: '560*385*395mm', unit: '个', products: 'E款,B款', safety: 500 },
  { code: 'BZ-010', name: 'H款快递盒', spec: '222*105*410mm', unit: '个', products: '打包盒', safety: 1000 },
  { code: 'BZ-011', name: 'M+200M 纸盒', spec: '124*100*395mm', unit: '个', products: '打包盒', safety: 1000 },
  { code: 'BZ-012', name: 'M款彩盒-中文', spec: '', unit: '个', products: 'M金属款', safety: 500 },
  { code: 'BZ-013', name: 'M款彩盒-英文', spec: '', unit: '个', products: 'M金属款', safety: 500 },
  { code: 'BZ-014', name: '子扣', spec: '75C60*60方格', unit: '片', products: 'SA收纳盒', safety: 1000 },
  { code: 'BZ-015', name: '子扣', spec: '75C60*60方格（25mm)', unit: '包', products: 'SN收纳盒', safety: 1000 },
  { code: 'BZ-016', name: '保鲜膜 中文', spec: '30CM*100M', unit: '箱', products: '保鲜膜', safety: 100 },
  { code: 'BZ-017', name: '保鲜膜 中文', spec: '30CM*50M', unit: '箱', products: '保鲜膜', safety: 100 },
  { code: 'BZ-018', name: 'SA 磨砂袋', spec: '220*290', unit: 'CPE', products: 'SA收纳盒', safety: 500 },
  { code: 'BZ-019', name: '纸箱12', spec: '390*100*82mm', unit: '个', products: '打包盒', safety: 500 },
  { code: 'BZ-020', name: 'E100 说明书', spec: '', unit: '个', products: 'E款', safety: 2000 },
  { code: 'BZ-021', name: 'M20 外箱', spec: '400*380*410', unit: '个', products: 'M金属款', safety: 300 },
  { code: 'BZ-022', name: 'B款 英文纸盒', spec: '88*66*380mm', unit: '个', products: 'B款', safety: 1000 },
  { code: 'BZ-023', name: '英文纸盒', spec: '88*66*380mm', unit: '个', products: 'E款', safety: 2000 },
  { code: 'BZ-024', name: '保鲜膜 中文', spec: '30CM*150M', unit: '箱', products: '保鲜膜', safety: 100 },
  { code: 'BZ-025', name: '保鲜膜 中文', spec: '30CM*300M', unit: '箱', products: '保鲜膜', safety: 100 },
  { code: 'BZ-026', name: '保鲜膜 英文', spec: '30CM*50M', unit: '箱', products: '保鲜膜', safety: 100 },
  { code: 'BZ-027', name: '中文纸盒', spec: '88*66*380mm', unit: '个', products: 'E款', safety: 2000 },
  { code: 'BZ-028', name: '空白 纸盒', spec: '88*66*380mm', unit: '个', products: 'E款', safety: 500 },
  { code: 'BZ-029', name: 'CE32 外箱 空白', spec: '560*385*395mm', unit: '个', products: 'E款', safety: 200 },
  { code: 'BZ-030', name: '磨砂袋', spec: '', unit: 'CPE', products: 'A款', safety: 1000 },
  { code: 'BZ-031', name: '英文纸盒', spec: '80*80*190', unit: '个', products: 'SN收纳盒', safety: 1000 },
  { code: 'BZ-032', name: '中文纸盒', spec: '80*80*190', unit: '个', products: 'SN收纳盒', safety: 1000 },
  { code: 'BZ-033', name: 'SN 50 外箱', spec: '425*425*405', unit: '个', products: 'SN收纳盒', safety: 300 },
  { code: 'BZ-034', name: 'A40 外箱', spec: '465*395*410', unit: '个', products: 'A款', safety: 300 },
  { code: 'BZ-035', name: '英文纸盒', spec: '84*68*377mm', unit: '个', products: 'C款', safety: 500 },
  { code: 'BZ-036', name: '空白纸盒', spec: '84*68*377mm', unit: '个', products: 'C款', safety: 500 },
  { code: 'BZ-037', name: 'M+200M 空白', spec: '124*100*395mm', unit: '个', products: '打包盒', safety: 200 },
  { code: 'BZ-038', name: 'M两台装纸盒', spec: '150*100*390mm', unit: '个', products: '打包盒', safety: 200 },
  { code: 'WL-001', name: '安鼎物料', spec: '', unit: '套', products: 'M金属款,E款', safety: 500 },
];

const CLS = { CL: '原材料', BZ: '包装辅料', WL: '配套小件' };
const catOf = (code) => CLS[code.slice(0, 2)] || '';
const isCommon = (m) => (m.products || '').includes(',');

// ---------- BOM 配方(成品编码 成品名称 配件编码 配件名称 单件耗用) ----------
// 说明: 同一成品的配件行需连续排列, 供出库表 INDEX/MATCH 取用
const bom = [
  ['CP-A', 'A款收纳盒', 'CL-003', '磁铁', 2],
  ['CP-A', 'A款收纳盒', 'BZ-001', '子扣', 2],
  ['CP-A', 'A款收纳盒', 'BZ-002', 'PVC导轨条', 1],
  ['CP-A', 'A款收纳盒', 'CL-013', '硅胶吸盘', 4],
  ['CP-A', 'A款收纳盒', 'CL-015', '条形磁铁', 1],
  ['CP-A', 'A款收纳盒', 'BZ-034', 'A40外箱', 1],
  ['CP-B', 'B款收纳盒', 'CL-003', '磁铁', 1],
  ['CP-B', 'B款收纳盒', 'BZ-001', '子扣', 2],
  ['CP-B', 'B款收纳盒', 'CL-011', 'B款磁铁', 1],
  ['CP-B', 'B款收纳盒', 'CL-012', 'B款磁铁', 2],
  ['CP-B', 'B款收纳盒', 'BZ-022', 'B款英文纸盒', 1],
  ['CP-E', 'E款收纳盒', 'CL-007', 'EX磁铁', 1],
  ['CP-E', 'E款收纳盒', 'BZ-007', 'E款中文', 1],
  ['CP-E', 'E款收纳盒', 'BZ-008', 'E款英文', 1],
  ['CP-E', 'E款收纳盒', 'BZ-023', '英文纸盒', 1],
  ['CP-E', 'E款收纳盒', 'BZ-020', 'E100说明书', 1],
  ['CP-E', 'E款收纳盒', 'WL-001', '安鼎物料', 2],
  ['CP-M', 'M金属款', 'CL-009', '不锈钢外壳', 1],
  ['CP-M', 'M金属款', 'CL-008', 'M款磁铁', 1],
  ['CP-M', 'M金属款', 'BZ-012', 'M款彩盒中文', 1],
  ['CP-M', 'M金属款', 'BZ-004', '气泡袋', 1],
  ['CP-M', 'M金属款', 'WL-001', '安鼎物料', 1],
  ['CP-SN', 'SN收纳盒', 'CL-010', 'SN磁铁', 1],
  ['CP-SN', 'SN收纳盒', 'BZ-005', 'SN磨砂袋', 1],
  ['CP-SN', 'SN收纳盒', 'BZ-015', '子扣', 2],
  ['CP-SN', 'SN收纳盒', 'BZ-031', '英文纸盒', 1],
  ['CP-SN', 'SN收纳盒', 'BZ-033', 'SN50外箱', 1],
  ['CP-Y', '牙线盒', 'CL-001', '0.3拉簧', 1],
  ['CP-Y', '牙线盒', 'CL-002', '0.2压簧', 1],
  ['CP-Y', '牙线盒', 'BZ-003', '磨砂袋', 1],
];

const OUT_DIRECTIONS = ['A 款生产', 'B 款生产', 'E 款生产', 'M 金属款生产', '打包发货', '样品外发', '退换货'];

function styleHeader(ws) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF305496' } };
  row.height = 22;
  row.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

// Excel 日期序号转 Date
function excelDate(v) {
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400 * 1000));
  const s = String(v || '').trim();
  if (!s) return null;
  const d = new Date(s.replace(/\//g, '-'));
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  // 读取入库原始文件, 生成入库记录(按 名称|规格|单位 映射物料编码)
  const wbSrc = XLSX.readFile(SRC_FILE);
  const wsSrc = wbSrc.Sheets[wbSrc.SheetNames[0]];
  const srcRows = XLSX.utils.sheet_to_json(wsSrc, { header: 1, defval: '' });
  const codeMap = new Map(materials.map((m) => [`${m.name}|${m.spec}|${m.unit}`, m.code]));
  const inRecords = [];
  for (let i = 1; i < srcRows.length; i++) {
    const r = srcRows[i];
    const name = String(r[2] || '').trim();
    const spec = String(r[3] || '').trim();
    const unit = String(r[4] || '').trim();
    const qty = Number(r[5]);
    if (!name && !qty) continue;
    inRecords.push({
      date: excelDate(r[0]),
      code: codeMap.get(`${name}|${spec}|${unit}`) || '',
      name, spec, unit, qty,
      remark: String(r[6] || '').trim(),
      product: String(r[1] || '').trim(),
    });
  }

  const wb = new ExcelJS.Workbook();

  // ========== Sheet1 物料档案表 ==========
  const ws1 = wb.addWorksheet('物料档案表');
  ws1.columns = [
    { header: '物料编码', key: 'code', width: 12 },
    { header: '货物名称', key: 'name', width: 14 },
    { header: '规格及材质', key: 'spec', width: 22 },
    { header: '单位', key: 'unit', width: 8 },
    { header: '适用成品', key: 'products', width: 20 },
    { header: '物料大类', key: 'cat', width: 12 },
    { header: '是否通用', key: 'common', width: 10 },
    { header: '安全库存', key: 'safety', width: 10 },
    { header: '备注说明', key: 'note', width: 20 },
  ];
  styleHeader(ws1);
  for (const m of materials) {
    ws1.addRow([m.code, m.name, m.spec, m.unit, m.products, catOf(m.code), isCommon(m) ? '是' : '否', m.safety, isCommon(m) ? '多成品通用物料' : '']);
  }
  ws1.autoFilter = { from: 'A1', to: `I${materials.length + 1}` };

  // ========== Sheet2 BOM配方表 ==========
  const ws2 = wb.addWorksheet('BOM配方表');
  ws2.columns = [
    { header: '成品名称', key: 'pname', width: 14 },
    { header: '成品编码', key: 'pcode', width: 10 },
    { header: '配件物料编码', key: 'mcode', width: 14 },
    { header: '配件名称', key: 'mname', width: 16 },
    { header: '单件耗用数量', key: 'qty', width: 13 },
    { header: '备注', key: 'note', width: 20 },
  ];
  styleHeader(ws2);
  for (const [pcode, pname, mcode, mname, qty] of bom) {
    ws2.addRow([pname, pcode, mcode, mname, qty, '']);
  }
  ws2.autoFilter = { from: 'A1', to: `F${bom.length + 1}` };

  // ========== Sheet3 入库记录表 ==========
  const ws3 = wb.addWorksheet('入库记录表');
  ws3.columns = [
    { header: '入库单号', key: 'no', width: 16 },
    { header: '入库日期', key: 'date', width: 12 },
    { header: '物料编码', key: 'code', width: 12 },
    { header: '货物名称', key: 'name', width: 14 },
    { header: '规格材质', key: 'spec', width: 22 },
    { header: '单位', key: 'unit', width: 8 },
    { header: '入库数量', key: 'qty', width: 11 },
    { header: '供应商', key: 'supplier', width: 14 },
    { header: '入库备注', key: 'remark', width: 22 },
  ];
  styleHeader(ws3);
  ws3.getColumn('B').numFmt = 'yyyy/m/d';
  inRecords.forEach((rec, idx) => {
    const r = idx + 2;
    const no = `RK-${String(idx + 1).padStart(4, '0')}`;
    ws3.addRow([
      no,
      rec.date || new Date(),
      rec.code,
      { formula: `IF($C${r}="","",VLOOKUP($C${r},物料档案表!$A:$D,2,FALSE))` },
      { formula: `IF($C${r}="","",VLOOKUP($C${r},物料档案表!$A:$D,3,FALSE))` },
      { formula: `IF($C${r}="","",VLOOKUP($C${r},物料档案表!$A:$D,4,FALSE))` },
      rec.qty,
      '',
      rec.product ? `[成品:${rec.product}] ${rec.remark}`.trim() : rec.remark,
    ]);
  });
  ws3.autoFilter = { from: 'A1', to: `I${inRecords.length + 1}` };
  // 物料编码下拉
  const codeV = { type: 'list', allowBlank: true, formulae: ['物料档案表!$A$2:$A$500'], showErrorMessage: true, errorTitle: '无效编码', error: '请选择物料档案表中的编码' };
  for (let r = 2; r <= 500; r++) ws3.getCell(`C${r}`).dataValidation = codeV;

  // ========== Sheet4 出库领料记录表 ==========
  const ws4 = wb.addWorksheet('出库领料记录表');
  ws4.columns = [
    { header: '出库单号', key: 'no', width: 16 },
    { header: '出库日期', key: 'date', width: 12 },
    { header: '领料类型', key: 'type', width: 16 },
    { header: '成品编码', key: 'pcode', width: 10 },
    { header: '生产数量', key: 'pqty', width: 10 },
    { header: '物料编码', key: 'mcode', width: 12 },
    { header: '货物名称', key: 'name', width: 14 },
    { header: '规格材质', key: 'spec', width: 22 },
    { header: '单位', key: 'unit', width: 8 },
    { header: '出库数量', key: 'qty', width: 11 },
    { header: '出库方向', key: 'dir', width: 16 },
    { header: '领用人员', key: 'user', width: 12 },
    { header: '出库备注', key: 'remark', width: 20 },
  ];
  styleHeader(ws4);
  ws4.getColumn('B').numFmt = 'yyyy/m/d';
  // BOM 批量领料公式块(第2~11行, 最多10个配件): 在D2填成品编码、E2填生产数量, F~J自动带出
  // 其余列(单号/日期/领料类型/方向/人员/备注)由用户手动填写或下拉选择
  for (let k = 1; k <= 10; k++) {
    const r = k + 1;
    const off = k - 1;
    const base = `MATCH($D$2,'BOM配方表'!$B$2:$B$200,0)`;
    ws4.addRow([
      '', '', '', '', '',
      { formula: `IF($D$2="","",IFERROR(IF(INDEX('BOM配方表'!$B$2:$B$200,${base}+${off})=$D$2,INDEX('BOM配方表'!$C$2:$C$200,${base}+${off}),""),""))` },
      { formula: `IF($F${r}="","",IFERROR(VLOOKUP($F${r},物料档案表!$A:$D,2,FALSE),""))` },
      { formula: `IF($F${r}="","",IFERROR(VLOOKUP($F${r},物料档案表!$A:$D,3,FALSE),""))` },
      { formula: `IF($F${r}="","",IFERROR(VLOOKUP($F${r},物料档案表!$A:$D,4,FALSE),""))` },
      { formula: `IF($F${r}="","",IFERROR(INDEX('BOM配方表'!$E$2:$E$200,${base}+${off})*$E$2,""))` },
      '', '', '',
    ]);
  }
  ws4.autoFilter = { from: 'A1', to: 'M100' };
  // 领料类型 / 出库方向 / 物料编码下拉
  const typeV = { type: 'list', allowBlank: true, formulae: ['"单独领料,成品批量生产领料"'], showErrorMessage: true, errorTitle: '无效类型', error: '请选择领料类型' };
  const dirV = { type: 'list', allowBlank: true, formulae: [`"${OUT_DIRECTIONS.join(',')}"`], showErrorMessage: true, errorTitle: '无效方向', error: '请选择出库方向' };
  for (let r = 2; r <= 200; r++) {
    ws4.getCell(`C${r}`).dataValidation = typeV;
    ws4.getCell(`F${r}`).dataValidation = codeV;
    ws4.getCell(`K${r}`).dataValidation = dirV;
  }
  // 说明
  ws4.getCell('A102').value = '使用说明: 第2~11行为BOM批量生产领料区(D2填成品编码,E2填生产数量,自动带出配件); 单独领料请在12行起手动录入。';
  ws4.getCell('A102').font = { color: { argb: 'FF888888' }, italic: true };

  // ========== Sheet5 实时库存余额表 ==========
  const ws5 = wb.addWorksheet('实时库存余额表');
  ws5.columns = [
    { header: '物料编码', key: 'code', width: 12 },
    { header: '货物名称', key: 'name', width: 14 },
    { header: '规格材质', key: 'spec', width: 22 },
    { header: '单位', key: 'unit', width: 8 },
    { header: '适用成品', key: 'products', width: 20 },
    { header: '物料大类', key: 'cat', width: 12 },
    { header: '是否通用', key: 'common', width: 10 },
    { header: '期初库存', key: 'init', width: 10 },
    { header: '本期总入库', key: 'tin', width: 12 },
    { header: '本期总出库', key: 'tout', width: 12 },
    { header: '当前剩余库存', key: 'balance', width: 13 },
    { header: '安全库存', key: 'safety', width: 10 },
    { header: '库存状态', key: 'status', width: 11 },
  ];
  styleHeader(ws5);
  materials.forEach((m, i) => {
    const r = i + 2;
    ws5.addRow([
      m.code, m.name, m.spec, m.unit, m.products, catOf(m.code), isCommon(m) ? '是' : '否',
      0,
      { formula: `SUMIFS(入库记录表!$G:$G,入库记录表!$C:$C,$A${r})` },
      { formula: `SUMIFS(出库领料记录表!$J:$J,出库领料记录表!$F:$F,$A${r})` },
      { formula: `H${r}+I${r}-J${r}` },
      m.safety,
      { formula: `IF(K${r}<=L${r},"库存不足","正常")` },
    ]);
  });
  ws5.autoFilter = { from: 'A1', to: `M${materials.length + 1}` };
  // 库存不足整行标红(条件格式)
  ws5.addConditionalFormatting({
    ref: `A2:M${materials.length + 1}`,
    rules: [{
      type: 'expression',
      formulae: ['$K2<=$L2'],
      priority: 1,
      style: {
        fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' }, fgColor: { argb: 'FFFFC7CE' } },
        font: { color: { argb: 'FF9C0006' } },
      },
    }],
  });

  await wb.xlsx.writeFile(OUT_FILE);
  console.log('已生成:', OUT_FILE);
  console.log('物料数:', materials.length, '入库记录数:', inRecords.length, 'BOM行数:', bom.length);
}

main().catch((e) => { console.error('生成失败:', e.message); process.exit(1); });
