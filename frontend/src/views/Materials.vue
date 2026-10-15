<template>
  <el-card>
    <el-alert type="info" :closable="false" style="margin-bottom: 12px"
      title="物料大类可自由编辑（默认提供原材料/包装辅料/配套小件，可输入新大类）。同一商品的不同规格共用一个「商品分组」；多成品通用的物料只建一条档案，领用时靠「出库方向」区分。" />
    <template #header>
      <div class="card-header">
        <span>物料档案</span>
        <div class="filters">
          <el-input v-model="keyword" placeholder="搜索编码/名称" clearable style="width: 180px" @input="load(1)" />
          <el-select v-model="materialCat" placeholder="物料大类" clearable style="width: 120px" @change="load(1)">
            <el-option v-for="c in materialCats" :key="c" :label="c" :value="c" />
          </el-select>
          <el-select v-model="category" placeholder="分类" clearable style="width: 110px" @change="load(1)">
            <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
          </el-select>
          <el-select v-model="group" placeholder="商品分组" clearable style="width: 130px" @change="load(1)">
            <el-option v-for="g in groups" :key="g" :label="g" :value="g" />
          </el-select>
          <el-button v-if="isAdmin" type="success" plain :icon="Upload" @click="importVisible = true">导入Excel</el-button>
          <el-button v-if="isAdmin" type="primary" :icon="Plus" @click="openDialog()">新增物料</el-button>
        </div>
      </div>
    </template>

    <el-table :data="list" border stripe v-loading="loading">
      <el-table-column prop="code" label="物料编码" width="110" />
      <el-table-column prop="material_cat" label="物料大类" width="100" />
      <el-table-column label="商品分组" width="150">
        <template #default="{ row }">
          <div class="group-tags">
            <el-tag v-for="g in row.group_list" :key="g" size="small">{{ g }}</el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="物料名称" min-width="110" />
      <el-table-column prop="spec" label="规格型号" min-width="110" />
      <el-table-column prop="unit" label="单位" width="60" />
      <el-table-column prop="category" label="分类" width="90" />
      <el-table-column prop="safety_stock" label="安全库存" width="90" />
      <el-table-column prop="created_at" label="建档时间" width="160" />
      <el-table-column v-if="isAdmin" label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-popconfirm title="停用后该物料不可用于录单，确定停用？" @confirm="remove(row)">
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

    <!-- 新增/编辑弹窗(仅管理员可见) -->
    <el-dialog v-model="dialogVisible" :title="editId ? '编辑物料' : '新增物料'" :width="isMobile ? '94%' : '460px'" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" :label-position="isMobile ? 'top' : 'left'" label-width="90px">
        <el-form-item label="物料编码" prop="code"><el-input v-model="form.code" placeholder="唯一编码，手动填写" /></el-form-item>
        <el-form-item label="物料大类" prop="material_cat">
          <el-select v-model="form.material_cat" filterable allow-create default-first-option clearable placeholder="选择或输入自定义大类" style="width: 100%">
            <el-option v-for="c in materialCats" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="商品分组">
          <el-select
            v-model="form.group_list" multiple filterable allow-create default-first-option clearable
            placeholder="可多选或输入自定义分组（同一物料可属于多个组）" style="width: 100%"
          >
            <el-option v-for="g in groups" :key="g" :label="g" :value="g" />
          </el-select>
        </el-form-item>
        <el-form-item label="物料名称" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="规格型号" prop="spec"><el-input v-model="form.spec" placeholder="规格型号，如 D6*2 / 330MM / 50米" /></el-form-item>
        <el-form-item label="单位" prop="unit"><el-input v-model="form.unit" placeholder="如 个 / 件 / 箱 / 米" /></el-form-item>
        <el-form-item label="分类" prop="category"><el-input v-model="form.category" /></el-form-item>
        <el-form-item label="安全库存" prop="safety_stock">
          <el-input-number v-model="form.safety_stock" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <!-- 批量导入弹窗(仅管理员) -->
    <el-dialog v-model="importVisible" title="批量导入物料(Excel)" :width="isMobile ? '94%' : '540px'" :close-on-click-modal="false">
      <div class="import-tip">
        <p>1. 先下载模板，按模板格式填写（表头勿改，示例行可删除）</p>
        <p>2. 表头顺序：物料编码 | 物料名称 | 物料大类 | 规格型号 | 单位 | 分类 | 商品分组 | 安全库存</p>
        <p>3. 物料编码必填且唯一，重复或已存在的编码会自动跳过并提示</p>
        <el-button :icon="Download" @click="downloadTemplate">下载模板</el-button>
      </div>
      <el-upload
        accept=".xlsx,.xls"
        :show-file-list="false"
        :http-request="doImport"
        :disabled="importing"
        style="margin-top: 12px"
      >
        <el-button type="primary" :loading="importing" :icon="Upload">选择Excel文件上传</el-button>
      </el-upload>
      <div v-if="importResult" style="margin-top: 12px">
        <el-alert
          :title="`导入完成：成功 ${importResult.success} 条，失败 ${importResult.errors.length} 条`"
          :type="importResult.errors.length ? 'warning' : 'success'"
          :closable="false"
          show-icon
        />
        <div v-if="importResult.errors.length" class="error-list">
          <div v-for="(e, i) in importResult.errors" :key="i" class="error-line">{{ e }}</div>
        </div>
      </div>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Upload, Download } from '@element-plus/icons-vue';
