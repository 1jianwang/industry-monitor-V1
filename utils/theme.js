// 主题管理工具
// 支持日间/夜间模式切换

const THEME_KEY = 'app_theme_mode';

// 主题配置
const themes = {
  light: {
    // 背景色
    pageBg: '#F5F7FA',
    cardBg: '#FFFFFF',

    // 文字颜色
    textPrimary: '#333333',
    textSecondary: '#666666',
    textTertiary: '#999999',

    // 品牌色
    brandPrimary: '#1A56A0',
    brandSecondary: '#2E75B6',

    // 边框和分割线
    border: '#E5E7EB',
    divider: '#F0F0F0',

    // 状态色
    success: '#00897b',
    warning: '#f57c00',
    error: '#d32f2f',
    info: '#1976d2',

    // 阴影
    shadowLight: 'rgba(0, 0, 0, 0.05)',
    shadowMedium: 'rgba(0, 0, 0, 0.08)',
    shadowHeavy: 'rgba(0, 0, 0, 0.12)',

    // 渐变色
    gradientPurple: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    gradientBlue: 'linear-gradient(135deg, #1A56A0 0%, #2E75B6 100%)',
  },

  dark: {
    // 背景色
    pageBg: '#121212',
    cardBg: '#1E1E1E',

    // 文字颜色
    textPrimary: '#E0E0E0',
    textSecondary: '#B0B0B0',
    textTertiary: '#808080',

    // 品牌色（夜间模式稍微调亮）
    brandPrimary: '#4A8FD8',
    brandSecondary: '#5BA3D0',

    // 边框和分割线
    border: '#2C2C2C',
    divider: '#2A2A2A',

    // 状态色
    success: '#26a69a',
    warning: '#ff9800',
    error: '#ef5350',
    info: '#42a5f5',

    // 阴影
    shadowLight: 'rgba(0, 0, 0, 0.3)',
    shadowMedium: 'rgba(0, 0, 0, 0.4)',
    shadowHeavy: 'rgba(0, 0, 0, 0.5)',

    // 渐变色
    gradientPurple: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
    gradientBlue: 'linear-gradient(135deg, #2E5F8E 0%, #3D6B9E 100%)',
  }
};

// 获取当前主题模式
function getThemeMode() {
  try {
    return wx.getStorageSync(THEME_KEY) || 'light';
  } catch (e) {
    return 'light';
  }
}

// 设置主题模式
function setThemeMode(mode) {
  try {
    wx.setStorageSync(THEME_KEY, mode);
    return true;
  } catch (e) {
    console.error('保存主题模式失败', e);
    return false;
  }
}

// 切换主题模式
function toggleTheme() {
  const currentMode = getThemeMode();
  const newMode = currentMode === 'light' ? 'dark' : 'light';
  setThemeMode(newMode);
  return newMode;
}

// 获取当前主题配置
function getTheme() {
  const mode = getThemeMode();
  return themes[mode];
}

// 应用主题到页面
function applyTheme(page) {
  const mode = getThemeMode();
  const theme = themes[mode];

  page.setData({
    themeMode: mode,
    theme: theme
  });
}

module.exports = {
  getThemeMode,
  setThemeMode,
  toggleTheme,
  getTheme,
  applyTheme,
  themes
};
