// 生成五表库存管理模板的 Markdown 说明文档
// 运行: node scripts/makeFiveSheetDoc.js [xlsx路径] [md输出路径]
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const XLSX_PATH = process.argv[2] || path.join(__dirname, '..', '..', 'excel模板', '五表库存管理模板.xlsx');
const MD_PATH = process.argv[3] || path.join(__dirname, '..', '..', 'excel模板', '五表库存管理模板说明.md');

const fmtDate = (v) => {
  if (v instanceof Date) {
    const p = (n) => String(n).padStart(2, '0');
    return `${v.getFullYear()}/${p(v.getMonth() + 1)}/${p(v.getDate())}`;
  }
  return String(v || '').trim();
};

// 单元格取显示值(公式无缓存时返回公式字符串)
const cellVal = (cell) => {
  const v = cell.value;
  if (!v) return '';
  if (typeof v === 'object') {
    if (v.formula) return `=...`;
    if (v.result != null) return v.result;
    if (v.text != null) return v.text;
    return v;
  }
  return v;
};

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

function sheetToMd(ws, computeRows, note) {
  const headers = {};
  ws.getRow(1).eachCell({ includeEmpty: false }, (c, col) => { headers[col] = String(c.value || ''); });
  const maxCol = Math.max(0, ...Object.keys(headers).map(Number));
  const cols = [];
  for (let c = 1; c <= maxCol; c++) cols.push(headers[c] || '');
  let md = `| ${cols.join(' | ')} |\n`;
  md += `| ${cols.map(() => '---').join(' | ')} |\n`;
  for (let r = 2; r <= ws.rowCount; r++) {
    const vals = [];
    let empty = true;
    for (let c = 1; c <= maxCol; c++) {
      const cell = ws.getCell(r, c);
      let val = cellVal(cell);
      if (computeRows) val = computeRows(r, c, val);
      vals.push(esc(val));
      if (val !== '' && val !== '=...') empty = false;
    }
    if (empty) continue;
    md += `| ${vals.join(' | ')} |\n`;
  }
  if (note) md += `\n> ${note}\n`;
  return md;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);

  const ws1 = wb.getWorksheet('物料档案表');
  const ws2 = wb.getWorksheet('BOM配方表');
  const ws3 = wb.getWorksheet('入库记录表');
  const ws4 = wb.getWorksheet('出库领料记录表');
  const ws5 = wb.getWorksheet('实时库存余额表');

  // 物料档案 → 编码映射
  const matMap = new Map();
  for (let r = 2; r <= ws1.rowCount; r++) {
    const code = String(ws1.getCell(r, 1).value || '').trim();
    if (code) matMap.set(code, {
      name: String(ws1.getCell(r, 2).value || ''),
      spec: String(ws1.getCell(r, 3).value || ''),
      unit: String(ws1.getCell(r, 4).value || ''),
      products: String(ws1.getCell(r, 5).value || ''),
      cat: String(ws1.getCell(r, 6).value || ''),
      common: String(ws1.getCell(r, 7).value || ''),
      safety: Number(ws1.getCell(r, 8).value) || 0,
    });
  }

  // 入库/出库汇总(按编码)
  const tin = new Map(); const tout = new Map();
  const inRows = [];
  for (let r = 2; r <= ws3.rowCount; r++) {
    const code = String(ws3.getCell(r, 3).value || '').trim();
    const qty = Number(ws3.getCell(r, 7).value) || 0;
    if (!code && !qty) continue;
    const name = ws3.getCell(r, 4).value?.formula ? (matMap.get(code)?.name || '') : String(ws3.getCell(r, 4).value || '');
    const spec = ws3.getCell(r, 5).value?.formula ? (matMap.get(code)?.spec || '') : String(ws3.getCell(r, 5).value || '');
    const unit = ws3.getCell(r, 6).value?.formula ? (matMap.get(code)?.unit || '') : String(ws3.getCell(r, 6).value || '');
    inRows.push({ no: String(ws3.getCell(r, 1).value || ''), date: fmtDate(ws3.getCell(r, 2).value), code, name, spec, unit, qty, supplier: String(ws3.getCell(r, 8).value || ''), remark: String(ws3.getCell(r, 9).value || '') });
    tin.set(code, (tin.get(code) || 0) + qty);
  }
  for (let r = 2; r <= ws4.rowCount; r++) {
    const code = String(ws4.getCell(r, 6).value || '').trim();
    const qty = Number(ws4.getCell(r, 10).value) || 0;
    if (code && qty) tout.set(code, (tout.get(code) || 0) + qty);
  }

  let md = '';
  md += `# 五工作表库存管理模板说明\n\n`;
  md += `> 本模板依据《副本入库单.xlsx》原始数据生成：**${matMap.size} 个物料、${inRows.length} 条入库记录、${ws2.rowCount - 1} 行 BOM 配方**。\n\n`;
  md += `## 工作表一览\n\n`;
  md += `| 工作表 | 作用 | 自动筛选 |\n|---|---|---|\n`;
  md += `| 物料档案表 | 基础主数据(统一编码) | ✅ |\n`;
  md += `| BOM配方表 | 成品→配件耗用配方 | ✅ |\n`;
  md += `| 入库记录表 | 进货入库 | ✅ |\n`;
  md += `| 出库领料记录表 | 领料/生产出库(含BOM批量) | ✅ |\n`;
  md += `| 实时库存余额表 | 自动核算库存 | ✅ |\n\n`;

  md += `## 一、物料档案表\n\n`;
  md += sheetToMd(ws1, null, '筛选：按"物料大类"看原材料/包装/配套；按"适用成品"看某款成品物料；按"是否通用"看通用物料。');
  md += `\n## 二、BOM配方表\n\n`;
  md += sheetToMd(ws2, null, '同一成品的配件行连续排列，供出库表 INDEX/MATCH 批量取用。');
  md += `\n## 三、入库记录表\n\n`;
  md += `> 表头自动筛选。货物名称/规格材质/单位由 VLOOKUP 按物料编码自动带出。\n\n`;
  md += `| 入库单号 | 入库日期 | 物料编码 | 货物名称 | 规格材质 | 单位 | 入库数量 | 供应商 | 入库备注 |\n`;
  md += `| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
  for (const rec of inRows) {
    md += `| ${esc(rec.no)} | ${rec.date} | ${esc(rec.code)} | ${esc(rec.name)} | ${esc(rec.spec)} | ${esc(rec.unit)} | ${rec.qty} | ${esc(rec.supplier)} | ${esc(rec.remark)} |\n`;
  }
  md += `\n## 四、出库领料记录表\n\n`;
  md += `> 表头自动筛选。两种模式：\n`;
  md += `> - **单独领料**：第12行起手动录入(选物料编码+出库数量+出库方向)。\n`;
  md += `> - **BOM批量生产领料**：在第2行"成品编码"填 CP-A/CP-B/CP-E/CP-M/CP-SN/CP-Y，"生产数量"填台数，第2~11行自动带出该成品全部配件及其出库数量(单件耗用×生产数量)，一次多行扣减。\n\n`;
  md += `| 出库单号 | 出库日期 | 领料类型 | 成品编码 | 生产数量 | 物料编码 | 货物名称 | 规格材质 | 单位 | 出库数量 | 出库方向 | 领用人员 | 出库备注 |\n`;
  md += `| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
  md += `| 例 | 2026/5/7 | 成品批量生产领料 | CP-A | 100 | (自动) | (自动) | (自动) | (自动) | (自动) | A 款生产 | 张三 | 示例 |\n\n`;
  md += `### BOM 批量领料核心公式(第2~11行)\n\n`;
  md += `- 物料编码(F列)：\`IF(INDEX(BOM配方表!$B$2:$B$200,MATCH($D$2,BOM配方表!$B$2:$B$200,0)+行序)=$D$2,INDEX(BOM配方表!$C$2:$C$200,MATCH(...)+行序),"")\`\n`;
  md += `- 货物名称/规格材质/单位(G~I列)：\`VLOOKUP($F行,物料档案表!$A:$D,2|3|4,FALSE)\`\n`;
  md += `- 出库数量(J列)：\`INDEX(BOM配方表!$E$2:$E$200,MATCH(...)+行序)×$E$2(生产数量)\`\n`;
  md += `- 出库方向(K列)：下拉选 7 个固定方向。\n`;
  md += `\n## 五、实时库存余额表\n\n`;
  md += `> 表头自动筛选。**当前剩余 = 期初 + 入库 - 出库**；库存状态 \`IF(当前≤安全库存,"库存不足","正常")\`；库存不足整行条件格式标红。\n\n`;
  md += `| 物料编码 | 货物名称 | 规格材质 | 单位 | 适用成品 | 物料大类 | 是否通用 | 期初 | 本期入库 | 本期出库 | 当前剩余 | 安全库存 | 库存状态 |\n`;
  md += `| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
  for (const [code, m] of matMap) {
    const ti = tin.get(code) || 0;
    const to = tout.get(code) || 0;
    const bal = ti - to;
    const status = bal <= m.safety ? '⚠️ 库存不足' : '✅ 正常';
    md += `| ${code} | ${esc(m.name)} | ${esc(m.spec)} | ${esc(m.unit)} | ${esc(m.products)} | ${m.cat} | ${m.common} | 0 | ${ti} | ${to} | ${bal} | ${m.safety} | ${status} |\n`;
  }
  md += `\n### 核心公式\n\n`;
  md += `- 本期总入库：\`SUMIFS(入库记录表!$G:$G,入库记录表!$C:$C,$A2)\`\n`;
  md += `- 本期总出库：\`SUMIFS(出库领料记录表!$J:$J,出库领料记录表!$F:$F,$A2)\`\n`;
  md += `- 当前剩余：\`期初+本期入库-本期出库\`；库存状态：\`IF(当前≤安全库存,"库存不足","正常")\`\n`;
  md += `\n## Excel 自动筛选设置\n\n`;
  md += `5 个工作表表头已内置自动筛选(表头行右侧有下拉箭头)。若重新生成或需要手动开启：选中表头行 → 菜单「数据」→「筛选」。\n\n`;
  md += `- 物料档案表：按"物料大类 / 适用成品 / 是否通用"筛选，或直接搜索物料名称。\n`;
  md += `- 库存余额表：按"库存状态"一键筛出库存不足；按"适用成品"看某成品配件；按"当前剩余"升序排序优先补货。\n`;
  md += `- 入库表：按日期范围筛选、按物料编码筛选。\n`;
  md += `- 出库表：按"出库方向"筛选(统计某成品领料总量)、按日期筛选。\n`;
  md += `\n## 使用顺序\n\n`;
  md += `1. 完善**物料档案表**(编码唯一，通用物料标"是")\n`;
  md += `2. 录入**BOM配方表**(成品→配件+单件耗用)\n`;
  md += `3. 录入**入库记录表**(进货)\n`;
  md += `4. 日常**出库领料**：单独领料或 BOM 批量领料\n`;
  md += `5. **实时库存余额表**自动核算，按库存状态筛选补货\n\n`;
  md += `> 编码规则：\`大类编码-流水号\`。CL=原材料，BZ=包装辅料，WL=配套小件。共用物料只建一条档案、一个编码，领用不同成品靠"出库方向"区分，只扣减总库存。\n`;

  fs.writeFileSync(MD_PATH, md, 'utf8');
  console.log('已生成说明文档:', MD_PATH);
  console.log('文档大小:', (fs.statSync(MD_PATH).size / 1024).toFixed(1), 'KB');
}

main().catch((e) => { console.error('生成失败:', e.message); process.exit(1); });
