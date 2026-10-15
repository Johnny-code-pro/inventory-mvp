// 轻量物料进销存 MVP - 后端入口
require('dotenv').config(); // 读取 .env(不存在则用默认值)

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { initDb } = require('./scripts/initDb');

const authRoutes = require('./routes/auth');
const materialRoutes = require('./routes/materials');
const flowRoutes = require('./routes/flows');
const inventoryRoutes = require('./routes/inventory');
const productRoutes = require('./routes/products');
const userRoutes = require('./routes/users');
const settingRoutes = require('./routes/settings');
const intransitRoutes = require('./routes/intransit');
const auditRoutes = require('./routes/audit');
const loginLogRoutes = require('./routes/loginLogs');
const exportRoutes = require('./routes/export');
const backupRoutes = require('./routes/backup');
const reportRoutes = require('./routes/report');
const { startCleanupScheduler } = require('./utils/cleanup');

const app = express();
// CORS 收紧: 仅放行同源与本地开发端口, 其他域名跨域请求被拒
app.use(cors({
  origin(origin, cb) {
    if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) cb(null, true);
    else cb(null, false);
  },
}));
app.use(express.json());    // 解析 JSON 请求体

// 健康检查
app.get('/api/health', (req, res) => res.json({ code: 200, msg: 'ok' }));

// 业务路由
app.use('/api/auth', authRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/flows', flowRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/intransit', intransitRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/login-logs', loginLogRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/report', reportRoutes);

// 生产模式: 若前端已构建(dist), 由后端托管静态文件, 单端口(3000)同时提供页面与API
// 局域网/内网穿透都只需放行这一个端口; 未构建时仍可走前端 npm run dev 开发模式
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA 回退: 非 /api 的 GET 一律返回 index.html(hash 路由由前端接管)
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  console.log('前端构建产物已托管:', distPath);
} else {
  console.log('未找到前端构建产物(frontend/dist), 请用前端 npm run dev 开发, 或先构建: npm run build');
}

// 统一兜底 404(仅拦截 /api 未匹配接口)
app.use((req, res) => res.status(404).json({ code: 404, msg: '接口不存在' }));

// 捕获 JSON 解析异常(非法请求体), 避免未捕获异常导致进程崩溃重启
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON解析失败:', err.message);
    return res.status(400).json({ code: 400, msg: '请求数据格式错误' });
  }
  return res.status(500).json({ code: 500, msg: '服务器异常' });
});

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await initDb(); // 建库 + 建表 + 初始化默认账号
    startCleanupScheduler(); // 日志自动清理(审计/登录, 保留90天)
    app.listen(PORT, () => {
      // 列出所有非内部IPv4地址, 便于同网络电脑直接访问(含虚拟网卡)
      const ifaces = require('os').networkInterfaces();
      const lanIPs = [];
      for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name]) {
          if (iface.family === 'IPv4' && !iface.internal) lanIPs.push(iface.address);
        }
      }
      console.log('==========================================');
      console.log(`  进销存系统已启动`);
      console.log(`  本机访问 : http://127.0.0.1:${PORT}`);
      for (const ip of [...new Set(lanIPs)]) {
        console.log(`  局域网访问: http://${ip}:${PORT} (同网络电脑浏览器打开)`);
      }
      console.log('  默认账号: admin/admin123, operator/123456');
      console.log('==========================================');
    });
  } catch (e) {
    console.error('启动失败，请检查 MySQL 是否已启动且配置正确(.env):');
    console.error(e.message);
    process.exit(1);
  }
})();
