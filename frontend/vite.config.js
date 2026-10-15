import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Vite 配置: 开发端口 5173, /api 代理到后端 3000
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
