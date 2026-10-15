<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>出入库流水台账</span>
        <div class="filters">
          <el-select v-model="query.type" placeholder="类型" clearable style="width: 110px">
            <el-option label="入库" value="IN" /><el-option label="出库" value="OUT" />
          </el-select>
          <el-select v-model="query.category" placeholder="类别" clearable style="width: 120px">
            <el-option label="普通" value="normal" />
            <el-option label="入库退货" value="in_return" />
            <el-option label="出库退货" value="out_return" />
          </el-select>
          <el-select v-model="query.material_id" placeholder="物料" filterable clearable style="width: 220px">
            <el-option v-for="m in materials" :key="m.id" :label="`${m.code} ${m.name}`" :value="m.id" />
          </el-select>
          <el-date-picker
            v-model="dateRange" type="daterange" value-format="YYYY-MM-DD"
            start-placeholder="开始日期" end-placeholder="结束日期" style="width: 260px"
          />
          <el-button type="primary" :icon="Search" @click="load(1)">查询</el-button>
          <el-button :icon="Download" :loading="exporting" @click="exportExcel">导出Excel</el-button>
        </div>
      </div>
    </template>

    <el-table :data="list" border stripe v-loading="loading" max-height="560" :row-class-name="rowClass">
      <el-table-column prop="flow_no" label="流水号" width="160" />
      <el-table-column prop="created_at" label="单据时间" width="165" />
      <el-table-column label="类型" width="80">
        <template #default="{ row }">
          <el-tag :type="row.type === 'IN' ? 'success' : 'warning'">{{ row.type === 'IN' ? '入库' : '出库' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="类别" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.category === 'in_return'" type="danger" size="small">入库退货</el-tag>
          <el-tag v-else-if="row.category === 'out_return'" type="warning" size="small">出库退货</el-tag>
          <el-tag v-else type="info" size="small">普通</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="material_code" label="物料编码" width="110" />
      <el-table-column prop="material_name" label="物料名称" min-width="120" />
      <el-table-column prop="quantity" label="数量" width="80" />
      <el-table-column prop="material_unit" label="单位" width="60" />
      <el-table-column prop="counterparty" label="供应商/领用人" min-width="110" show-overflow-tooltip />
      <el-table-column prop="direction" label="出库方向" width="120" show-overflow-tooltip />
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag v-if="row.status === 0" type="danger" size="small">已作废</el-tag>
          <el-tag v-else type="success" size="small">正常</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="purpose" label="备注/用途" min-width="130" show-overflow-tooltip />
      <el-table-column prop="operator_name" label="操作人" width="90" />
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" :icon="Printer" @click="printFlow(row)">打印</el-button>
          <el-button v-if="isAdmin && row.status !== 0" link type="danger" @click="voidFlow(row)">作废</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      style="margin-top: 12px; justify-content: flex-end"
      layout="total, prev, pager, next"
      :total="total" :page-size="pageSize" :current-page="page"
      @current-change="load"
    />
  </el-card>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Download, Printer } from '@element-plus/icons-vue';
import * as XLSX from 'xlsx';
import http from '../api';
import { isAdmin } from '../utils/auth';

const page = ref(1);
const pageSize = 10;
const total = ref(0);
const list = ref([]);
const loading = ref(false);
const exporting = ref(false);
const materials = ref([]);
const dateRange = ref(null);
const query = reactive({ type: '', category: '', material_id: null });

async function load(p = page.value) {
  page.value = p;
  loading.value = true;
  try {
    const params = {
      page: page.value, pageSize,
      type: query.type || '',
      category: query.category || '',
      material_id: query.material_id || '',
      start_date: dateRange.value?.[0] || '',
      end_date: dateRange.value?.[1] || '',
    };
    const res = await http.get('/flows', { params });
    list.value = res.data.list;
    total.value = res.data.total;
  } finally { loading.value = false; }
}

// Excel 导出(客户端生成): 取全量筛选数据再导出
async function exportExcel() {
  exporting.value = true;
  try {
    const params = {
      page: 1, pageSize: 10000,
      type: query.type || '',
      category: query.category || '',
      material_id: query.material_id || '',
      start_date: dateRange.value?.[0] || '',
      end_date: dateRange.value?.[1] || '',
    };
    const res = await http.get('/flows', { params });
    const catText = (c) => (c === 'in_return' ? '入库退货' : c === 'out_return' ? '出库退货' : '普通');
    const data = res.data.list.map((r) => ({
      '流水号': r.flow_no, '单据时间': r.created_at, '类型': r.type === 'IN' ? '入库' : '出库', '类别': catText(r.category),
      '物料编码': r.material_code, '物料名称': r.material_name, '数量': r.quantity, '单位': r.material_unit,
      '供应商/领用人': r.counterparty, '出库方向': r.direction || '', '状态': r.status === 0 ? '已作废' : '正常',
      '备注/用途': r.purpose, '操作人': r.operator_name,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '出入库流水台账');
    XLSX.writeFile(wb, `出入库流水_${Date.now()}.xlsx`);
    ElMessage.success(`导出成功，共 ${data.length} 条`);
  } catch {
    ElMessage.error('导出失败');
  } finally { exporting.value = false; }
}

async function loadMaterials() {
  const res = await http.get('/materials/all');
  materials.value = res.data;
}

// 作废流水
async function voidFlow(row) {
  const { value } = await ElMessageBox.prompt('输入作废原因（作废后该流水不再计入库存）：', '作废流水', { inputValidator: (v) => (v && v.trim() ? true : '请输入作废原因') });
  try {
    await http.post(`/flows/${row.id}/void`, { reason: value });
    ElMessage.success('已作废');
    load(page.value);
  } catch { /* 拦截器已提示 */ }
}

function rowClass({ row }) {
  return row.status === 0 ? 'void-row' : '';
}

// 单据打印: 新窗口生成规范出入库单并调用浏览器打印
function printFlow(row) {
  const isIn = row.type === 'IN';
  const typeName = isIn ? '入库单' : '出库单';
  const w = window.open('', '_blank', 'width=820,height=620');
  if (!w) { ElMessage.warning('浏览器拦截了打印窗口，请允许弹窗'); return; }
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  w.document.write(`<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${typeName}</title>
<style>
body{font-family:'Microsoft YaHei',sans-serif;margin:28px;color:#222}
.doc-title{text-align:center;font-size:24px;font-weight:bold;letter-spacing:8px;margin-bottom:6px}
.doc-sub{text-align:center;font-size:13px;color:#666;margin-bottom:20px}
table{width:100%;border-collapse:collapse}
td{border:1px solid #444;padding:9px 12px;font-size:14px}
.lbl{background:#f0f0f0;font-weight:bold;width:108px;text-align:center;color:#333}
.sig{margin-top:52px;display:flex;justify-content:space-around}
.sig div{text-align:center;font-size:14px}
.sig span{display:inline-block;border-top:1px solid #333;padding:4px 46px;margin-top:6px;color:#333}
@media print{body{margin:0}}
</style></head><body>
<div class="doc-title">${typeName}</div>
<div class="doc-sub">进销存管理系统</div>
<table>
<tr><td class="lbl">单号</td><td>${esc(row.flow_no)}</td><td class="lbl">日期</td><td>${esc(row.created_at)}</td><td class="lbl">类型</td><td>${isIn ? '入库' : '出库'}</td></tr>
<tr><td class="lbl">物料编码</td><td>${esc(row.material_code)}</td><td class="lbl">物料名称</td><td>${esc(row.material_name)}</td><td class="lbl">单位</td><td>${esc(row.material_unit)}</td></tr>
<tr><td class="lbl">数量</td><td>${esc(row.quantity)}</td><td class="lbl">${isIn ? '供应商' : '领用人'}</td><td>${esc(row.counterparty || '-')}</td>${!isIn ? `<td class="lbl">出库方向</td><td>${esc(row.direction || '-')}</td>` : '<td></td><td></td>'}</tr>
<tr><td class="lbl">操作人</td><td>${esc(row.operator_name)}</td><td class="lbl">单据状态</td><td colspan="3">${row.status === 0 ? '已作废' : '正常'}</td></tr>
<tr><td class="lbl">备注/用途</td><td colspan="5">${esc(row.purpose || '-')}</td></tr>
</table>
<div class="sig">
<div>制单人<span></span></div>
<div>仓管员<span></span></div>
<div>复核人<span></span></div>
</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`);
  w.document.close();
}

onMounted(() => { loadMaterials(); load(1); });
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.filters { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
:deep(.void-row) { color: #c0c4cc; text-decoration: line-through; }
</style>
