<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>登录日志</span>
        <div class="filters">
          <el-input v-model="keyword" placeholder="搜索账号/姓名" clearable style="width: 170px" @input="load(1)" />
          <el-select v-model="status" placeholder="登录结果" clearable style="width: 110px" @change="load(1)">
            <el-option label="成功" value="1" /><el-option label="失败" value="0" />
          </el-select>
          <el-date-picker v-model="range" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" style="width: 250px" @change="load(1)" />
          <el-button :icon="Refresh" @click="load()">刷新</el-button>
        </div>
      </div>
    </template>

    <el-table :data="list" border stripe v-loading="loading">
      <el-table-column prop="created_at" label="登录时间" width="170" />
      <el-table-column prop="username" label="账号" width="120" />
      <el-table-column prop="real_name" label="姓名" width="100" />
      <el-table-column label="角色" width="100">
        <template #default="{ row }">
          <el-tag :type="row.role === 'superadmin' ? 'danger' : row.role === 'admin' ? 'success' : 'info'" size="small">
            {{ { superadmin: '超级管理员', admin: '管理员', operator: '操作员' }[row.role] || row.role }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="ip" label="IP" width="140" />
      <el-table-column label="结果" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status ? 'success' : 'danger'" size="small">{{ row.status ? '成功' : '失败' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="msg" label="说明" min-width="120" />
      <el-table-column prop="ua" label="浏览器" min-width="200" show-overflow-tooltip />
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
import { Refresh } from '@element-plus/icons-vue';
import http from '../api';

const keyword = ref('');
const status = ref('');
const range = ref(null);
const page = ref(1);
const pageSize = 10;
const total = ref(0);
const list = ref([]);
const loading = ref(false);

function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

async function load(p = page.value) {
  page.value = p;
  loading.value = true;
  try {
    const params = { page: page.value, pageSize, keyword: keyword.value, status: status.value };
    if (range.value && range.value.length === 2) {
      params.start = fmt(range.value[0]);
      params.end = fmt(range.value[1]);
    }
    const res = await http.get('/login-logs', { params });
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
