<template>
  <div>
    <!-- 每日本地备份提醒 -->
    <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 12px"
      title="请每天下班前，下载当前库存的 Excel 表格保存到本地，做好本地备份（实时库存 → 导出Excel）。" />

    <!-- 低库存预警(红色警示横幅, 置于顶部不被统计卡遮挡) -->
    <div v-if="lowList.length" class="low-warning">
      <el-icon class="lw-icon"><Warning /></el-icon>
      <div class="lw-text">
        <span class="lw-title">低库存预警</span>
        <span class="lw-desc">有 {{ lowList.length }} 项物料低于安全库存，请及时补货</span>
      </div>
      <div class="lw-actions">
        <el-button size="small" :icon="Download" @click="exportLow">导出缺货清单</el-button>
        <el-button size="small" type="danger" plain @click="onlyLow = true; load()">看板筛选</el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="12" class="stat-row">
      <el-col :xs="12" :sm="12" :md="6">
        <div class="stat-card stat-blue">
          <div class="stat-icon"><el-icon :size="22"><Box /></el-icon></div>
          <div class="stat-body">
            <div class="stat-title">物料种类</div>
            <div class="stat-value">{{ stats.materialCount }}</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <div class="stat-card stat-green">
          <div class="stat-icon"><el-icon :size="22"><Download /></el-icon></div>
          <div class="stat-body">
            <div class="stat-title">累计入库总量</div>
            <div class="stat-value">{{ fmt(stats.totalIn) }}</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <div class="stat-card stat-orange">
          <div class="stat-icon"><el-icon :size="22"><Upload /></el-icon></div>
          <div class="stat-body">
            <div class="stat-title">累计出库总量</div>
            <div class="stat-value">{{ fmt(stats.totalOut) }}</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <div class="stat-card stat-red">
          <div class="stat-icon"><el-icon :size="22"><Warning /></el-icon></div>
          <div class="stat-body">
            <div class="stat-title">低于安全库存</div>
            <div class="stat-value">{{ stats.lowStock }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 可组装成品 -->
    <el-card style="margin-top: 16px">
      <template #header>
        <div class="card-header">
          <span>可组装成品（按现有物料库存计算）</span>
          <el-select v-model="productCat" placeholder="款式" clearable style="width: 120px">
            <el-option label="A款" value="A款" /><el-option label="B款" value="B款" /><el-option label="E款" value="E款" /><el-option label="M款" value="M款" />
          </el-select>
        </div>
      </template>
      <el-table :data="filteredProducts" border stripe v-loading="prodLoading">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div style="padding: 8px 24px">
              <el-table :data="row.components" size="small" border>
                <el-table-column prop="material_code" label="物料编码" width="110" />
                <el-table-column prop="material_name" label="物料名称" min-width="110" />
                <el-table-column prop="spec" label="规格材质" min-width="110" />
                <el-table-column prop="unit" label="单位" width="60" />
                <el-table-column prop="qty_per" label="单件耗用" width="90" />
                <el-table-column prop="stock" label="当前库存" width="90" />
                <el-table-column prop="cover" label="可覆盖台数" width="100">
                  <template #default="{ row: c }">
                    <el-tag :type="c.cover <= 0 ? 'danger' : c.cover === row.can_make ? 'warning' : 'success'" size="small">{{ c.cover }}</el-tag>
                  </template>
                </el-table-column>
              </el-table>
              <div v-if="!row.components.length" class="dup-msg">该成品未配置配方</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="code" label="成品编码" width="110" sortable />
        <el-table-column prop="name" label="成品名称" min-width="140" />
        <el-table-column label="可组装数量" width="130">
          <template #default="{ row }">
            <el-tag :type="row.can_make <= 0 ? 'danger' : 'success'" effect="dark" size="large">{{ row.can_make }} 台</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="component_count" label="配件数" width="80" />
        <el-table-column label="瓶颈配件" min-width="200">
          <template #default="{ row }">
            <span v-if="row.can_make <= 0" class="dup-msg">缺料：无法组装</span>
            <span v-else class="bottleneck-text">受限于：{{ bottleneckList(row).map((c) => c.material_name).join('、') }}</span>
          </template>
        </el-table-column>
      </el-table>
      <div class="prod-tip">点成品行展开可查看所需物料明细与各配件可覆盖台数。</div>
    </el-card>

    <!-- 库存表 -->
    <el-card style="margin-top: 16px">
      <el-alert type="info" :closable="false" style="margin-bottom: 12px"
        title="共用物料只统计总库存，不拆分各成品占用量。" />
      <template #header>
        <div class="card-header">
          <span>实时库存</span>
          <div class="filters">
            <el-input v-model="keyword" placeholder="搜索编码/名称" clearable style="width: 180px" @input="load" />
            <el-select v-model="materialCat" placeholder="物料大类" clearable style="width: 120px" @change="load">
              <el-option v-for="c in materialCats" :key="c" :label="c" :value="c" />
            </el-select>
            <el-select v-model="productGroup" placeholder="商品分组" clearable filterable style="width: 140px" @change="load">
              <el-option v-for="g in groups" :key="g" :label="g" :value="g" />
            </el-select>
            <el-checkbox v-model="onlyLow" @change="load">仅看低于安全库存</el-checkbox>
            <el-button :icon="Download" :disabled="!list.length" @click="exportInventory">导出Excel</el-button>
            <el-button :icon="Refresh" @click="load">刷新</el-button>
            <el-radio-group v-model="groupView" size="small" @change="onGroupViewChange">
              <el-radio-button value="">平铺</el-radio-button>
              <el-radio-button value="material_cat">按大类分组</el-radio-button>
              <el-radio-button value="product_group">按商品分组</el-radio-button>
            </el-radio-group>
          </div>
        </div>
      </template>

      <el-table v-if="!groupView" :data="list" border stripe :row-class-name="rowClass" v-loading="loading">
        <el-table-column prop="code" label="物料编码" width="110" sortable />
        <el-table-column prop="material_cat" label="物料大类" width="100" />
        <el-table-column prop="product_group" label="商品分组" width="120" show-overflow-tooltip />
        <el-table-column prop="name" label="物料名称" min-width="110" />
        <el-table-column prop="spec" label="规格型号" min-width="120" />
        <el-table-column prop="category" label="分类" width="90" />
        <el-table-column prop="unit" label="单位" width="70" />
        <el-table-column prop="total_in" label="累计入库" width="110" sortable />
        <el-table-column prop="total_out" label="累计出库" width="110" sortable />
        <el-table-column prop="safety_stock" label="安全库存" width="110" />
        <el-table-column prop="stock" label="当前库存" width="130" sortable>
          <template #default="{ row }">
            <el-tag :type="row.stock < row.safety_stock ? 'danger' : 'success'" effect="plain">
              {{ row.stock }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="预警" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.stock < row.safety_stock" type="danger">库存不足</el-tag>
            <el-tag v-else type="success">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="isAdmin" label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="warning" @click="openAdjust(row)">调整</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分组视图(按物料大类/商品分组折叠展示) -->
      <div v-else v-loading="loading">
        <el-collapse v-model="openGroups">
          <el-collapse-item v-for="g in groupedList" :key="g.key" :name="g.key">
            <template #title>
              <span class="group-title">{{ g.key }}</span>
              <el-tag size="small" type="info" style="margin-left: 8px">{{ g.items.length }} 种</el-tag>
              <el-tag v-if="g.lowCount" size="small" type="danger" style="margin-left: 4px">低库存 {{ g.lowCount }}</el-tag>
            </template>
            <el-table :data="g.items" size="small" border :row-class-name="rowClass">
              <el-table-column prop="code" label="物料编码" width="110" />
              <el-table-column prop="name" label="物料名称" min-width="110" />
              <el-table-column prop="spec" label="规格型号" min-width="120" />
              <el-table-column prop="unit" label="单位" width="60" />
              <el-table-column prop="total_in" label="累计入库" width="100" />
              <el-table-column prop="total_out" label="累计出库" width="100" />
              <el-table-column prop="safety_stock" label="安全库存" width="100" />
              <el-table-column prop="stock" label="当前库存" width="110">
                <template #default="{ row }">
                  <el-tag :type="row.stock < row.safety_stock ? 'danger' : 'success'" effect="plain">{{ row.stock }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="预警" width="100">
                <template #default="{ row }">
                  <el-tag v-if="row.stock < row.safety_stock" type="danger">库存不足</el-tag>
                  <el-tag v-else type="success">正常</el-tag>
                </template>
              </el-table-column>
              <el-table-column v-if="isAdmin" label="操作" width="80" fixed="right">
                <template #default="{ row }">
                  <el-button link type="warning" @click="openAdjust(row)">调整</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-collapse-item>
        </el-collapse>
        <div v-if="!groupedList.length" class="prod-tip">当前没有符合条件的物料</div>
      </div>
    </el-card>

    <!-- 库存调整弹窗 -->
    <el-dialog v-model="adjustVisible" :title="`库存调整：${adjustRow?.code} ${adjustRow?.name}`" :width="isMobile ? '94%' : '420px'" :close-on-click-modal="false">
      <el-form label-width="100px">
        <el-form-item label="当前库存"><el-tag type="info">{{ adjustRow?.stock }}</el-tag></el-form-item>
        <el-form-item label="目标库存" required>
          <el-input-number v-model="adjustForm.target_stock" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="调整原因"><el-input v-model="adjustForm.reason" placeholder="如：盘点差异 / 报损 / 期初补录" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustVisible = false">取消</el-button>
        <el-button type="primary" :loading="adjusting" @click="doAdjust">确认调整</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh, Download, Upload, Box, Warning } from '@element-plus/icons-vue';
import * as XLSX from 'xlsx';
import { isAdmin } from '../utils/auth';

// 手机端检测
const isMobile = ref(window.innerWidth < 992);
function onResize() { isMobile.value = window.innerWidth < 992; }
onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));
import http from '../api';

