// Axios 封装: 统一携带 token + 统一处理错误/登录过期
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { getToken, clearAuth } from '../utils/auth';

const http = axios.create({ baseURL: '/api', timeout: 15000 });

// 请求拦截: 附带 token
http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 响应拦截: 统一错误提示; 401 跳转登录
http.interceptors.response.use(
  (res) => {
    const data = res.data;
    if (data.code && data.code !== 200) {
      ElMessage.error(data.msg || '请求失败');
      return Promise.reject(data);
    }
    return data;
  },
  (err) => {
    if (err.response?.status === 401) {
      clearAuth();
      ElMessage.error('登录已失效，请重新登录');
      if (!location.hash.includes('/login')) location.hash = '#/login';
    } else {
      ElMessage.error(err.message || '网络异常');
    }
    return Promise.reject(err);
  }
);

export default http;
