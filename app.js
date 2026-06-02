// 小程序入口文件

const isDev = true;  // 上线前改为 false
if (!isDev) {
  console.log = () => {};
  console.warn = () => {};
}

App({
  /**
   * 小程序初始化时执行
   * 1. 初始化云开发环境
   * 2. 尝试从本地缓存恢复登录状态（实现免登录）
   */
  onLaunch: function () {
    // ==========================================
    // 第一步：初始化云开发环境
    // ==========================================
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-d2gahyqj8acd9ec22', // 云开发环境ID
        traceUser: true,
      });
    }

    // ==========================================
    // 第二步：从本地缓存恢复登录状态
    // ==========================================
    this.restoreLoginState();
  },

  onError: function(err) {
    console.error('全局错误：', err);
    // 可在此上报错误日志到云数据库
  },

  onUnhandledRejection: function(res) {
    console.error('未处理的Promise异常：', res.reason);
  },

  // 全局数据
  globalData: {
    userInfo: null,    // 用户信息（保留字段）
    openid: null,    // 用户唯一标识
    role: null,    // 用户角色：admin（管理员）或 viewer（查阅者）
  },

  /**
   * 从本地缓存恢复登录状态
   * 检查缓存是否有登录信息，若有则恢复到 globalData
   * TC-LOGIN-003: 缓存有效期内自动恢复登录
   * TC-LOGIN-004: 缓存过期时清除数据
   */
  restoreLoginState: function () {
    try {
      const expire = wx.getStorageSync('loginExpire');
      const cachedOpenid = wx.getStorageSync('openid');
      const cachedRole = wx.getStorageSync('role');

      // TC-LOGIN-004: 检查缓存是否过期（超过7天）
      if (expire && Date.now() > expire) {
        console.log('登录缓存已过期，请重新登录状态');
        // 清除所有本地缓存
        wx.clearStorageSync();
        return;
      }

      // TC-LOGIN-003: 缓存有效期内（7天内）自动恢复登录状态
      if (cachedOpenid && cachedRole && expire) {
        console.log('[TC-LOGIN-003] 从缓存恢复登录状态，直接进入首页');
        console.log('用户信息 - openid:', cachedOpenid, 'role:', cachedRole);
        this.globalData.openid = cachedOpenid;
        this.globalData.role = cachedRole;
      } else {
        console.log('未找到缓存的登录信息，需要重新登录');
      }
    } catch (err) {
      console.error('读取缓存失败：', err);
      // 缓存读取失败时清除所有数据
      wx.clearStorageSync();
    }
  },

  /**
   * 检查用户是否已登录
   * @returns {boolean} 是否已登录
   */
  isLoggedIn: function () {
    return !!this.globalData.openid;
  },

  /**
   * 检查用户是否是管理员
   * @returns {boolean} 是否是管理员
   */
  isAdmin: function () {
    return this.globalData.role === 'admin';
  }
});