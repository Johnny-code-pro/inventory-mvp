<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>用户管理（超级管理员专属）</span>
        <div class="filters">
          <el-input v-model="keyword" placeholder="搜索账号/姓名" clearable style="width: 200px" @input="load" />
          <el-button type="primary" :icon="Plus" @click="openAdd">新增用户</el-button>
        </div>
      </div>
    </template>

    <el-table :data="list" border stripe v-loading="loading">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="username" label="账号" min-width="120" />
      <el-table-column prop="real_name" label="姓名" min-width="100" />
      <el-table-column label="角色" width="110">
        <template #default="{ row }">
          <el-tag :type="roleTag(row.role)">{{ roleName(row.role) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="建档时间" width="165" />
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="warning" @click="openPwd(row)">重置密码</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑用户 -->
    <el-dialog v-model="dialogVisible" :title="editId ? '编辑用户' : '新增用户'" width="420px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="账号" prop="username"><el-input v-model="form.username" :disabled="!!editId" /></el-form-item>
        <el-form-item v-if="!editId" label="初始密码" prop="password"><el-input v-model="form.password" show-password /></el-form-item>
        <el-form-item label="姓名"><el-input v-model="form.real_name" /></el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="超级管理员" value="superadmin" />
            <el-option label="管理员" value="admin" />
            <el-option label="操作员" value="operator" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editId" label="状态">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码 -->
    <el-dialog v-model="pwdVisible" title="重置密码" width="380px" :close-on-click-modal="false">
      <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-width="80px">
        <el-form-item label="账号"><el-text>{{ current?.username }}</el-text></el-form-item>
        <el-form-item label="新密码" prop="password"><el-input v-model="pwdForm.password" show-password /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="savePwd">确认重置</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import http from '../api';

const keyword = ref('');
const list = ref([]);
const loading = ref(false);

const dialogVisible = ref(false);
const editId = ref(null);
const saving = ref(false);
const formRef = ref();
const form = reactive({ username: '', password: '', real_name: '', role: 'operator', status: 1 });
const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入初始密码(至少6位)', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
};

const pwdVisible = ref(false);
const current = ref(null);
const pwdFormRef = ref();
const pwdForm = reactive({ password: '' });
const pwdRules = { password: [{ required: true, message: '请输入新密码(至少6位)', trigger: 'blur' }] };

function roleName(r) { return { superadmin: '超级管理员', admin: '管理员', operator: '操作员' }[r] || r; }
function roleTag(r) { return r === 'superadmin' ? 'danger' : r === 'admin' ? 'warning' : 'info'; }

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/users', { params: { keyword: keyword.value } });
    list.value = res.data;
  } finally { loading.value = false; }
}

function openAdd() {
  editId.value = null;
  Object.assign(form, { username: '', password: '', real_name: '', role: 'operator', status: 1 });
  dialogVisible.value = true;
}

function openEdit(row) {
  editId.value = row.id;
  Object.assign(form, { username: row.username, password: '', real_name: row.real_name || '', role: row.role, status: row.status });
  dialogVisible.value = true;
}

async function save() {
  await formRef.value.validate();
  saving.value = true;
  try {
    if (editId.value) await http.put(`/users/${editId.value}`, { real_name: form.real_name, role: form.role, status: form.status });
    else await http.post('/users', form);
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    load();
  } catch { /* 拦截器已提示 */ } finally { saving.value = false; }
}

function openPwd(row) {
  current.value = row;
  pwdForm.password = '';
  pwdVisible.value = true;
}

async function savePwd() {
  await pwdFormRef.value.validate();
  saving.value = true;
  try {
    await http.put(`/users/${current.value.id}/password`, { password: pwdForm.password });
    ElMessage.success('密码已重置');
    pwdVisible.value = false;
  } catch { /* 拦截器已提示 */ } finally { saving.value = false; }
}

onMounted(() => load());
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.filters { display: flex; gap: 12px; align-items: center; }
</style>
