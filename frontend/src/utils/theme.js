// 主题切换: 浅色/深色, 持久化到 localStorage
const KEY = 'app-theme';

export function getTheme() {
  return localStorage.getItem(KEY) || 'light';
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem(KEY, theme);
}

export function initTheme() {
  applyTheme(getTheme());
}
