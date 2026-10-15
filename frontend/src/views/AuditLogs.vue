<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>操作审计日志（管理员及以上）</span>
        <div class="filters">
          <el-input v-model="keyword" placeholder="搜索操作人/动作/内容" clearable style="width: 220px" @input="load(1)" />
          <el-button :icon="Search" @click="load(1)">查询</el-button>
          <el-button :icon="Refresh" @click="load(1)">刷新</el-button>
        </div>
      </div>
    </template>

    <el-table :data="list" border stripe v-loading="loading">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="created_at" label="时间" width="165" />
      <el-table-column prop="username" label="操作人" width="120" />
      <el-table-column prop="action" label="动作" width="150">
        <template #default="{ row }">{{ actionName(row.action) }}</template>
      </el-table-column>
      <el-table-column prop="detail" label="详情" min-width="240" show-overflow-tooltip />
      <el-table-column prop="target" label="路径" width="160" show-overflow-tooltip />
      <el-table-column prop="ip" label="IP" width="130" />
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
import { ref, onMounted } from 'vue';
import { Search, Refresh } from '@element-plus/icons-vue';
import http from '../api';

const keyword = ref('');
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const list = ref([]);
const loading = ref(false);

const ACTIONS = {
  login: '登录', create_material: '新增物料', update_material: '修改物料', disable_material: '停用物料',
  create_product: '新增成品', update_product: '修改成品', disable_product: '停用成品', bom_add: '配方添加', bom_remove: '配方移除',
  inbound: '入库', outbound: '出库', out_product: '成品出库', in_product: '成品入库', void_flow: '作废流水',
  intransit_add: '在途登记', intransit_confirm: '在途入库', create_user: '新增用户', update_user: '修改用户', reset_password: '重置密码', update_settings: '系统设置',
};
function actionName(a) { return ACTIONS[a] || a; }

async function load(p = page.value) {
  page.value = p;
  loading.value = true;
  try {
    const res = await http.get('/audit', { params: { page: page.value, pageSize, keyword: keyword.value } });
    list.value = res.data.list;
    total.value = res.data.total;
  } finally { loading.value = false; }
}

onMounted(() => load(1));
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.filters { display: flex; gap: 12px; align-items: center; }
</style>
