<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>采购订单（订了货，到货一点就入库一点，直到全部到齐）</span>
        <div class="filters">
          <el-radio-group v-model="viewStatus" size="small" @change="load">
            <el-radio-button :value="0">未到齐</el-radio-button>
            <el-radio-button :value="1">已到齐</el-radio-button>
          </el-radio-group>
          <el-button type="primary" :icon="Plus" @click="openAdd">新增采购订单</el-button>
        </div>
      </div>
    </template>

    <el-table :data="list" border stripe v-loading="loading">
      <el-table-column prop="material_code" label="物料编码" width="110" />
      <el-table-column prop="material_name" label="物料名称" min-width="120" />
      <el-table-column prop="spec" label="规格型号" min-width="110" show-overflow-tooltip />
      <el-table-column prop="unit" label="单位" width="60" />
      <el-table-column prop="quantity" label="订购数量" width="90" />
      <el-table-column prop="received" label="已入库" width="90" />
      <el-table-column prop="remaining" label="待入库" width="90">
        <template #default="{ row }">
          <el-tag v-if="viewStatus === 0" :type="Number(row.remaining) > 0 ? 'warning' : 'success'" size="small">{{ row.remaining }}</el-tag>
          <span v-else>{{ row.remaining }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="supplier" label="供应商" min-width="100" show-overflow-tooltip />
      <el-table-column prop="remark" label="备注" min-width="100" show-overflow-tooltip />
      <el-table-column prop="created_at" label="下单时间" width="150" />
      <el-table-column v-if="viewStatus === 0" label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openReceive(row)">入库</el-button>
          <el-popconfirm title="删除该订单？" @confirm="removeOne(row)">
            <template #reference><el-button link type="danger">删除</el-button></template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!loading && !list.length" description="暂无记录" />

    <!-- 新增采购订单 -->
    <el-dialog v-model="addVisible" title="新增采购订单" :width="isMobile ? '94%' : '460px'" :close-on-click-modal="false">
      <el-form ref="addFormRef" :model="addForm" :rules="addRules" :label-position="isMobile ? 'top' : 'left'" label-width="90px">
        <el-form-item label="物料" prop="material_id">
          <el-select v-model="addForm.material_id" filterable placeholder="选择物料" style="width: 100%">
            <el-option v-for="m in materials" :key="m.id" :label="matLabel(m)" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="订购数量" prop="quantity">
          <el-input-number v-model="addForm.quantity" :min="0.01" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="供应商"><el-input v-model="addForm.supplier" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="addForm.remark" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveAdd">保存</el-button>
      </template>
    </el-dialog>

    <!-- 分批入库 -->
    <el-dialog v-model="recvVisible" :title="`到货入库：${current?.material_code} ${current?.material_name}`" :width="isMobile ? '94%' : '420px'" :close-on-click-modal="false">
      <el-form label-width="90px">
        <el-form-item label="待入库数量"><el-tag type="warning">{{ current?.remaining }}</el-tag></el-form-item>
        <el-form-item label="本次到货" required>
          <el-input-number v-model="recvQty" :min="0.01" :max="Number(current?.remaining)" :precision="2" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="recvVisible = false">取消</el-button>
        <el-button type="primary" :loading="recvLoading" @click="doReceive">确认入库</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import http from '../api';

// 手机端检测
const isMobile = ref(window.innerWidth < 992);
function onResize() { isMobile.value = window.innerWidth < 992; }
onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));

const viewStatus = ref(0);
const list = ref([]);
const loading = ref(false);
const materials = ref([]);

const addVisible = ref(false);
const saving = ref(false);
const addFormRef = ref();
const addForm = reactive({ material_id: null, quantity: 0.01, supplier: '', remark: '' });
const addRules = {
  material_id: [{ required: true, message: '请选择物料', trigger: 'change' }],
};

const recvVisible = ref(false);
const recvLoading = ref(false);
const current = ref(null);
const recvQty = ref(1);

function matLabel(m) {
  const spec = m.spec ? ` (${m.spec})` : '';
  return `${m.code} ${m.name}${spec}`;
}

async function load() {
  loading.value = true;
  try {
    const res = await http.get('/intransit', { params: { status: viewStatus.value } });
    list.value = res.data;
  } finally { loading.value = false; }
}

async function loadMaterials() {
  const res = await http.get('/materials/all');
  materials.value = res.data;
}

function openAdd() {
  Object.assign(addForm, { material_id: null, quantity: 0.01, supplier: '', remark: '' });
  addVisible.value = true;
}

async function saveAdd() {
  await addFormRef.value.validate();
  saving.value = true;
  try {
    await http.post('/intransit', addForm);
    ElMessage.success('采购订单已创建');
    addVisible.value = false;
    load();
  } catch { /* 拦截器已提示 */ } finally { saving.value = false; }
}

function openReceive(row) {
  current.value = row;
  recvQty.value = Number(row.remaining);
  recvVisible.value = true;
}

async function doReceive() {
  if (!Number(recvQty.value) || Number(recvQty.value) <= 0) { ElMessage.warning('请填写到货数量'); return; }
  recvLoading.value = true;
  try {
    const res = await http.post(`/intransit/${current.value.id}/receive`, { quantity: recvQty.value });
    ElMessage.success(res.msg);
    recvVisible.value = false;
    load();
  } catch { /* 拦截器已提示 */ } finally { recvLoading.value = false; }
}

async function removeOne(row) {
  await http.delete(`/intransit/${row.id}`);
  ElMessage.success('已删除');
  load();
}

onMounted(() => { load(); loadMaterials(); });
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.filters { display: flex; gap: 12px; align-items: center; }
</style>
