<template>
  <router-view />
</template>

<script setup>
// 根组件: 仅承载路由出口
</script>

<style>
/* ===== 主题变量 ===== */
:root {
  --app-bg: #f5f5f7;
  --app-text: #1d1d1f;
  --app-text-2: #6e6e73;
  --app-text-3: #86868b;
  --app-sidebar-bg: rgba(245, 245, 247, .92);
  --app-logo-text: #1d1d1f;
  --app-card-bg: #ffffff;
  --app-card-border: #e5e5e7;
  --app-table-header: #fafafa;
  --app-input-bg: #f8fafc;
  --app-input-border: #dfe3ea;
  --app-soft-primary: #eaf4fe;
  --app-soft-success: #e9f9ef;
  --app-soft-warning: #fff7eb;
  --app-soft-danger: #fff1f0;
  --app-danger-border: #ffccc7;
  --app-danger-text: #cf1322;
  --app-shadow: 0 12px 32px rgba(30, 41, 59, .06);
  /* 主色: 苹果蓝 */
  --el-color-primary: #0071e3;
  --el-color-primary-light-3: #4095e6;
  --el-color-primary-light-5: #7ab8f0;
  --el-color-primary-light-7: #b3d7f7;
  --el-color-primary-light-8: #d4e8fb;
  --el-color-primary-light-9: #eaf4fe;
  --el-color-primary-dark-2: #005bb8;
}
html.dark {
  --app-bg: #101114;
  --app-text: #f5f5f7;
  --app-text-2: #a1a1a6;
  --app-text-3: #8e8e93;
  --app-sidebar-bg: rgba(29, 29, 31, .94);
  --app-logo-text: #f5f5f7;
  --app-card-bg: #1d1d1f;
  --app-card-border: rgba(255, 255, 255, .1);
  --app-table-header: rgba(255, 255, 255, .06);
  --app-input-bg: rgba(255, 255, 255, .06);
  --app-input-border: rgba(255, 255, 255, .14);
  --app-soft-primary: rgba(0, 113, 227, .18);
  --app-soft-success: rgba(52, 199, 89, .16);
  --app-soft-warning: rgba(255, 159, 10, .16);
  --app-soft-danger: rgba(255, 77, 79, .16);
  --app-danger-border: rgba(255, 120, 117, .38);
  --app-danger-text: #ff7875;
  --app-shadow: 0 16px 40px rgba(0, 0, 0, .24);
  --el-color-primary: #409eff;
  --el-color-primary-light-3: #66b1ff;
  --el-color-primary-light-5: #79bbff;
  --el-color-primary-light-7: #a0cfff;
  --el-color-primary-light-8: #b3d8ff;
  --el-color-primary-light-9: #d9ecff;
  --el-color-primary-dark-2: #337ecc;
}

body {
  margin: 0; background: var(--app-bg); color: var(--app-text);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  -webkit-font-smoothing: antialiased;
  transition: background-color .2s ease, color .2s ease;
}

#app { min-height: 100vh; }

::selection { color: #fff; background: var(--el-color-primary); }

/* ===== 苹果风格卡片 ===== */
.el-card {
  border: 1px solid var(--app-card-border);
  border-radius: 16px;
  background-color: var(--app-card-bg);
  box-shadow: var(--app-shadow);
  transition: border-color .2s ease, box-shadow .2s ease;
}
.el-card:hover { border-color: color-mix(in srgb, var(--el-color-primary) 22%, var(--app-card-border)); }
.el-dialog {
  border-radius: 16px;
  background-color: var(--app-card-bg);
  box-shadow: 0 12px 40px rgba(0, 0, 0, .12);
}
.el-input__wrapper, .el-textarea__inner {
  background: var(--app-input-bg);
  box-shadow: 0 0 0 1px var(--app-input-border) inset;
}
.el-input__wrapper.is-focus, .el-textarea__inner:focus {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset, 0 0 0 3px rgba(0, 113, 227, .12);
}
/* 表格表头浅灰 */
.el-table { --el-table-header-bg-color: var(--app-table-header); }

/* 苹果按钮: 圆角 + 纯色过渡 */
.el-button { border-radius: 10px; transition: background-color .25s ease, color .25s ease, border-color .25s ease; }

/* 移动端排版优化 */
@media (max-width: 992px) {
  /* 卡片表头纵向堆叠 */
  .card-header { flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }
  .header-right { width: 100% !important; flex-wrap: wrap !important; }
  /* 筛选/表单行允许换行 */
  .filters, .add-bom { flex-wrap: wrap !important; gap: 8px !important; }
  /* 录单行: 手机端纯纵向堆叠(选择→数量→单位+删除), 杜绝挤压 */
  .item-row { display: flex !important; flex-direction: column !important; align-items: stretch !important; gap: 6px !important; padding: 8px !important; border: 1px solid #ebeef5 !important; border-radius: 6px !important; background: #fafafa !important; }
  .item-row > .el-select, .item-row > .el-input-number { width: 100% !important; max-width: 100% !important; }
  .item-row > .el-tag { align-self: flex-start !important; }
  .item-row > .el-button { align-self: flex-end !important; }
  .item-row { border-color: var(--app-card-border) !important; background: var(--app-table-header) !important; }
  /* 模式切换按钮: 均分整行, 自动换行不溢出 */
  .header-right .el-radio-group { display: flex !important; width: 100% !important; flex-wrap: wrap !important; }
  .header-right .el-radio-button { flex: 1 1 45% !important; margin-bottom: 4px !important; }
  .header-right .el-radio-button__inner { width: 100% !important; justify-content: center; display: flex; align-items: center; }
  /* 卡片内边距收紧 */
  .el-card__body { padding: 12px 10px !important; }
  /* 修复 flex 溢出: 允许子项收缩(默认 min-width:auto 会阻止收缩导致溢出屏幕) */
  .el-form-item, .item-list, .item-row, .item-row > * { min-width: 0 !important; max-width: 100% !important; }
  /* 添加物料按钮整行显示, 不再溢出 */
  .item-list > .el-button { width: 100% !important; margin: 0 !important; }
  /* 表单: 标签上移, 控件占满整行, 避免标签和输入框挤 */
  .el-form-item { margin-bottom: 12px !important; }
  .el-form-item__label { display: block !important; width: 100% !important; text-align: left !important; padding-bottom: 2px !important; line-height: 1.5 !important; }
  .el-form-item__content { margin-left: 0 !important; }
  .el-select, .el-input-number, .el-input, .el-date-editor { max-width: 100% !important; }
  /* 表格更紧凑, 仍可横向滑动 */
  .el-table { font-size: 12px !important; }
  .el-table .el-table__cell { padding: 6px 4px !important; }
  /* 弹窗/分页 */
  .el-dialog { width: 92% !important; }
  .el-pagination { justify-content: center !important; flex-wrap: wrap !important; }
  .el-statistic__content { font-size: 18px !important; }
}
</style>