import * as XLSX from 'xlsx';
import http from '../api';
import { isAdmin } from '../utils/auth';

// 手机端检测: 弹窗宽度与表单标签响应式
const isMobile = ref(window.innerWidth < 992);
function onResize() { isMobile.value = window.innerWidth < 992; }
onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));

const keyword = ref('');
const category = ref('');
const group = ref('');
const materialCat = ref('');
const materialCats = ref([]);
const categories = computed(() => [...new Set(list.value.map((i) => i.category).filter(Boolean))]);
const groups = ref([]);

const page = ref(1);
const pageSize = 10;
const total = ref(0);
const list = ref([]);
const loading = ref(false);

const dialogVisible = ref(false);
const saving = ref(false);
const editId = ref(null);
const importVisible = ref(false);
const importing = ref(false);
const importResult = ref(null);
const formRef = ref();
const form = reactive({ code: '', name: '', spec: '', unit: '', category: '', material_cat: '原材料', group_list: [], safety_stock: 0 });
const rules = {
  code: [{ required: true, message: '请输入物料编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入物料名称', trigger: 'blur' }],
  material_cat: [{ required: true, message: '请选择或输入物料大类', trigger: 'change' }],
};

async function loadGroups() {
  try {
    const res = await http.get('/materials/groups');
    groups.value = res.data;
  } catch { /* 拦截器已提示 */ }
}

async function loadMaterialCats() {
  try {
    const res = await http.get('/materials/material-cats');
    materialCats.value = res.data;
  } catch { /* 拦截器已提示 */ }
}

async function load(p = page.value) {
  page.value = p;
  loading.value = true;
  try {
    const res = await http.get('/materials', {
      params: { page: page.value, pageSize, keyword: keyword.value, category: category.value, product_group: group.value, material_cat: materialCat.value },
    });
    list.value = res.data.list.map((r) => ({ ...r, group_list: String(r.product_group || '').split(',').map((g) => g.trim()).filter(Boolean) }));
    total.value = res.data.total;
  } finally { loading.value = false; }
}

function openDialog(row) {
  editId.value = row?.id || null;
  Object.assign(form, row
    ? { ...row, group_list: String(row.product_group || '').split(',').map((g) => g.trim()).filter(Boolean) }
    : { code: '', name: '', spec: '', unit: '', category: '', material_cat: '原材料', group_list: [], safety_stock: 0 });
  dialogVisible.value = true;
}

async function save() {
  await formRef.value.validate();
  saving.value = true;
  try {
    const payload = { ...form, product_group: form.group_list.join(',') };
    if (editId.value) await http.put(`/materials/${editId.value}`, payload);
    else await http.post('/materials', payload);
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    load(editId.value ? page.value : 1);
    loadGroups();
  } catch { /* 拦截器已提示 */ } finally { saving.value = false; }
}

async function remove(row) {
  await http.delete(`/materials/${row.id}`);
  ElMessage.success('已停用');
  load(page.value);
  loadGroups();
}

// 下载导入模板(客户端生成, 仅表头)
function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([['物料编码', '物料名称', '物料大类', '规格型号', '单位', '分类', '商品分组', '安全库存']]);
  ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '物料导入模板');
  XLSX.writeFile(wb, '物料导入模板.xlsx');
}

// 上传Excel并导入(客户端解析)
async function doImport({ file }) {
  importing.value = true;
  importResult.value = null;
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }).map((r) => ({
      code: String(r['物料编码'] || '').trim(),
      name: String(r['物料名称'] || '').trim(),
      spec: String(r['规格型号'] || '').trim(),
      unit: String(r['单位'] || '').trim(),
      category: String(r['分类'] || '').trim(),
      material_cat: String(r['物料大类'] || '').trim() || '其他',
      product_group: String(r['商品分组'] || '').trim(),
      safety_stock: Number(r['安全库存']) || 0,
    }));
    const res = await http.post('/materials/import', { rows });
    ElMessage.success(res.msg);
    importResult.value = res.data;
    load(1);
    loadGroups();
  } catch { /* 拦截器已提示 */ } finally { importing.value = false; }
}

onMounted(() => { load(1); loadGroups(); loadMaterialCats(); });
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.filters { display: flex; gap: 12px; align-items: center; }
.group-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.import-tip { color: #666; font-size: 13px; line-height: 1.8; }
.import-tip p { margin: 0 0 6px; }
.error-list { max-height: 180px; overflow: auto; margin-top: 8px; border: 1px solid #fbe0e0; background: #fef0f0; border-radius: 4px; padding: 8px; }
.error-line { color: #f56c6c; font-size: 12px; line-height: 1.8; }
</style>
