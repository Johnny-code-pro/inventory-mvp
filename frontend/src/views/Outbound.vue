<template>
  <el-row :gutter="16">
    <!-- 出库单录入 -->
    <el-col :xs="24" :md="12">
      <el-card>
        <template #header>
          <div class="card-header">
            <span>出库单</span>
            <el-radio-group v-model="mode" size="small">
              <el-radio-button value="material">按物料出库</el-radio-button>
              <el-radio-button value="product">按成品出库(BOM)</el-radio-button>
            </el-radio-group>
          </div>
        </template>

        <!-- ========== 按物料出库 ========== -->
        <el-form v-if="mode === 'material'" ref="formRef" :model="form" :label-position="isMobile ? 'top' : 'left'" label-width="90px">
          <el-form-item label="物料明细" required>
            <div class="item-list">
              <div v-for="(row, idx) in form.items" :key="idx" class="item-row">
                <el-select v-model="row.material_id" filterable placeholder="选择物料（搜索编码/名称/规格）" style="flex: 1" @change="onMaterialChange(row)">
                  <el-option v-for="m in materials" :key="m.id" :label="matLabel(m)" :value="m.id" />
                </el-select>
                <el-input-number v-model="row.quantity" :min="0.01" :precision="2" placeholder="数量" style="width: 120px" />
                <el-tag v-if="row.stock != null" :type="Number(row.stock) <= 0 ? 'danger' : 'success'" size="small">库存{{ row.stock }}</el-tag>
                <el-button type="danger" :icon="Delete" circle @click="removeItem(idx)" />
              </div>
              <el-button type="primary" plain :icon="Plus" @click="addItem">添加物料</el-button>
              <div v-if="dupMsg" class="dup-msg">{{ dupMsg }}</div>
            </div>
          </el-form-item>
          <el-form-item label="出库方向">
            <el-select v-model="form.direction" placeholder="选填或输入自定义" clearable filterable allow-create default-first-option style="width: 200px">
              <el-option v-for="d in directions" :key="d" :label="d" :value="d" />
            </el-select>
          </el-form-item>
          <el-form-item label="领用人"><el-input v-model="form.receiver" placeholder="本单领用人" /></el-form-item>
          <el-form-item label="领用用途"><el-input v-model="form.purpose" type="textarea" :rows="2" placeholder="本单用途（选填）" /></el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="submitting" @click="submitMaterial">确认出库</el-button>
            <el-button @click="reset">重置</el-button>
          </el-form-item>
        </el-form>

        <!-- ========== 按成品出库(BOM) ========== -->
        <el-form v-else :model="pform" :label-position="isMobile ? 'top' : 'left'" label-width="90px">
          <el-form-item label="成品" required>
            <el-select v-model="pform.product_id" filterable placeholder="选择成品（按配方自动扣配件库存）" style="width: 100%" @change="onProductChange">
              <el-option v-for="p in products" :key="p.id" :label="`${p.code} ${p.name}`" :value="p.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="生产数量" required>
            <el-input-number v-model="pform.quantity" :min="1" :precision="2" style="width: 180px" @change="onProductChange" />
          </el-form-item>
          <el-form-item label="出库方向">
            <el-select v-model="pform.direction" placeholder="选填或输入自定义" clearable filterable allow-create default-first-option style="width: 180px">
              <el-option v-for="d in directions" :key="d" :label="d" :value="d" />
            </el-select>
          </el-form-item>
          <el-form-item label="领用人"><el-input v-model="pform.receiver" placeholder="本单领用人" /></el-form-item>
          <el-form-item label="领用用途"><el-input v-model="pform.purpose" type="textarea" :rows="2" placeholder="本单用途（选填）" /></el-form-item>

          <!-- 配方扣料预览 -->
          <el-form-item label="扣料预览">
            <el-table :data="preview" size="small" border max-height="240" v-loading="previewLoading">
              <el-table-column prop="material_code" label="物料编码" width="100" />
              <el-table-column prop="material_name" label="物料名称" min-width="110" />
              <el-table-column prop="quantity" label="扣减数量" width="90" />
              <el-table-column prop="unit" label="单位" width="60" />
              <el-table-column prop="stock" label="当前库存" width="90" />
              <el-table-column label="校验" width="90">
                <template #default="{ row }">
                  <el-tag v-if="row.quantity > row.stock" type="danger" size="small">库存不足</el-tag>
                  <el-tag v-else type="success" size="small">可扣</el-tag>
                </template>
              </el-table-column>
            </el-table>
            <div v-if="previewMsg" class="dup-msg">{{ previewMsg }}</div>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="submitting" @click="submitProduct">确认成品出库</el-button>
            <el-button @click="reset">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </el-col>

    <!-- 最近出库记录 -->
    <el-col :xs="24" :md="12">
      <el-card>
        <template #header><span>最近出库记录</span></template>
        <el-table :data="recent" size="small" border stripe max-height="460">
          <el-table-column prop="flow_no" label="流水号" width="150" />
          <el-table-column prop="material_name" label="物料" min-width="130" show-overflow-tooltip />
          <el-table-column prop="quantity" label="数量" width="80" />
          <el-table-column prop="counterparty" label="领用人" min-width="90" show-overflow-tooltip />
          <el-table-column prop="created_at" label="时间" width="160" />
        </el-table>
      </el-card>
    </el-col>
  </el-row>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Delete } from '@element-plus/icons-vue';
