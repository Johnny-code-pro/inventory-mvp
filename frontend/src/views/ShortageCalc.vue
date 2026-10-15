<template>
  <el-card>
    <template #header><span>生产缺料计算（输入要组装的成品+数量，算出各配件还缺多少）</span></template>

    <el-form label-width="90px">
      <el-form-item label="生产计划" required>
        <div class="item-list">
          <div v-for="(row, idx) in items" :key="idx" class="item-row">
            <el-select v-model="row.product_id" filterable placeholder="选择成品" style="flex: 1">
              <el-option v-for="p in products" :key="p.id" :label="`${p.code} ${p.name}`" :value="p.id" />
            </el-select>
            <el-input-number v-model="row.quantity" :min="1" :precision="2" placeholder="数量(台)" style="width: 130px" />
            <el-button type="danger" :icon="Delete" circle @click="items.splice(idx, 1)" />
          </div>
          <div class="row-actions">
            <el-button type="primary" plain :icon="Plus" @click="addItem">添加成品</el-button>
            <el-button type="success" :icon="DataAnalysis" :loading="calcLoading" @click="calc">计算缺料</el-button>
          </div>
        </div>
      </el-form-item>
    </el-form>

    <!-- 计算结果 -->
    <template v-if="result">
      <el-alert type="info" :closable="false" style="margin-bottom: 12px"
        :title="`生产计划：${result.detail.map((d) => (d.error ? '' : d.name + '×' + d.quantity)).filter(Boolean).join('、')} ｜ 共需 ${result.materials.length} 种配件`" />
      <el-table :data="result.materials" border stripe :row-class-name="rowClass">
        <el-table-column prop="code" label="物料编码" width="110" />
        <el-table-column prop="name" label="物料名称" min-width="120" />
        <el-table-column prop="spec" label="规格型号" min-width="110" show-overflow-tooltip />
        <el-table-column prop="unit" label="单位" width="60" />
        <el-table-column prop="required" label="需要总数" width="100" />
        <el-table-column prop="stock" label="当前库存" width="100" />
        <el-table-column label="缺口(负=缺料)" width="120">
          <template #default="{ row }">
            <el-tag :type="row.shortage < 0 ? 'danger' : 'success'" effect="dark">{{ row.shortage }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="是否缺料" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.shortage < 0" type="danger" size="small">缺 {{ Math.abs(row.shortage) }}</el-tag>
            <el-tag v-else type="success" size="small">充足</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="result.detail.some((d) => d.error)" style="margin-top: 8px">
        <el-tag v-for="(d, i) in result.detail.filter((x) => x.error)" :key="i" type="warning" style="margin-right: 6px">{{ d.name || ('成品#' + d.product_id) }}：{{ d.error }}</el-tag>
      </div>
    </template>
  </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Delete, DataAnalysis } from '@element-plus/icons-vue';
import http from '../api';

const products = ref([]);
const items = ref([{ product_id: null, quantity: 1 }]);
const result = ref(null);
const calcLoading = ref(false);

function addItem() { items.value.push({ product_id: null, quantity: 1 }); }

async function loadProducts() {
  const res = await http.get('/products/all');
  products.value = res.data;
}

async function calc() {
  const rows = items.value.filter((i) => i.product_id && Number(i.quantity) > 0);
  if (!rows.length) { ElMessage.warning('请至少选择一个成品并填写数量'); return; }
  calcLoading.value = true;
  try {
    const res = await http.post('/products/calc-need', { items: rows });
    result.value = res.data;
    if (!result.value.materials.length) ElMessage.warning('没有可计算的配件（请先配置BOM配方）');
  } catch { /* 拦截器已提示 */ } finally { calcLoading.value = false; }
}

function rowClass({ row }) {
  return row.shortage < 0 ? 'short-row' : '';
}

onMounted(() => loadProducts());
</script>

<style scoped>
.item-list { width: 100%; display: flex; flex-direction: column; gap: 8px; }
.item-row { display: flex; align-items: center; gap: 8px; }
.row-actions { display: flex; gap: 8px; }
:deep(.short-row) { background: #fef0f0 !important; }
</style>
