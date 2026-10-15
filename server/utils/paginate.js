// 安全解析分页参数, 防止非数字导致 LIMIT NaN
function parsePage(q) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize, 10) || 10));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

module.exports = { parsePage };
