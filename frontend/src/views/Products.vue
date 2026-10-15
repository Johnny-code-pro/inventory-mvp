<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>产品配方（一个成品 = 多个配件物料 × 单件耗用量）</span>
        <div class="filters">
          <el-input v-model="keyword" placeholder="搜索成品编码/名称" clearable style="width: 200px" @input="load(1)" />
          <el-button v-if="isAdmin" type="primary" :icon="Plus" @click="openProduct()">新增产品</el-button>
        </div>
      </div>
    </template>

    <el-table :data="list" border stripe v-loading="loading">
      <el-table-column prop="code" label="成品编码" width="110" />
      <el-table-column prop="name" label="成品名称" min-width="150" />
      <el-table-column prop="bom_count" label="配方配件数" width="110" />
      <el-table-column prop="created_at" label="建档时间" width="165" />
      <el-table-column label="操作" width="210" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openBom(row)">配方</el-button>
          <el-button v-if="isAdmin" link type="primary" @click="openProduct(row)">编辑</el-button>
          <el-popconfirm v-if="isAdmin" title="停用后不可用于出库，确定停用？" @confirm="removeProduct(row)">
            <template #reference><el-button link type="danger">停用</el-button></template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      style="margin-top: 12px; justify-content: flex-end"
      layout="total, prev, pager, next"
      :total="total" :page-size="pageSize" :current-page="page"
      @current-change="load"
    />

    <!-- 新增/编辑产品 -->
    <el-dialog v-model="productVisible" :title="editId ? '编辑产品' : '新增产品'" :width="isMobile ? '94%' : '400px'" :close-on-click-modal="false">
      <el-form ref="productFormRef" :model="productForm" :rules="productRules" :label-position="isMobile ? 'top' : 'left'" label-width="80px">
        <el-form-item label="成品编码" prop="code"><el-input v-model="productForm.code" placeholder="如 CP-A" /></el-form-item>
        <el-form-item label="成品名称" prop="name"><el-input v-model="productForm.name" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="productVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveProduct">保存</el-button>
      </template>
    </el-dialog>

    <!-- 配方管理 -->
    <el-dialog v-model="bomVisible" :title="`配方：${currentProduct?.code} ${currentProduct?.name}`" :width="isMobile ? '94%' : '680px'" :close-on-click-modal="false">
      <el-table :data="components" border size="small" max-height="320">
        <el-table-column prop="material_code" label="物料编码" width="100" />
        <el-table-column prop="material_name" label="物料名称" min-width="110" />
        <el-table-column prop="spec" label="规格材质" min-width="120" />
        <el-table-column prop="unit" label="单位" width="60" />
        <el-table-column label="单件耗用" width="150">
          <template #default="{ row }">
            <el-input-number v-model="row.qty_per" :min="0.01" :precision="4" size="small" style="width: 110px" @change="updateQty(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70">
          <template #default="{ row }">
            <el-popconfirm title="移除该配件？" @confirm="removeComponent(row)">
              <template #reference><el-button link type="danger">删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <!-- 添加配件 -->
      <div v-if="isAdmin" class="add-bom">
        <el-select v-model="addForm.material_id" filterable placeholder="选择配件物料" style="flex: 1">
          <el-option v-for="m in materials" :key="m.id" :label="`${m.code} ${m.name}${m.spec ? ' ('+m.spec+')' : ''}`" :value="m.id" />
        </el-select>
        <el-input-number v-model="addForm.qty_per" :min="0.01" :precision="4" placeholder="单件耗用" style="width: 120px" />
        <el-button type="primary" :loading="adding" :icon="Plus" @click="addComponent">添加</el-button>
      </div>
      <div class="bom-tip">生产 1 个成品，将按"单件耗用"扣减对应配件库存。出库选成品后自动按此配方批量扣料。</div>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import http from '../api';
import { isAdmin } from '../utils/auth';

// 手机端检测: 弹窗宽度响应式
const isMobile = ref(window.innerWidth < 992);
function onResize() { isMobile.value = window.innerWidth < 992; }
onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));

const keyword = ref('');
const page = ref(1);
const pageSize = 10;
const total = ref(0);
const list = ref([]);
const loading = ref(false);

const productVisible = ref(false);
const saving = ref(false);
const editId = ref(null);
const productFormRef = ref();
const productForm = reactive({ code: '', name: '' });
const productRules = {
  code: [{ required: true, message: '请输入成品编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入成品名称', trigger: 'blur' }],
};

const bomVisible = ref(false);
const currentProduct = ref(null);
const components = ref([]);
const materials = ref([]);
const adding = ref(false);
const addForm = reactive({ material_id: null, qty_per: 1 });

async function load(p = page.value) {
  page.value = p;
  loading.value = true;
  try {
    const res = await http.get('/products', { params: { page: page.value, pageSize, keyword: keyword.value } });
    list.value = res.data.list;
    total.value = res.data.total;
  } finally { loading.value = false; }
}

function openProduct(row) {
  editId.value = row?.id || null;
  Object.assign(productForm, row ? { code: row.code, name: row.name } : { code: '', name: '' });
  productVisible.value = true;
}

async function saveProduct() {
  await productFormRef.value.validate();
  saving.value = true;
  try {
    if (editId.value) await http.put(`/products/${editId.value}`, productForm);
    else await http.post('/products', productForm);
    ElMessage.success('保存成功');
    productVisible.value = false;
    load(editId.value ? page.value : 1);
  } catch { /* 拦截器已提示 */ } finally { saving.value = false; }
}

async function removeProduct(row) {
  await http.delete(`/products/${row.id}`);
  ElMessage.success('已停用');
  load(page.value);
}

async function loadMaterials() {
  const res = await http.get('/materials/all');
  materials.value = res.data;
}

async function openBom(row) {
  currentProduct.value = row;
  Object.assign(addForm, { material_id: null, qty_per: 1 });
  const res = await http.get(`/products/${row.id}/bom`);
  components.value = res.data;
  bomVisible.value = true;
}

async function addComponent() {
  if (!addForm.material_id) { ElMessage.warning('请选择配件物料'); return; }
  if (!Number(addForm.qty_per) || Number(addForm.qty_per) <= 0) { ElMessage.warning('请填写大于0的耗用量'); return; }
  adding.value = true;
  try {
    await http.post(`/products/${currentProduct.value.id}/bom`, { material_id: addForm.material_id, qty_per: addForm.qty_per });
    ElMessage.success('已添加到配方');
    const res = await http.get(`/products/${currentProduct.value.id}/bom`);
    components.value = res.data;
    Object.assign(addForm, { material_id: null, qty_per: 1 });
    load(page.value);
  } catch { /* 拦截器已提示 */ } finally { adding.value = false; }
}

async function updateQty(row) {
  await http.put(`/products/${currentProduct.value.id}/bom/${row.bom_id}`, { qty_per: row.qty_per });
  ElMessage.success('已更新');
}

async function removeComponent(row) {
  await http.delete(`/products/${currentProduct.value.id}/bom/${row.bom_id}`);
  ElMessage.success('已移除');
  const res = await http.get(`/products/${currentProduct.value.id}/bom`);
  components.value = res.data;
  load(page.value);
}

onMounted(() => { load(1); loadMaterials(); });
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.filters { display: flex; gap: 12px; align-items: center; }
.add-bom { display: flex; gap: 8px; margin-top: 12px; align-items: center; }
.bom-tip { margin-top: 10px; color: #909399; font-size: 12px; }
</style>
