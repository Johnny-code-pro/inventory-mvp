<template>
  <el-row :gutter="16">
    <!-- 入库单录入 -->
    <el-col :xs="24" :md="12">
      <el-card>
        <template #header>
          <div class="card-header">
            <span>入库单</span>
            <div class="header-right">
              <el-radio-group v-model="mode" size="small">
                <el-radio-button value="material">按物料入库</el-radio-button>
                <el-radio-button value="product">按成品入库(BOM)</el-radio-button>
              </el-radio-group>
              <el-button type="success" plain size="small" :icon="Upload" @click="importVisible = true">导入Excel</el-button>
            </div>
          </div>
        </template>
        <el-form v-if="mode === 'material'" ref="formRef" :model="form" :label-position="isMobile ? 'top' : 'left'" label-width="90px">
          <!-- 物料多选列表 -->
          <el-form-item label="物料明细" required>
            <div class="item-list">
              <div v-for="(row, idx) in form.items" :key="idx" class="item-row">
                <el-select v-model="row.material_id" filterable placeholder="选择物料（搜索编码/名称/规格）" style="flex: 1" @change="checkDuplicate(idx)">
                  <el-option v-for="m in materials" :key="m.id" :label="matLabel(m)" :value="m.id" />
                </el-select>
                <el-input-number v-model="row.quantity" :min="0.01" :precision="2" placeholder="数量" style="width: 130px" />
                <el-tag v-if="row.material_id" type="info">{{ unitOf(row.material_id) }}</el-tag>
                <el-button type="danger" :icon="Delete" circle @click="removeItem(idx)" />
              </div>
              <el-button type="primary" plain :icon="Plus" @click="addItem">添加物料</el-button>
              <div v-if="dupMsg" class="dup-msg">{{ dupMsg }}</div>
            </div>
          </el-form-item>
          <el-form-item label="供应商" prop="supplier">
            <el-input v-model="form.supplier" placeholder="本单供应商" />
          </el-form-item>
          <el-form-item label="备注" prop="remark">
            <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="本单备注（选填）" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="submitting" @click="submit">确认入库</el-button>
            <el-button @click="reset">重置</el-button>
          </el-form-item>
        </el-form>

        <!-- 按成品入库 -->
        <el-form v-else :model="pform" :label-position="isMobile ? 'top' : 'left'" label-width="90px">
          <el-form-item label="成品" required>
            <el-select v-model="pform.product_id" filterable placeholder="选择成品（按配方自动增加配件库存）" style="width: 100%" @change="onProductChange">
              <el-option v-for="p in products" :key="p.id" :label="`${p.code} ${p.name}`" :value="p.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="入库数量" required>
            <el-input-number v-model="pform.quantity" :min="1" :precision="2" style="width: 180px" @change="onProductChange" />
          </el-form-item>
          <el-form-item label="供应商"><el-input v-model="pform.supplier" /></el-form-item>
          <el-form-item label="备注"><el-input v-model="pform.remark" type="textarea" :rows="2" /></el-form-item>
          <el-form-item label="入库预览">
            <el-table :data="preview" size="small" border max-height="200">
              <el-table-column prop="material_code" label="物料编码" width="100" />
              <el-table-column prop="material_name" label="物料名称" min-width="110" />
              <el-table-column prop="quantity" label="增加数量" width="90" />
              <el-table-column prop="unit" label="单位" width="60" />
            </el-table>
            <div v-if="previewMsg" class="dup-msg">{{ previewMsg }}</div>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="submitting" @click="submitProduct">确认成品入库</el-button>
            <el-button @click="reset">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </el-col>

    <!-- 最近入库记录 -->
    <el-col :xs="24" :md="12">
      <el-card>
        <template #header><span>最近入库记录</span></template>
        <el-table :data="recent" size="small" border stripe max-height="460">
          <el-table-column prop="flow_no" label="流水号" width="150" />
          <el-table-column prop="material_name" label="物料" min-width="130" show-overflow-tooltip />
          <el-table-column prop="quantity" label="数量" width="80" />
          <el-table-column prop="counterparty" label="供应商" min-width="90" show-overflow-tooltip />
          <el-table-column prop="created_at" label="时间" width="160" />
        </el-table>
      </el-card>
    </el-col>
  </el-row>

  <!-- 入库Excel导入弹窗 -->
  <el-dialog v-model="importVisible" title="批量导入入库单(Excel)" width="560px" :close-on-click-modal="false">
    <div class="import-tip">
      <p>1. 按模板列顺序：日期 | 成品 | 货物名称 | 规格及材质 | 单位 | 数量 | 备注</p>
      <p>2. 系统按"货物名称+规格及材质+单位"自动匹配物料，<b>匹配不到的会提示先去"物料档案"建档</b></p>
      <p>3. 日期支持 2026-08-08 或 Excel 日期格式；"成品"列会记入流水备注</p>
      <el-button :icon="Download" @click="downloadInTemplate">下载入库导入模板</el-button>
    </div>
    <el-upload
      accept=".xlsx,.xls"
      :show-file-list="false"
      :http-request="doImportIn"
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
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Delete, Upload, Download } from '@element-plus/icons-vue';
import * as XLSX from 'xlsx';
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
const form = reactive({ items: [{ material_id: null, quantity: 0.01 }], supplier: '', remark: '' });
const pform = reactive({ product_id: null, quantity: 1, supplier: '', remark: '' });
const preview = ref([]);
const previewMsg = ref('');
const importVisible = ref(false);
const importing = ref(false);
const importResult = ref(null);

// 物料下拉文案: 商品分组 · 名称(规格) [编码]
function matLabel(m) {
  const group = m.product_group ? `${m.product_group} · ` : '';
  const spec = m.spec ? ` (${m.spec})` : '';
  return `${group}${m.name}${spec} [${m.code}]`;
}

