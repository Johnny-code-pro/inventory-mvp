// 登录态本地存储工具
const TOKEN_KEY = 'inventory_token';
const USER_KEY = 'inventory_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// 当前用户是否管理员(含超级管理员)
export function isAdmin() {
  const u = getUser();
  return u && (u.role === 'admin' || u.role === 'superadmin');
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
