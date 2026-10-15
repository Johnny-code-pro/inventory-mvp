import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/dist/locale/zh-cn.mjs';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import App from './App.vue';
import router from './router';

// 全局挂载 Element Plus(中文) + 路由
createApp(App).use(ElementPlus, { locale: zhCn }).use(router).mount('#app');
