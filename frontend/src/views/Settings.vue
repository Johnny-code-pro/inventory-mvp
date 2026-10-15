<template>
  <el-card style="max-width: 560px">
    <template #header><span>系统设置（超级管理员专属）</span></template>
    <el-form label-width="160px" v-loading="loading">
      <el-form-item label="系统名称">
        <el-input v-model="form.system_name" placeholder="显示在页面标题" />
      </el-form-item>
      <el-form-item label="新物料默认安全库存">
        <el-input-number v-model="safetyNum" :min="0" :precision="2" style="width: 180px" />
      </el-form-item>
      <el-form-item label="低库存预警">
        <el-switch v-model="warnLow" active-text="开启" inactive-text="关闭" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" @click="save">保存设置</el-button>
      </el-form-item>
      <el-alert type="info" :closable="false" title="设置项由超级管理员维护。" />
    </el-form>
  </el-card>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import http from '../api';

const loading = ref(false);
const saving = ref(false);
const safetyNum = ref(0);
const warnLow = ref(true);
const form = reactive({ system_name: '' });

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/settings');
    const d = res.data || {};
    form.system_name = d.system_name || '';
    safetyNum.value = Number(d.safety_default) || 0;
    warnLow.value = d.warn_low_stock !== '0';
  } finally { loading.value = false; }
}

async function save() {
  saving.value = true;
  try {
    await http.put('/settings', {
      system_name: form.system_name,
      safety_default: String(safetyNum.value),
      warn_low_stock: warnLow.value ? '1' : '0',
    });
    ElMessage.success('设置已保存');
  } catch { /* 拦截器已提示 */ } finally { saving.value = false; }
}

onMounted(() => load());
</script>
