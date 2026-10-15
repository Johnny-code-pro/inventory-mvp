<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="logo-mark">进销存</div>
      <h2 class="title">进销存管理系统</h2>
      <div class="subtitle">物料 · 出入库 · 库存管理</div>
      <el-form :model="form" :rules="rules" ref="formRef" label-width="0" @keyup.enter="submit">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="账号" size="large" :prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" size="large" show-password :prefix-icon="Lock" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" style="width: 100%" :loading="loading" @click="submit">登 录</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock } from '@element-plus/icons-vue';
import http from '../api';
import { setToken, setUser } from '../utils/auth';

const router = useRouter();
const formRef = ref();
const loading = ref(false);
const form = reactive({ username: '', password: '' });
const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

async function submit() {
  await formRef.value.validate();
  loading.value = true;
  try {
    const res = await http.post('/auth/login', form);
    setToken(res.data.token);
    setUser(res.data.user);
    ElMessage.success('登录成功');
    router.push('/dashboard');
  } catch { /* 错误已由拦截器提示 */ } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-wrap {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  padding: 24px;
  background: radial-gradient(circle at 15% 15%, var(--app-soft-primary), transparent 34%), var(--app-bg);
}
.login-card {
  width: 400px; max-width: 100%;
  padding: 44px 40px 32px;
  background: var(--app-card-bg);
  border: 1px solid var(--app-card-border);
  border-radius: 20px;
  box-shadow: var(--app-shadow);
}
.logo-mark {
  width: 56px; height: 56px; margin: 0 auto 18px;
  border-radius: 16px;
  background: var(--app-soft-primary); color: var(--el-color-primary);
  font-size: 15px; font-weight: 700; letter-spacing: 1px;
  display: flex; align-items: center; justify-content: center;
}
.title { text-align: center; margin: 0 0 6px; color: var(--app-text); font-size: 22px; font-weight: 700; letter-spacing: 1px; }
.subtitle { text-align: center; color: var(--app-text-3); font-size: 13px; margin-bottom: 28px; }

.login-card :deep(.el-form-item) { margin-bottom: 18px; }
.login-card :deep(.el-input__wrapper) {
  border-radius: 11px;
  background: var(--app-input-bg);
  box-shadow: 0 0 0 1px var(--app-input-border) inset;
  transition: box-shadow .2s ease, background-color .2s ease;
}
.login-card :deep(.el-input__wrapper.is-focus) {
  background: var(--app-card-bg);
  box-shadow: 0 0 0 1px var(--el-color-primary) inset, 0 0 0 4px rgba(0, 113, 227, .1);
}
.login-card :deep(.el-input__inner) { color: var(--app-text); }
.login-card :deep(.el-button--primary) {
  height: 44px; border: none; border-radius: 11px; letter-spacing: 4px;
}

@media (max-width: 992px) {
  .login-wrap { padding: 16px; }
  .login-card { padding: 34px 26px 24px; border-radius: 16px; }
}
</style>