import http from '../api';

// 手机端检测: 手机上表单标签自动上移
const isMobile = ref(window.innerWidth < 992);
function onResize() { isMobile.value = window.innerWidth < 992; }
onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));

const formRef = ref();
const submitting = ref(false);
const materials = ref([]);
const products = ref([]);
const recent = ref([]);
const dupMsg = ref('');
const mode = ref('material');
const directions = ['A 款生产', 'B 款生产', 'E 款生产', 'M 金属款生产', '打包发货', '样品外发', '退换货'];

const form = reactive({ items: [{ material_id: null, quantity: 0.01, stock: null }], direction: '', receiver: '', purpose: '' });
const pform = reactive({ product_id: null, quantity: 1, direction: '', receiver: '', purpose: '' });
const preview = ref([]);
const previewLoading = ref(false);
const previewMsg = ref('');

function matLabel(m) {
  const group = m.product_group ? `${m.product_group} · ` : '';
  const spec = m.spec ? ` (${m.spec})` : '';
  return `${group}${m.name}${spec} [${m.code}]`;
}

function addItem() { form.items.push({ material_id: null, quantity: 0.01, stock: null }); }
function removeItem(idx) { form.items.splice(idx, 1); checkDuplicate(); }

async function onMaterialChange(row) {
  if (!row.material_id) { row.stock = null; return; }
  try {
    const res = await http.get(`/inventory/${row.material_id}`);
    row.stock = res.data.stock;
  } catch { row.stock = null; }
  checkDuplicate();
}

function checkDuplicate() {
  const ids = form.items.map((i) => i.material_id).filter(Boolean);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  dupMsg.value = dup ? '同一物料不能重复添加，请检查' : '';
}

// 选中成品后按配方 + 生产数量计算扣料预览
async function onProductChange() {
  preview.value = [];
  previewMsg.value = '';
  if (!pform.product_id) return;
  previewLoading.value = true;
  try {
    const res = await http.get(`/products/${pform.product_id}/bom`);
    const bom = res.data;
    if (!bom.length) { previewMsg.value = '该成品未配置配方，请先在"产品配方"中添加配件'; return; }
    const inv = await http.get('/inventory');
    const stockMap = new Map(inv.data.map((m) => [m.id, m.stock]));
    preview.value = bom.map((b) => ({
      material_code: b.material_code, material_name: b.material_name, unit: b.unit,
      quantity: Number(b.qty_per) * Number(pform.quantity),
      stock: stockMap.get(b.material_id),
    }));
  } catch { /* 拦截器已提示 */ } finally { previewLoading.value = false; }
}

async function loadMaterials() { const res = await http.get('/materials/all'); materials.value = res.data; }
async function loadProducts() { const res = await http.get('/products/all'); products.value = res.data; }
async function loadRecent() {
  const res = await http.get('/flows', { params: { type: 'OUT', pageSize: 8 } });
  recent.value = res.data.list;
}

async function submitMaterial() {
  const rows = form.items.filter((i) => i.material_id);
  if (rows.length === 0) { ElMessage.warning('请至少选择一种物料'); return; }
  if (dupMsg.value) { ElMessage.warning(dupMsg.value); return; }
  for (const r of rows) {
    if (!Number(r.quantity) || Number(r.quantity) <= 0) { ElMessage.warning('请填写大于0的数量'); return; }
    if (r.stock != null && Number(r.quantity) > Number(r.stock)) { ElMessage.warning('库存不足：请检查带红色的物料数量'); return; }
  }
  submitting.value = true;
  try {
    const res = await http.post('/flows/out', { items: rows.map(({ material_id, quantity }) => ({ material_id, quantity })), direction: form.direction, receiver: form.receiver, purpose: form.purpose });
    ElMessage.success(`${res.msg}，流水号：${res.data.flow_nos.join('、')}`);
    reset(); loadRecent();
  } catch { /* 拦截器已提示 */ } finally { submitting.value = false; }
}

async function submitProduct() {
  if (!pform.product_id) { ElMessage.warning('请选择成品'); return; }
  if (!Number(pform.quantity) || Number(pform.quantity) <= 0) { ElMessage.warning('请填写大于0的生产数量'); return; }
  if (previewMsg.value) { ElMessage.warning(previewMsg.value); return; }
  if (preview.value.some((r) => r.quantity > r.stock)) { ElMessage.warning('存在配件库存不足，请先补料或减少生产数量'); return; }
  submitting.value = true;
  try {
    const res = await http.post('/flows/out-product', pform);
    ElMessage.success(res.msg);
    reset(); loadRecent();
  } catch { /* 拦截器已提示 */ } finally { submitting.value = false; }
}

function reset() {
  form.items = [{ material_id: null, quantity: 0.01, stock: null }];
  form.direction = ''; form.receiver = ''; form.purpose = '';
  Object.assign(pform, { product_id: null, quantity: 1, direction: '', receiver: '', purpose: '' });
  preview.value = []; previewMsg.value = '';
  dupMsg.value = '';
  formRef.value?.clearValidate();
}

onMounted(() => { loadMaterials(); loadProducts(); loadRecent(); });
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.item-list { width: 100%; display: flex; flex-direction: column; gap: 8px; }
.item-row { display: flex; align-items: center; gap: 8px; }
.dup-msg { color: #f56c6c; font-size: 12px; margin-top: 4px; }
</style>