const keyword = ref('');
const materialCat = ref('');
const materialCats = ref([]);
const productGroup = ref('');
const groups = ref([]);
const onlyLow = ref(false);
const loading = ref(false);
const list = ref([]);
const products = ref([]);
const prodLoading = ref(false);
const productCat = ref('');
const filteredProducts = computed(() => {
  if (!productCat.value) return products.value;
  return products.value.filter((p) => p.name.startsWith(productCat.value));
});
const stats = reactive({ materialCount: 0, totalIn: 0, totalOut: 0, lowStock: 0 });
const lowList = computed(() => list.value.filter((r) => Number(r.stock) < Number(r.safety_stock)));
function fmt(n) { return Number(n || 0).toLocaleString(); }

// 分组视图: 按物料大类或商品分组将物料分组折叠展示
const groupView = ref('');
const openGroups = ref([]);
const groupedList = computed(() => {
  if (!groupView.value) return [];
  const map = new Map();
  for (const r of list.value) {
    const key = groupView.value === 'material_cat' ? (r.material_cat || '未分类') : (r.product_group || '未分组');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return [...map.entries()]
    .map(([key, items]) => ({ key, items, lowCount: items.filter((i) => Number(i.stock) < Number(i.safety_stock)).length }))
    .sort((a, b) => a.key.localeCompare(b.key, 'zh'));
});
function onGroupViewChange() {
  if (!groupView.value) { openGroups.value = []; return; }
  openGroups.value = groupedList.value.map((g) => g.key); // 切换后默认全展开
}

// 库存调整(管理员): 直接设目标库存, 差额生成盘盈/盘亏流水
const adjustVisible = ref(false);
const adjusting = ref(false);
const adjustRow = ref(null);
const adjustForm = reactive({ target_stock: 0, reason: '' });

function openAdjust(row) {
  adjustRow.value = row;
  adjustForm.target_stock = Number(row.stock);
  adjustForm.reason = '';
  adjustVisible.value = true;
}

async function doAdjust() {
  if (adjustForm.target_stock < 0 || !Number.isFinite(adjustForm.target_stock)) { ElMessage.warning('请填写有效的目标库存'); return; }
  adjusting.value = true;
  try {
    const res = await http.post('/inventory/adjust', { material_id: adjustRow.value.id, target_stock: adjustForm.target_stock, reason: adjustForm.reason });
    ElMessage.success(res.msg);
    adjustVisible.value = false;
    load();
    loadStats();
  } catch { /* 拦截器已提示 */ } finally { adjusting.value = false; }
}

// 返回限制产量的瓶颈配件(可覆盖台数=可组装数 的配件)
function bottleneckList(row) {
  if (!row.components.length || row.can_make <= 0) return [];
  return row.components.filter((c) => c.cover === row.can_make);
}

// 导出缺货清单(客户端生成)
function exportLow() {
  if (!lowList.value.length) { ElMessage.warning('当前没有低库存物料'); return; }
  const data = lowList.value.map((r) => ({
    '物料编码': r.code, '物料名称': r.name, '规格型号': r.spec, '单位': r.unit,
    '当前库存': r.stock, '安全库存': r.safety_stock, '缺货数量': Number(r.safety_stock) - Number(r.stock),
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '低库存清单');
  XLSX.writeFile(wb, '低库存清单.xlsx');
}

// 导出实时库存(按当前筛选条件)
function exportInventory() {
  if (!list.value.length) { ElMessage.warning('当前没有可导出的库存数据'); return; }
  const data = list.value.map((r) => ({
    '物料编码': r.code,
    '物料大类': r.material_cat,
    '商品分组': r.product_group || '',
    '物料名称': r.name,
    '规格型号': r.spec || '',
    '分类': r.category || '',
    '单位': r.unit || '',
    '累计入库': r.total_in,
    '累计出库': r.total_out,
    '安全库存': r.safety_stock,
    '当前库存': r.stock,
    '库存状态': Number(r.stock) < Number(r.safety_stock) ? '库存不足' : '正常',
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 8 }, { wch: 6 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '实时库存');
  XLSX.writeFile(wb, `实时库存_${Date.now()}.xlsx`);
  ElMessage.success(`已导出 ${data.length} 条库存`);
}

async function loadProducts() {
  prodLoading.value = true;
  try {
    const res = await http.get('/inventory/products');
    products.value = res.data;
  } finally { prodLoading.value = false; }
}

async function load() {
  loading.value = true;
  try {
    const params = { keyword: keyword.value || '', low_stock: onlyLow.value ? '1' : '', material_cat: materialCat.value || '', product_group: productGroup.value || '' };
    const res = await http.get('/inventory', { params });
    list.value = res.data;
  } finally { loading.value = false; }
}

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

async function loadStats() {
  const res = await http.get('/inventory/stats');
  Object.assign(stats, res.data);
}

// 低库存行整行标红
function rowClass({ row }) {
  return Number(row.stock) < Number(row.safety_stock) ? 'low-stock-row' : '';
}

onMounted(() => { load(); loadStats(); loadProducts(); loadGroups(); loadMaterialCats(); });
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.card-header > span { font-size: 15px; font-weight: 600; color: var(--app-text); }
.filters { display: flex; gap: 12px; align-items: center; }
.dup-msg { color: var(--app-danger-text); font-size: 12px; }
.bottleneck-text { color: #d48806; font-size: 12px; }
.prod-tip { color: var(--app-text-3); font-size: 12px; margin-top: 8px; }
.group-title { font-weight: 600; color: var(--app-text); }
:deep(.low-stock-row) { background: var(--app-soft-danger) !important; }

/* ===== 低库存预警(红色警示横幅, 与卡片模块明显区分) ===== */
.low-warning {
  display: flex; align-items: center; gap: 12px;
  margin: 0 0 16px; padding: 14px 18px;
  border-radius: 16px;
  background: var(--app-soft-danger);
  border: 1px solid var(--app-danger-border);
}
.lw-icon { font-size: 22px; color: var(--app-danger-text); flex-shrink: 0; }
.lw-text { display: flex; flex-direction: column; line-height: 1.4; min-width: 0; }
.lw-title { font-weight: 600; color: var(--app-danger-text); font-size: 14px; }
.lw-desc { color: var(--app-danger-text); font-size: 12px; opacity: .9; }
.lw-actions { margin-left: auto; display: flex; gap: 8px; flex-shrink: 0; }
@media (max-width: 992px) {
  .low-warning { flex-wrap: wrap; }
  .lw-actions { margin-left: 0; width: 100%; }
  .lw-actions .el-button { flex: 1; }
}

/* ===== 统计卡片 ===== */
.stat-row { margin-bottom: 4px; }
.stat-card {
  display: flex; align-items: center; gap: 14px;
  background: var(--app-card-bg);
  border: 1px solid var(--app-card-border);
  border-radius: 16px; padding: 18px 16px;
  box-shadow: var(--app-shadow);
  height: 100%;
  transition: transform .2s ease, box-shadow .2s ease;
}
.stat-card:hover { transform: translateY(-2px); box-shadow: 0 16px 32px rgba(30, 41, 59, .1); }
.stat-icon {
  width: 46px; height: 46px; border-radius: 12px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.stat-blue .stat-icon { background: var(--app-soft-primary); color: var(--el-color-primary); }
.stat-green .stat-icon { background: var(--app-soft-success); color: #34c759; }
.stat-orange .stat-icon { background: var(--app-soft-warning); color: #d48806; }
.stat-red .stat-icon { background: var(--app-soft-danger); color: var(--app-danger-text); }
.stat-title { color: var(--app-text-3); font-size: 13px; }
.stat-value { font-size: 26px; font-weight: 700; color: var(--app-text); line-height: 1.3; margin-top: 2px; }

/* ===== 扁平卡片/表格 ===== */
:deep(.el-card) {
  background: var(--app-card-bg);
  border: 1px solid var(--app-card-border);
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, .06);
}
:deep(.el-card__header) { padding: 14px 16px; border-bottom: 1px solid var(--app-card-border); }
:deep(.el-card__body) { padding: 16px; }
:deep(.el-table th.el-table__cell) { font-weight: 600; color: var(--app-text-2); }
/* 表格行间距增大, 视觉更通透 */
:deep(.el-table .el-table__cell) { padding: 12px 8px; }
:deep(.el-alert) { border-radius: 8px; }

@media (max-width: 992px) {
  .stat-value { font-size: 20px; }
  .stat-icon { width: 40px; height: 40px; border-radius: 8px; }
  .stat-card { padding: 14px 12px; gap: 10px; }
}
</style>
