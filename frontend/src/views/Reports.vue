<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>出入库趋势</span>
          <el-select v-model="months" style="width: 110px" @change="loadTrend">
            <el-option v-for="n in [3, 6, 12]" :key="n" :label="`近${n}个月`" :value="n" />
          </el-select>
        </div>
      </template>
      <el-table :data="trend" border stripe size="small" v-loading="trendLoading">
        <el-table-column prop="ym" label="月份" width="140" />
        <el-table-column prop="in_qty" label="入库总量" width="180" />
        <el-table-column prop="out_qty" label="出库总量" width="180" />
        <el-table-column label="净变化(入-出)" min-width="180">
          <template #default="{ row }">
            <el-tag :type="row.in_qty - row.out_qty >= 0 ? 'success' : 'danger'">
              {{ row.in_qty - row.out_qty >= 0 ? '+' : '' }}{{ Number(row.in_qty - row.out_qty).toFixed(2) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card style="margin-top: 16px">
      <template #header>
        <div class="card-header">
          <span>呆滞库存（有库存但长期未动）</span>
          <el-select v-model="staleDays" style="width: 140px" @change="loadStale">
            <el-option v-for="n in [30, 60, 90, 180]" :key="n" :label="`超过${n}天未动`" :value="n" />
          </el-select>
        </div>
      </template>
      <el-table :data="stale" border stripe v-loading="staleLoading">
        <el-table-column prop="code" label="物料编码" width="110" />
        <el-table-column prop="name" label="物料名称" min-width="120" />
        <el-table-column prop="spec" label="规格" min-width="120" />
        <el-table-column prop="unit" label="单位" width="60" />
        <el-table-column prop="stock" label="当前库存" width="100" />
        <el-table-column label="最近动销" width="180">
          <template #default="{ row }">{{ row.last_flow_at || '从未动过' }}</template>
        </el-table-column>
        <el-table-column label="停滞天数" width="100">
          <template #default="{ row }"><el-tag type="warning" size="small">{{ row.stale_days }} 天</el-tag></template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import http from '../api';

const months = ref(6);
const trend = ref([]);
const trendLoading = ref(false);
const staleDays = ref(90);
const stale = ref([]);
const staleLoading = ref(false);

async function loadTrend() {
  trendLoading.value = true;
  try { const res = await http.get('/report/trend', { params: { months: months.value } }); trend.value = res.data; }
  finally { trendLoading.value = false; }
}
async function loadStale() {
  staleLoading.value = true;
  try { const res = await http.get('/report/stale', { params: { days: staleDays.value } }); stale.value = res.data; }
  finally { staleLoading.value = false; }
}
onMounted(() => { loadTrend(); loadStale(); });
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>
