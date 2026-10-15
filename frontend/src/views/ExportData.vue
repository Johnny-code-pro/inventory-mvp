<template>
  <el-card>
    <template #header><div class="card-header"><span>数据导出</span></div></template>

    <el-alert type="info" :closable="false" style="margin-bottom: 16px"
      title="一键导出当前系统全部业务数据为 Excel（含物料档案、实时库存、出入库流水、成品配方、采购订单），仅超级管理员可用。" />

    <div class="export-body">
      <el-button type="primary" size="large" :icon="Download" :loading="loading" @click="doExport">一键导出全部数据</el-button>
      <div v-if="counts" class="counts">
        本次导出：物料档案 {{ counts.materials }} 项、实时库存 {{ counts.inventory }} 项、出入库流水 {{ counts.flows }} 条、
        成品 {{ counts.products }} 项、配方 {{ counts.boms }} 条、采购订单 {{ counts.intransit }} 条
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Download } from '@element-plus/icons-vue';
import * as XLSX from 'xlsx';
import http from '../api';

const loading = ref(false);
const counts = ref(null);

function append(wb, name, rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0] || {}).map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, ws, name);
}

async function doExport() {
  loading.value = true;
  try {
    const res = await http.get('/export/full');
    const d = res.data;
    counts.value = {
      materials: d.materials.length, inventory: d.inventory.length, flows: d.flows.length,
      products: d.products.length, boms: d.boms.length, intransit: d.intransit.length,
    };
    const wb = XLSX.utils.book_new();
    append(wb, '物料档案', d.materials.map((r) => ({
      '物料编码': r.code, '物料名称': r.name, '物料大类': r.material_cat || '', '规格型号': r.spec || '',
      '单位': r.unit || '', '分类': r.category || '', '商品分组': r.product_group || '',
      '安全库存': r.safety_stock, '状态': r.status === 1 ? '启用' : '停用', '建档时间': r.created_at,
    })));
    append(wb, '实时库存', d.inventory.map((r) => ({
      '物料编码': r.code, '物料名称': r.name, '物料大类': r.material_cat || '', '商品分组': r.product_group || '',
      '规格型号': r.spec || '', '单位': r.unit || '', '累计入库': r.total_in, '累计出库': r.total_out,
      '安全库存': r.safety_stock, '当前库存': r.stock,
    })));
    append(wb, '出入库流水', d.flows.map((r) => ({
      '流水号': r.flow_no, '类型': r.type === 'IN' ? '入库' : '出库', '物料编码': r.material_code,
      '物料名称': r.material_name, '数量': r.quantity, '对手方': r.counterparty || '', '用途': r.purpose || '',
      '操作人': r.operator || '', '单据时间': r.created_at, '状态': r.flow_status === 1 ? '正常' : '作废',
    })));
    append(wb, '成品', d.products.map((r) => ({
      '成品编码': r.code, '成品名称': r.name, '状态': r.status === 1 ? '启用' : '停用', '创建时间': r.created_at,
    })));
    append(wb, 'BOM配方明细', d.boms.map((r) => ({
      '成品编码': r.product_code, '成品名称': r.product_name, '物料编码': r.material_code, '物料名称': r.material_name, '单件耗用': r.qty_per,
    })));
    append(wb, '采购订单', d.intransit.map((r) => ({
      '物料编码': r.material_code, '物料名称': r.material_name, '订购数量': r.quantity,
      '已到货': r.received, '待入库': r.remaining, '供应商': r.supplier || '', '备注': r.remark || '',
      '状态': r.status === 1 ? '已完成' : '在途', '下单时间': r.created_at,
    })));
    XLSX.writeFile(wb, `进销存全量数据_${Date.now()}.xlsx`);
    ElMessage.success('导出成功');
  } catch { /* 拦截器已提示 */ } finally { loading.value = false; }
}
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.export-body { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
.counts { color: #909399; font-size: 13px; line-height: 1.8; }
</style>
