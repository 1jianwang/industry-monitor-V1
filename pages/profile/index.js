// pages/profile/index.js
const app = getApp()

Page({
  data: {
    openid: '',
    role: '',
    isAdmin: false
  },

  /**
   * 页面显示时执行
   */
  onShow: function () {
    // 从 globalData 读取用户信息
    const openid = app.globalData.openid || ''
    const role = app.globalData.role || 'viewer'
    const isAdmin = role === 'admin'

    this.setData({
      openid,
      role,
      isAdmin
    })
  },

  /**
   * 脱敏显示openid
   */
  maskOpenid: function (openid) {
    if (!openid || openid.length < 8) return openid
    return openid.substring(0, 4) + '...' + openid.substring(openid.length - 4)
  },

  /**
   * 跳转到数据管理后台
   */
  goToAdmin: function () {
    wx.navigateTo({
      url: '/pages/admin/index'
    })
  },

  /**
   * 跳转到上传数据页面
   */
  goToUpload: function () {
    wx.switchTab({
      url: '/pages/upload/index'
    })
  },

  /**
   * 显示关于信息
   */
  showAbout: function () {
    wx.showModal({
      title: '关于本应用',
      content: '产业创新统计监测 v1.0\n\n用于产业数据的统计、监测与分析',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  /**
   * 退出登录
   */
  logout: function () {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      confirmColor: '#1A56A0',
      success: res => {
        if (res.confirm) {
          // 清除本地存储
          wx.clearStorageSync()

          // 清除全局数据
          app.globalData.openid = null
          app.globalData.role = null
          app.globalData.userInfo = null

          // 跳转到登录页
          wx.reLaunch({
            url: '/pages/login/index'
          })
        }
      }
    })
  }
})
