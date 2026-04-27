// pages/home/index.js
// 首页（产业列表）- 权限控制：需登录才能访问

const request = require('../../utils/request.js');

// 获取应用实例
const app = getApp();

Page({
  data: {
    industries: [],          // 产业列表数据
    filteredIndustries: [],  // 过滤后的产业列表
    searchKeyword: '',       // 搜索关键词
    loading: false,          // 加载状态
    userRole: '',            // 当前用户角色
    isAdmin: false,          // 是否管理员
    expandedIndustry: null,  // 当前展开的产业名称，null 表示全部收起
    // 数据统计总览
    summary: {
      totalIndustries: 0,
      totalPeriods: 0,
      totalEnterprises: 0,
      totalProjects: 0
    }
  },

  /**
   * 页面加载时执行
   * 1. 进行权限检查：未登录则跳转登录页
   * 2. 加载产业列表数据
   */
  onLoad: function (options) {
    // 权限检查
    this.checkLogin();
    // 加载产业列表
    this.loadIndustries();
  },

  /**
   * 权限检查：确保用户已登录
   * 若 openid 为空，跳转到登录页面
   */
  checkLogin: function () {
    // 检查全局数据中的 openid
    if (!app.globalData.openid) {
      console.log('未登录，跳转到登录页');
      wx.redirectTo({
        url: '/pages/login/index'
      });
      return false;
    }

    // 更新页面数据中的用户角色显示
    this.setData({
      userRole: app.globalData.role,
      isAdmin: app.globalData.role === 'admin'
    });

    console.log('权限检查通过，用户角色：', app.globalData.role);
    return true;
  },

  /**
   * 页面显示时执行
   * 再次检查登录状态，防止登录页返回
   * 刷新产业列表数据（确保从管理后台删除后同步）
   */
  onShow: function () {
    if (!app.globalData.openid) {
      wx.redirectTo({
        url: '/pages/login/index'
      });
      return;
    }

    // 刷新产业列表，确保数据同步
    this.loadIndustries();
  },

  /**
   * 加载产业列表数据
   * 调用云函数 getIndustries 获取列表
   */
  loadIndustries: function () {
    this.setData({ loading: true });

    request.callCloud('getIndustries', {})
      .then(res => {
        if (!res) {
          wx.showToast({ title: '网络异常，请重试', icon: 'none' });
          this.setData({ loading: false });
          return;
        }

        if (!res.success) {
          this.setData({ loading: false });
          wx.showToast({ title: res.error || '加载失败', icon: 'none' });
          return;
        }

        console.log('加载产业列表成功，数据量：', res.industries && res.industries.length ? res.industries.length : 0);
        console.log('summary 数据：', res.summary);

        const rawSummary = res.summary || {};
        this.setData({
          industries: res.industries || [],
          filteredIndustries: res.industries || [],
          summary: {
            totalIndustries: rawSummary.totalIndustries || 0,
            totalPeriods: rawSummary.totalPeriods || 0,
            totalEnterprises: rawSummary.totalEnterprises || 0,
            totalProjects: rawSummary.totalProjects || 0
          },
          loading: false
        });
      })
      .catch(err => {
        console.error('加载产业列表失败', err);
        this.setData({ loading: false });
        wx.showToast({
          title: '加载失败，请下拉刷新',
          icon: 'none'
        });
      });
  },

  /**
   * 搜索框输入事件
   */
  onSearchInput: function (e) {
    let keyword = e.detail.value || '';
    // 限制长度，避免性能问题
    if (keyword.length > 20) {
      keyword = keyword.substring(0, 20);
    }
    // 过滤正则特殊字符，避免 RegExp 注入
    keyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    this.setData({ searchKeyword: keyword });
    this.filterIndustries(keyword);
  },

  /**
   * 过滤产业列表
   */
  filterIndustries: function (keyword) {
    if (!keyword) {
      this.setData({
        filteredIndustries: this.data.industries
      });
      return;
    }

    const filtered = this.data.industries.filter(item => {
      return item.name.toLowerCase().includes(keyword);
    });

    this.setData({
      filteredIndustries: filtered
    });
  },

  /**
   * 点击产业卡片主体，跳转到该产业最新季度的详情页
   * @param {object} e - 事件对象，包含产业名称和最新季度
   */
  goToIndustry: function (e) {
    const { name, period } = e.currentTarget.dataset;
    if (!period) {
      wx.showToast({
        title: '该产业暂无数据',
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({
      url: `/pages/industry/detail?name=${encodeURIComponent(name)}&period=${encodeURIComponent(period)}`
    });
  },

  /**
   * 点击展开/收起按钮
   * 若当前已展开则收起，否则展开（同时收起其他产业）
   * @param {object} e - 事件对象，包含产业名称
   */
  toggleExpand: function (e) {
    const name = e.currentTarget.dataset.name;
    // 若当前已展开则收起，否则展开（同时收起其他产业）
    this.setData({
      expandedIndustry: this.data.expandedIndustry === name ? null : name
    });
  },

  /**
   * 点击某个季度，跳转到该产业该季度的详情页
   * @param {object} e - 事件对象，包含产业名称和季度值
   */
  goToPeriod: function (e) {
    const { name, period } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/industry/detail?name=${encodeURIComponent(name)}&period=${encodeURIComponent(period)}`
    });
  },

  /**
   * 下拉刷新
   * 重新加载产业列表
   */
  onPullDownRefresh: function () {
    this.loadIndustries();
    // 停止下拉刷新
    wx.stopPullDownRefresh();
  }
});
