<template>
  <el-container style="height: 100vh">
    <!-- 左侧菜单(桌面) -->
    <el-aside v-if="!isMobile" width="224px" class="aside-glass">
      <div class="brand">
        <div class="brand-mark">进</div>
        <div>
          <div class="logo">进销存管理系统</div>
          <div class="brand-caption">Inventory workspace</div>
        </div>
      </div>
      <el-menu :default-active="$route.path" router class="app-menu">
        <el-menu-item v-for="m in visibleMenu" :key="m.path" :index="m.path">
          <el-icon><component :is="m.icon" /></el-icon><span>{{ m.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <!-- 顶部栏 -->
      <el-header class="header">
        <div class="header-left">
          <el-button v-if="isMobile" :icon="Menu" circle @click="menuOpen = true" />
          <div>
            <div class="eyebrow">WORKSPACE</div>
            <span>{{ $route.meta.title }}</span>
          </div>
        </div>
        <div class="header-right">
          <el-tag v-if="isSuperUser" type="danger" size="small">超级管理员</el-tag>
          <el-tag v-else-if="isAdminUser" type="success" size="small">管理员</el-tag>
          <el-tag v-else type="info" size="small">操作员</el-tag>
          <span class="user-name">{{ user?.real_name || user?.username }}</span>
          <el-button link :icon="isDark ? Sunny : Moon" :title="isDark ? '切换到浅色模式' : '切换到深色模式'" @click="toggleTheme" />
          <el-button link type="primary" @click="logout">退出登录</el-button>
        </div>
      </el-header>

      <!-- 内容区 -->
      <el-main class="main-area">
        <router-view />
      </el-main>
    </el-container>
  </el-container>

  <!-- 移动端抽屉菜单 -->
  <el-drawer v-model="menuOpen" direction="ltr" size="210px" :with-header="false" style="background: var(--app-sidebar-bg)">
    <div class="brand">
      <div class="brand-mark">进</div>
      <div>
        <div class="logo">进销存管理系统</div>
        <div class="brand-caption">Inventory workspace</div>
      </div>
    </div>
    <el-menu :default-active="$route.path" router class="app-menu" @select="menuOpen = false">
      <el-menu-item v-for="m in visibleMenu" :key="m.path" :index="m.path">
        <el-icon><component :is="m.icon" /></el-icon>{{ m.title }}
      </el-menu-item>
    </el-menu>
  </el-drawer>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Odometer, Box, Cpu, Aim, Download, Upload, Tickets, Van, User, Setting, Document, Menu, Moon, Sunny, Key, FolderOpened, RefreshLeft, DataAnalysis, Folder } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import http from '../api';
import { getUser, setUser, clearAuth } from '../utils/auth';
import { getTheme, applyTheme, initTheme } from '../utils/theme';

const router = useRouter();
const user = ref(getUser());
const isAdminUser = computed(() => user.value && (user.value.role === 'admin' || user.value.role === 'superadmin'));
const isSuperUser = computed(() => user.value?.role === 'superadmin');

// 主题切换(浅色/深色)
const isDark = ref(getTheme() === 'dark');
function toggleTheme() {
  isDark.value = !isDark.value;
  applyTheme(isDark.value ? 'dark' : 'light');
}

// 移动端判定(992px 以下)
const isMobile = ref(window.innerWidth < 992);
const menuOpen = ref(false);
function onResize() { isMobile.value = window.innerWidth < 992; }
onMounted(() => {
  window.addEventListener('resize', onResize);
  initTheme();
  isDark.value = getTheme() === 'dark';
  refreshUser();
});
onUnmounted(() => window.removeEventListener('resize', onResize));

// 菜单项: admin/super 标记可见角色
const menu = [
  { path: '/dashboard', title: '库存看板', icon: Odometer },
  { path: '/materials', title: '物料档案', icon: Box },
  { path: '/products', title: '产品配方', icon: Cpu },
  { path: '/shortage', title: '生产缺料计算', icon: Aim },
  { path: '/reports', title: '库存报表', icon: DataAnalysis },
  { path: '/inbound', title: '入库单', icon: Download },
  { path: '/outbound', title: '出库单', icon: Upload },
  { path: '/return-orders', title: '退货单', icon: RefreshLeft },
  { path: '/intransit', title: '采购订单', icon: Van },
  { path: '/flows', title: '流水台账', icon: Tickets },
  { path: '/audit', title: '审计日志', icon: Document, admin: true },
  { path: '/login-logs', title: '登录日志', icon: Key, super: true },
  { path: '/export', title: '数据导出', icon: FolderOpened, super: true },
  { path: '/backups', title: '数据库备份', icon: Folder, super: true },
  { path: '/users', title: '用户管理', icon: User, super: true },
  { path: '/settings', title: '系统设置', icon: Setting, super: true },
];
const visibleMenu = computed(() => menu.filter((m) =>
  m.super ? isSuperUser.value : (m.admin ? isAdminUser.value : true)
));

// 挂载时从服务器刷新真实登录用户, 避免本地缓存旧角色误导
async function refreshUser() {
  try {
    const res = await http.get('/auth/me');
    if (res.data) { setUser(res.data); user.value = res.data; }
  } catch { /* 登录失效已由拦截器处理 */ }
}

function logout() {
  ElMessageBox.confirm('确定退出登录吗？', '提示', { type: 'warning' })
    .then(() => { clearAuth(); router.push('/login'); })
    .catch(() => {});
}
</script>

<style scoped>
.brand { display: flex; align-items: center; gap: 10px; padding: 20px 18px 18px; }
.brand-mark { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 10px; background: var(--app-soft-primary); color: var(--el-color-primary); font-size: 17px; font-weight: 800; }
.logo { color: var(--app-logo-text); font-size: 15px; font-weight: 700; letter-spacing: .2px; white-space: nowrap; }
.brand-caption { color: var(--app-text-3); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; margin-top: 3px; }
.aside-glass { background: var(--app-sidebar-bg); border-right: 1px solid var(--app-card-border); backdrop-filter: blur(18px); }
.app-menu { border-right: 0; background: transparent; padding: 4px 10px; }
.app-menu :deep(.el-menu-item) { height: 42px; margin: 3px 0; border-radius: 10px; color: var(--app-text-2); font-size: 13px; transition: color .2s ease, background-color .2s ease, transform .2s ease; }
.app-menu :deep(.el-menu-item .el-icon) { margin-right: 10px; font-size: 17px; }
.app-menu :deep(.el-menu-item:hover) { color: var(--app-text); background: var(--app-table-header); }
.app-menu :deep(.el-menu-item.is-active) { color: var(--el-color-primary); background: var(--app-soft-primary); font-weight: 600; }
.app-menu :deep(.el-menu-item.is-active::before) { content: ''; width: 3px; height: 18px; position: absolute; left: 0; border-radius: 0 3px 3px 0; background: var(--el-color-primary); }
.header {
  display: flex; align-items: center; justify-content: space-between;
  background: color-mix(in srgb, var(--app-card-bg) 92%, transparent);
  border-bottom: 1px solid var(--app-card-border);
  box-shadow: 0 1px 2px rgba(0, 0, 0, .04);
  backdrop-filter: blur(18px);
  font-size: 16px; font-weight: 600;
}
.header-left { display: flex; align-items: center; gap: 10px; }
.eyebrow { color: var(--app-text-3); font-size: 9px; font-weight: 600; letter-spacing: .12em; line-height: 1.2; }
.header-right { display: flex; align-items: center; gap: 12px; font-weight: 400; font-size: 14px; }
.user-name { color: var(--app-text); font-weight: 500; }
.main-area { padding: 18px; background: transparent; }
@media (max-width: 992px) {
  .main-area { padding: 10px; }
  .header { font-size: 14px; padding: 0 10px; }
  .header-right { gap: 5px; }
  .user-name { display: none; }
  .brand { padding: 16px 14px; }
  .logo { font-size: 14px; }
  .app-menu { padding: 4px 8px; }
}
</style>
