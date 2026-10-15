<template>
  <el-row :gutter="16">
    <el-col :xs="24" :md="12">
      <el-card>
        <template #header>
          <div class="card-header">
            <span>退货单</span>
            <el-radio-group v-model="mode" size="small" @change="loadRecent">
              <el-radio-button value="in">入库退货(退供应商)</el-radio-button>
              <el-radio-button value="out">出库退货(客户退回)</el-radio-button>
            </el-radio-group>
          </div>
        </template>

        <el-form :label-position="isMobile ? 'top' : 'left'" label-width="90px">
          <el-form-item label="物料明细" required>
            <div class="item-list">
              <div v-for="(row, idx) in form.items" :key="idx" class="item-row">
                <el-select v-model="row.material_id" filterable placeholder="选择物料(搜索编码/名称/规格)" style="flex: 1" @change="onChange(row)">
                  <el-option v-for="m in materials" :key="m.id" :label="matLabel(m)" :value="m.id" />
                </el-select>
                <el-input-number v-model="row.quantity" :min="0.01" :precision="2" placeholder="数量" style="width: 110px" />
                <el-tag v-if="row.stock != null && mode === 'in'" :type="row.stock <= 0 ? 'danger' : 'success'" size="small">库存{{ row.stock }}</el-tag>
                <el-button type="danger" :icon="Delete" circle @click="removeItem(idx)" />
              </div>
              <el-button type="primary" plain :icon="Plus" @click="addItem">添加物料</el-button>
            </div>
          </el-form-item>
          <el-form-item :label="mode === 'in' ? '退货供应商' : '退回客户'">
            <el-input v-model="form.party" :placeholder="mode === 'in' ? '把货退给哪个供应商' : '哪个客户退回的货'" />
          </el-form-item>
          <el-form-item label="退货原因">
            <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="选填" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="submitting" @click="submit">确认退货</el-button>
            <el-button @click="reset">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </el-col>

    <el-col :xs="24" :md="12">
      <el-card>
        <template #header><span>最近退货记录</span></template>
        <el-table :data="recent" size="small" border stripe max-height="460">
          <el-table-column prop="flow_no" label="流水号" width="160" />
          <el-table-column prop="material_name" label="物料" min-width="120" show-overflow-tooltip />
          <el-table-column prop="quantity" label="数量" width="80" />
          <el-table-column prop="counterparty" label="供应商/客户" min-width="100" show-overflow-tooltip />
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

const isMobile = ref(window.innerWidth < 992);
function onResize() { isMobile.value = window.innerWidth < 992; }
onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));

const mode = ref('in');
const submitting = ref(false);
const materials = ref([]);
const recent = ref([]);
const form = reactive({ items: [{ material_id: null, quantity: 0.01, stock: null }], party: '', remark: '' });

function matLabel(m) {
  const g = m.product_group ? `${m.product_group} · ` : '';
  const s = m.spec ? ` (${m.spec})` : '';
  return `${g}${m.name}${s} [${m.code}]`;
}
function addItem() { form.items.push({ material_id: null, quantity: 0.01, stock: null }); }
function removeItem(idx) { form.items.splice(idx, 1); }

async function onChange(row) {
  if (!row.material_id) { row.stock = null; return; }
  try { const res = await http.get(`/inventory/${row.material_id}`); row.stock = res.data.stock; } catch { row.stock = null; }
}

async function submit() {
  const rows = form.items.filter((i) => i.material_id);
  if (!rows.length) { ElMessage.warning('请至少选择一种物料'); return; }
  for (const r of rows) {
    if (!Number(r.quantity) || Number(r.quantity) <= 0) { ElMessage.warning('请填写大于0的数量'); return; }
    if (mode.value === 'in' && r.stock != null && Number(r.quantity) > Number(r.stock)) { ElMessage.warning('库存不足，无法退货'); return; }
  }
  submitting.value = true;
  try {
    const url = mode.value === 'in' ? '/flows/in-return' : '/flows/out-return';
    const body = { items: rows.map(({ material_id, quantity }) => ({ material_id, quantity })), remark: form.remark };
    if (mode.value === 'in') body.supplier = form.party; else body.customer = form.party;
    const res = await http.post(url, body);
    ElMessage.success(res.msg);
    reset(); loadRecent();
  } catch { /* 拦截器已提示 */ } finally { submitting.value = false; }
}

function reset() {
  form.items = [{ material_id: null, quantity: 0.01, stock: null }];
  form.party = ''; form.remark = '';
}

async function loadMaterials() { const res = await http.get('/materials/all'); materials.value = res.data; }
async function loadRecent() {
  const res = await http.get('/flows', { params: { pageSize: 8, category: mode.value === 'in' ? 'in_return' : 'out_return' } });
  recent.value = res.data.list;
}

onMounted(() => { loadMaterials(); loadRecent(); });
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.item-list { width: 100%; display: flex; flex-direction: column; gap: 8px; }
.item-row { display: flex; align-items: center; gap: 8px; }
</style>
