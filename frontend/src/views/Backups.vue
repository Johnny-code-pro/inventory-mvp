<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>数据库备份（超级管理员专属）</span>
        <el-button type="primary" :icon="Refresh" :loading="creating" @click="create">立即备份</el-button>
      </div>
    </template>

    <el-alert type="info" :closable="false" style="margin-bottom: 12px"
      title="每日凌晨 3:00 自动备份一次，保留最近14天。也可手动立即备份并下载到本地保存。" />

    <el-table :data="list" border stripe v-loading="loading">
      <el-table-column prop="filename" label="备份文件" min-width="240" />
      <el-table-column prop="timeText" label="备份时间" width="180" />
      <el-table-column prop="sizeText" label="大小" width="100" />
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button link type="primary" :icon="Download" @click="download(row.filename)">下载</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh, Download } from '@element-plus/icons-vue';
import http from '../api';

const list = ref([]);
const loading = ref(false);
const creating = ref(false);

async function load() {
  loading.value = true;
  try { const res = await http.get('/backup/list'); list.value = res.data; }
  finally { loading.value = false; }
}

async function create() {
  creating.value = true;
  try { const res = await http.post('/backup/create'); ElMessage.success(res.msg); load(); }
  catch { /* 拦截器已提示 */ } finally { creating.value = false; }
}

// 下载备份: 用 blob 携带 token 下载
async function download(name) {
  try {
    const blob = await http.get(`/backup/download/${name}`, { responseType: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  } catch { /* 拦截器已提示 */ }
}

onMounted(() => load());
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>
