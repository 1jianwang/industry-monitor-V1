// pages/login/index.js
// 登录页面逻辑

const request = require('../../utils/request.js');

// 获取应用实例
const app = getApp();

Page({
  data: {
    // 页面数据
    loading: false  // 登录按钮加载状态
  },

  /**
   * 页面加载时执行
   * 检查是否已登录，若已登录则直接跳转到首页
   * TC-LOGIN-003: 缓存有效期内自动登录，直接进入首页
   * TC-LOGIN-004: 缓存过期时显示登录页
   */
  onLoad: function (options) {
    // TC-LOGIN-003: 检查全局数据中是否已有 openid（从缓存恢复的登录状态）
    if (app.globalData.openid) {
      console.log('[TC-LOGIN-003] 检测到已登录状态，自动恢复登录，直接进入首页');
      // 首页是 tabBar 页面，必须使用 switchTab
      wx.switchTab({
        url: '/pages/home/index'
      });
      return;
    }

    // 尝试从本地缓存读取登录状态（双重检查机制）
    try {
      const expire = wx.getStorageSync('loginExpire');
      const cachedOpenid = wx.getStorageSync('openid');
      const cachedRole = wx.getStorageSync('role');

      // TC-LOGIN-004: 检查缓存是否过期（超过7天）
      if (expire && Date.now() > expire) {
        console.log('登录缓存已过期，请重新登录状态');
        // 清除所有本地缓存
        wx.clearStorageSync();
        console.log('[TC-LOGIN-004] 控制台输出：登录缓存已过期，清除所有本地缓存，显示登录页');
        // 提示用户
        wx.showToast({
          title: '登录已过期，请重新登录',
          icon: 'none',
          duration: 2000
        });
        return;
      }

      // TC-LOGIN-003: 缓存有效且存在登录信息（有效期内）
      if (cachedOpenid && cachedRole && expire) {
        console.log('[TC-LOGIN-003] 从缓存恢复登录状态，直接进入首页，不显示登录页');
        app.globalData.openid = cachedOpenid;
        app.globalData.role = cachedRole;
        // 首页是 tabBar 页面，必须使用 switchTab
        wx.switchTab({
          url: '/pages/home/index'
        });
        return;
      }

      console.log('[登录检查] 缓存无效或不完整，显示登录页');
    } catch (err) {
      console.error('[登录检查] 读取缓存失败:', err);
      // 缓存读取失败时清除所有数据
      wx.clearStorageSync();
    }
  },

  /**
   * 页面显示时执行
   * 再次检查登录状态
   */
  onShow: function () {
    // 双重检查，防止页面返回时未跳转
    if (app.globalData.openid) {
      // 首页是 tabBar 页面，必须使用 switchTab
      wx.switchTab({
        url: '/pages/home/index'
      });
    }
  },

  /**
   * 微信授权登录按钮点击事件（新版）
   * 改进：使用新版 wx.login API，不再依赖已废弃的 getUserInfo
   * TC-LOGIN-001: 首次登录
   * TC-LOGIN-002: 拒绝授权处理
   * TC-LOGIN-005: 网络异常处理
   */
  handleLogin: function () {
    console.log('[授权登录] 用户点击登录按钮，开始登录流程');

    // 显示加载状态
    this.setData({ loading: true });

    // TC-LOGIN-005: 调用 wx.login 获取微信登录凭证（code）
    wx.login({
      success: (loginRes) => {
        // 检查 code 是否获取成功
        if (!loginRes.code) {
          console.error('[授权登录] 获取登录凭证失败');
          this.showError('获取登录凭证失败，请重试');
          return;
        }

        console.log('[授权登录] 获取到 code，准备调用云函数');

        // 调用云函数 getUserRole，传入 code 获取用户信息和角色
        this.doLogin(loginRes.code);
      },
      fail: (err) => {
        console.error('[授权登录] wx.login 失败：', err);
        // TC-LOGIN-005: 网络异常处理
        this.showError('微信登录失败，请检查网络连接');
      }
    });
  },

  /**
   * 旧版授权登录按钮事件（保留兼容）
   * 已废弃：open-type="getUserInfo" 自2021年4月起已被微信废弃
   * @deprecated 请使用 handleLogin 代替
   */
  handleGetUserInfo: function (e) {
    console.log('[授权登录] 收到授权回调，详情：', e.detail);

    // TC-LOGIN-002: 检查用户是否拒绝授权
    if (e.detail.errMsg === 'getUserInfo:fail auth deny') {
      console.log('[授权登录] 用户拒绝授权');
      wx.showToast({
        title: '需要授权才能继续使用',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // TC-LOGIN-005: 检查是否是网络错误或其他错误
    if (e.detail.errMsg && e.detail.errMsg !== 'getUserInfo:ok') {
      console.error('[授权登录] 授权失败：', e.detail.errMsg);
      // 判断是否是网络相关错误
      if (e.detail.errMsg.includes('fail') || e.detail.errMsg.includes('network') || e.detail.errMsg.includes('timeout')) {
        this.showError('网络连接失败，请检查网络后重试');
      } else {
        this.showError('授权失败，请重试');
      }
      return;
    }

    console.log('[授权登录] 用户授权成功，开始登录流程');

    // 显示加载状态
    this.setData({ loading: true });

    // 第一步：调用 wx.login 获取微信登录凭证（code）（TC-LOGIN-005）
    wx.login({
      success: (loginRes) => {
        // 检查 code 是否获取成功
        if (!loginRes.code) {
          console.error('[授权登录] 获取登录凭证失败');
          this.showError('获取登录凭证失败，请重试');
          return;
        }

        console.log('[授权登录] 获取到 code，准备调用云函数');

        // 第二步：调用云函数 getUserRole，传入 code 获取用户信息和角色
        this.doLogin(loginRes.code);
      },
      fail: (err) => {
        console.error('[授权登录] wx.login 失败：', err);
        this.showError('微信登录失败，请检查网络连接');
      }
    });
  },

  /**
   * 调用云函数完成登录
   * @param {string} code - 微信登录凭证
   * 改进：增强错误处理和角色识别（TC-LOGIN-006, TC-LOGIN-008）
   */
  doLogin: function (code) {
    request.callCloud('getUserRole', { code: code })
      .then((res) => {
        console.log('[云函数调用] getUserRole 返回结果：', res);

        // 检查返回结果（TC-LOGIN-006）
        if (!res || !res.success) {
          const errorMsg = (res && res.error) ? res.error : '登录失败，请重试';
          console.error('[云函数调用] 登录失败：', errorMsg);
          this.showError(errorMsg);
          return;
        }

        // 获取用户数据（TC-LOGIN-008）
        const userData = res.data;
        const openid = userData.openid;
        const role = userData.role || 'viewer';

        console.log('[登录成功] openid:', openid, 'role:', role);

        // 第三步：保存用户信息到全局数据（TC-LOGIN-001）
        app.globalData.openid = openid;
        app.globalData.role = role;

        // TC-LOGIN-003: 设置7天有效期
        const expireTime = Date.now() + 7 * 24 * 60 * 60 * 1000;  // 7天后过期

        const expireDate = new Date(expireTime).toLocaleString('zh-CN');

        // 第四步：保存到本地缓存（实现下次打开免登录）
        try {
          wx.setStorageSync('openid', openid);
          wx.setStorageSync('role', role);
          wx.setStorageSync('loginExpire', expireTime);
          console.log('[TC-LOGIN-003] 登录信息已保存到缓存，有效期7天');
          console.log('过期时间:', expireDate);
        } catch (err) {
          console.error('[登录成功] 保存缓存失败：', err);
        }

        // 显示登录成功提示
        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 1500
        });

        // 第五步：跳转到首页
        setTimeout(() => {
          // 使用 switchTab 跳转到 TabBar 页面
          wx.switchTab({
            url: '/pages/home/index'
          });
        }, 1500);

      })
      .catch((err) => {
        console.error('[云函数调用] 登录失败（网络或服务器错误）：', err);
        this.showError('服务器错误，请稍后重试');
      });
  },

  /**
   * 显示错误提示并重置加载状态
   * @param {string} message - 错误信息
   */
  showError: function (message) {
    this.setData({ loading: false });
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 2500
    });
  }
});