function unitOf(id) {
  const m = materials.value.find((x) => x.id === id);
  return m ? m.unit : '';
}

function addItem() {
  form.items.push({ material_id: null, quantity: 0.01 });
}

function removeItem(idx) {
  form.items.splice(idx, 1);
  checkDuplicate();
}

// 同一物料不可重复选择
function checkDuplicate() {
  const ids = form.items.map((i) => i.material_id).filter(Boolean);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  dupMsg.value = dup ? '同一物料不能重复添加，请检查' : '';
}

async function loadMaterials() {
  const res = await http.get('/materials/all');
  materials.value = res.data;
}

async function loadProducts() {
  const res = await http.get('/products/all');
  products.value = res.data;
}

async function loadRecent() {
  const res = await http.get('/flows', { params: { type: 'IN', pageSize: 8 } });
  recent.value = res.data.list;
}

// 选中成品后按配方计算入库预览
async function onProductChange() {
  preview.value = [];
  previewMsg.value = '';
  if (!pform.product_id) return;
  const res = await http.get(`/products/${pform.product_id}/bom`);
  const bom = res.data;
  if (!bom.length) { previewMsg.value = '该成品未配置配方，请先在"产品配方"中添加配件'; return; }
  preview.value = bom.map((b) => ({
    material_code: b.material_code, material_name: b.material_name, unit: b.unit,
    quantity: Number(b.qty_per) * Number(pform.quantity),
  }));
}

async function submitProduct() {
  if (!pform.product_id) { ElMessage.warning('请选择成品'); return; }
  if (!Number(pform.quantity) || Number(pform.quantity) <= 0) { ElMessage.warning('请填写大于0的数量'); return; }
  if (previewMsg.value) { ElMessage.warning(previewMsg.value); return; }
  submitting.value = true;
  try {
    const res = await http.post('/flows/in-product', pform);
    ElMessage.success(res.msg);
    reset();
    loadRecent();
  } catch { /* 拦截器已提示 */ } finally { submitting.value = false; }
}

async function submit() {
  const rows = form.items.filter((i) => i.material_id && Number(i.quantity) > 0);
  if (rows.length === 0) { ElMessage.warning('请至少选择一种物料并填写数量'); return; }
  if (dupMsg.value) { ElMessage.warning(dupMsg.value); return; }

  submitting.value = true;
  try {
    const res = await http.post('/flows/in', { items: rows, supplier: form.supplier, remark: form.remark });
    ElMessage.success(`${res.msg}，流水号：${res.data.flow_nos.join('、')}`);
    reset();
    loadRecent();
  } catch { /* 拦截器已提示 */ } finally { submitting.value = false; }
}

function reset() {
  form.items = [{ material_id: null, quantity: 0.01 }];
  form.supplier = '';
  form.remark = '';
  Object.assign(pform, { product_id: null, quantity: 1, supplier: '', remark: '' });
  preview.value = [];
  previewMsg.value = '';
  dupMsg.value = '';
  formRef.value?.clearValidate();
}

// 下载入库导入模板(客户端生成, 仅表头)
function downloadInTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([['日期', '成品', '货物名称', '规格及材质', '单位', '数量', '备注']]);
  ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 8 }, { wch: 10 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '入库导入模板');
  XLSX.writeFile(wb, '入库导入模板.xlsx');
}

// 上传Excel批量导入入库(客户端解析, 兼容用户模板列)
async function doImportIn({ file }) {
  importing.value = true;
  importResult.value = null;
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const header = (arr[0] || []).map((h) => String(h || '').trim());
    const ci = {
      date: header.indexOf('日期'),
      name: header.indexOf('货物名称'),
      spec: header.indexOf('规格及材质') > -1 ? header.indexOf('规格及材质') : header.indexOf('规格材质'),
      unit: header.indexOf('单位'),
      qty: header.indexOf('数量'),
      remark: header.indexOf('备注'),
      product: header.indexOf('成品') > -1 ? header.indexOf('成品') : (header.indexOf('日期') > -1 ? header.indexOf('日期') + 1 : -1),
    };
    const rows = [];
    for (let i = 1; i < arr.length; i++) {
      const r = arr[i];
      const name = String(r[ci.name] || '').trim();
      const qty = Number(r[ci.qty]);
      if (!name && !qty) continue;
      rows.push({
        date: r[ci.date],
        product: ci.product > -1 ? String(r[ci.product] || '').trim() : '',
        name,
        spec: String(r[ci.spec] || '').trim(),
        unit: String(r[ci.unit] || '').trim(),
        qty,
        remark: String(r[ci.remark] || '').trim(),
      });
    }
    const res = await http.post('/flows/import-in', { rows });
    ElMessage.success(res.msg);
    importResult.value = res.data;
    loadMaterials();
    loadRecent();
  } catch { /* 拦截器已提示 */ } finally { importing.value = false; }
}

onMounted(() => { loadMaterials(); loadProducts(); loadRecent(); });
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.header-right { display: flex; gap: 10px; align-items: center; }
.item-list { width: 100%; display: flex; flex-direction: column; gap: 8px; }
.item-row { display: flex; align-items: center; gap: 8px; }
.dup-msg { color: #f56c6c; font-size: 12px; }
.import-tip { color: #666; font-size: 13px; line-height: 1.8; }
.import-tip p { margin: 0 0 6px; }
.error-list { max-height: 180px; overflow: auto; margin-top: 8px; border: 1px solid #fbe0e0; background: #fef0f0; border-radius: 4px; padding: 8px; }
.error-line { color: #f56c6c; font-size: 12px; line-height: 1.8; }
</style>
