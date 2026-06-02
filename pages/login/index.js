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
   */
  onLoad: function (options) {
    // 检查全局数据中是否已有 openid（已登录）
    if (app.globalData.openid) {
      console.log('检测到已登录，跳转到首页');
      wx.redirectTo({
        url: '/pages/home/index'
      });
      return;
    }

    // 尝试从本地缓存读取登录状态（实现免登录）
    const cachedOpenid = wx.getStorageSync('openid');
    const cachedRole = wx.getStorageSync('role');

    if (cachedOpenid && cachedRole) {
      console.log('从缓存恢复登录状态');
      app.globalData.openid = cachedOpenid;
      app.globalData.role = cachedRole;
      wx.redirectTo({
        url: '/pages/home/index'
      });
      return;
    }
  },

  /**
   * 页面显示时执行
   * 再次检查登录状态
   */
  onShow: function () {
    // 双重检查，防止页面返回时未跳转
    if (app.globalData.openid) {
      wx.redirectTo({
        url: '/pages/home/index'
      });
    }
  },

  /**
   * 微信授权登录按钮点击事件
   * @param {object} e - 事件对象，包含用户信息
   */
  handleGetUserInfo: function (e) {
    // 检查用户是否授权
    if (e.detail.errMsg !== 'getUserInfo:ok') {
      // 用户取消授权
      wx.showToast({
        title: '需要授权才能继续使用',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    console.log('用户授权成功，开始登录流程');

    // 显示加载状态
    this.setData({ loading: true });

    // 第一步：调用 wx.login 获取微信登录凭证（code）
    wx.login({
      success: (loginRes) => {
        // 检查 code 是否获取成功
        if (!loginRes.code) {
          this.showError('获取登录凭证失败，请重试');
          return;
        }

        console.log('获取到 code：', loginRes.code);

        // 第二步：调用云函数 getUserRole，传入 code 获取用户信息和角色
        this.doLogin(loginRes.code);
      },
      fail: (err) => {
        console.error('wx.login 失败：', err);
        this.showError('微信登录失败，请检查网络');
      }
    });
  },

  /**
   * 调用云函数完成登录
   * @param {string} code - 微信登录凭证
   */
  doLogin: function (code) {
    request.callCloud('getUserRole', { code: code })
      .then((res) => {
        console.log('getUserRole 返回结果：', res);

        // 检查返回结果
        if (!res || !res.success) {
          // 替换可选链为显式判断
          this.showError((res && res.error) ? res.error : '登录失败，请重试');
          return;
        }

        // 获取用户数据
        const userData = res.data;
        const openid = userData.openid;
        const role = userData.role || 'viewer';

        // 第三步：保存用户信息到全局数据
        app.globalData.openid = openid;
        app.globalData.role = role;

        const expireTime = Date.now() + 7 * 24 * 60 * 60 * 1000;  // 7天后过期

        // 第四步：保存到本地缓存（实现下次打开免登录）
        wx.setStorageSync('openid', openid);
        wx.setStorageSync('role', role);
        wx.setStorageSync('loginExpire', expireTime);

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
        console.error('登录失败：', err);
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