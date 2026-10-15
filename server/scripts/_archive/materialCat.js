// 物料大类识别: 按货物名称关键词推断 CL原材料 / BZ包装辅料 / WL配套小件
// 用于导入自动建档时的编码前缀(如 CL-001 / BZ-001 / WL-001)
const RULES = [
  { cat: 'WL', kws: ['安鼎'] }, // 配套小件(安鼎物料), 品牌最具体放最前
  { cat: 'CL', kws: ['磁铁', '拉簧', '压簧', '弹簧', '铝', '中轴', '不锈钢', '外壳', '硅胶', '吸盘'] }, // 原材料
  { cat: 'BZ', kws: ['彩盒', '纸盒', '外箱', '快递盒', '箱', '磨砂袋', '气泡袋', '袋', '说明书', '子扣', '保鲜膜', '导轨'] }, // 包装辅料
];

// 无法识别时默认按原材料 CL
function classifyCategory(name) {
  const n = String(name || '');
  for (const rule of RULES) {
    if (rule.kws.some((k) => n.includes(k))) return rule.cat;
  }
  return 'CL';
}

module.exports = { classifyCategory };
