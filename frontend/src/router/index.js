// 路由配置: 未登录跳转登录页
import { createRouter, createWebHashHistory } from 'vue-router';
import { getToken } from '../utils/auth';

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/Login.vue') },
  {
    path: '/',
    component: () => import('../layout/MainLayout.vue'),
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'Dashboard', component: () => import('../views/Dashboard.vue'), meta: { title: '库存看板' } },
      { path: 'materials', name: 'Materials', component: () => import('../views/Materials.vue'), meta: { title: '物料档案' } },
      { path: 'products', name: 'Products', component: () => import('../views/Products.vue'), meta: { title: '产品配方' } },
      { path: 'shortage', name: 'ShortageCalc', component: () => import('../views/ShortageCalc.vue'), meta: { title: '生产缺料计算' } },
      { path: 'inbound', name: 'Inbound', component: () => import('../views/Inbound.vue'), meta: { title: '入库单' } },
      { path: 'outbound', name: 'Outbound', component: () => import('../views/Outbound.vue'), meta: { title: '出库单' } },
      { path: 'return-orders', name: 'ReturnOrders', component: () => import('../views/ReturnOrders.vue'), meta: { title: '退货单' } },
      { path: 'intransit', name: 'Intransit', component: () => import('../views/Intransit.vue'), meta: { title: '采购订单' } },
      { path: 'reports', name: 'Reports', component: () => import('../views/Reports.vue'), meta: { title: '库存报表' } },
      { path: 'flows', name: 'Flows', component: () => import('../views/Flows.vue'), meta: { title: '流水台账' } },
      { path: 'users', name: 'Users', component: () => import('../views/Users.vue'), meta: { title: '用户管理' } },
      { path: 'settings', name: 'Settings', component: () => import('../views/Settings.vue'), meta: { title: '系统设置' } },
      { path: 'audit', name: 'AuditLogs', component: () => import('../views/AuditLogs.vue'), meta: { title: '审计日志' } },
      { path: 'login-logs', name: 'LoginLogs', component: () => import('../views/LoginLogs.vue'), meta: { title: '登录日志' } },
      { path: 'export', name: 'ExportData', component: () => import('../views/ExportData.vue'), meta: { title: '数据导出' } },
      { path: 'backups', name: 'Backups', component: () => import('../views/Backups.vue'), meta: { title: '数据库备份' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
];

const router = createRouter({ history: createWebHashHistory(), routes });

// 全局守卫: 需要登录
router.beforeEach((to) => {
  if (to.name !== 'Login' && !getToken()) return { name: 'Login' };
  if (to.name === 'Login' && getToken()) return { path: '/dashboard' };
  return true;
});

export default router;
