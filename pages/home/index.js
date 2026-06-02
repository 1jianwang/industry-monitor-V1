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
    isEmpty: false,          // 数据是否为空（TC-HOME-002）
    loadError: false,        // 加载是否出错（TC-HOME-001）
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
   * 改进：增强权限检查逻辑（TC-HOME-003）
   */
  checkLogin: function () {
    // 检查全局数据中的 openid
    if (!app.globalData.openid) {
      console.log('[权限检查] 未登录，跳转到登录页');
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

    console.log('[权限检查] 权限检查通过，用户角色：', app.globalData.role);
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
   * 改进：增强空数据和错误处理（TC-HOME-001, TC-HOME-002）
   */
  loadIndustries: function () {
    this.setData({
      loading: true,
      loadError: false,
      isEmpty: false
    });

    request.callCloud('getIndustries', {})
      .then(res => {
        if (!res) {
          console.error('[数据加载] 网络异常，响应为空');
          this.setData({
            loading: false,
            loadError: true
          });
          wx.showToast({
            title: '网络异常，请重试',
            icon: 'none',
            duration: 2000
          });
          return;
        }

        if (!res.success) {
          console.error('[数据加载] 加载失败：', res.error);
          this.setData({
            loading: false,
            loadError: true
          });
          wx.showToast({
            title: res.error || '加载失败',
            icon: 'none',
            duration: 2000
          });
          return;
        }

        const industries = res.industries || [];
        const rawSummary = res.summary || {};

        console.log('[数据加载] 加载产业列表成功，数据量：', industries.length);
        console.log('[数据加载] summary 数据：', rawSummary);

        // 检查是否为空数据（TC-HOME-002）
        const isEmpty = industries.length === 0;
        if (isEmpty) {
          console.log('[数据加载] 当前无产业数据');
        }

        this.setData({
          industries: industries,
          filteredIndustries: industries,
          summary: {
            totalIndustries: rawSummary.totalIndustries || 0,
            totalPeriods: rawSummary.totalPeriods || 0,
            totalEnterprises: rawSummary.totalEnterprises || 0,
            totalProjects: rawSummary.totalProjects || 0
          },
          loading: false,
          loadError: false,
          isEmpty: isEmpty
        });
      })
      .catch(err => {
        console.error('[数据加载] 加载产业列表失败（异常）：', err);
        this.setData({
          loading: false,
          loadError: true
        });
        wx.showToast({
          title: '加载失败，请下拉刷新',
          icon: 'none',
          duration: 2000
        });
      });
  },

  /**
   * 搜索框输入事件
   * 改进：增强输入验证和特殊字符处理（TC-HOME-004, TC-HOME-007, TC-HOME-008）
   */
  onSearchInput: function (e) {
    let keyword = e.detail.value || '';

    // 限制长度，避免性能问题（TC-HOME-008）
    if (keyword.length > 20) {
      keyword = keyword.substring(0, 20);
      console.log('[搜索功能] 关键词过长，已截断为20个字符');
    }

    // 过滤正则特殊字符，避免 RegExp 注入（TC-HOME-007）
    const originalKeyword = keyword;
    keyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (originalKeyword !== keyword) {
      console.log('[搜索功能] 检测到特殊字符，已转义处理');
    }

    console.log('[搜索功能] 搜索关键词：', keyword);
    this.setData({ searchKeyword: keyword });
    this.filterIndustries(keyword);
  },

  /**
   * 过滤产业列表
   * 改进：增强过滤逻辑和日志（TC-HOME-004, TC-HOME-005, TC-HOME-006）
   */
  filterIndustries: function (keyword) {
    // 清空搜索，显示全部（TC-HOME-006）
    if (!keyword) {
      console.log('[搜索功能] 清空搜索，显示全部产业');
      this.setData({
        filteredIndustries: this.data.industries
      });
      return;
    }

    // 搜索过滤（TC-HOME-004）
    const filtered = this.data.industries.filter(item => {
      return item.name.toLowerCase().includes(keyword.toLowerCase());
    });

    console.log('[搜索功能] 搜索结果数量：', filtered.length);

    // 无匹配结果（TC-HOME-005）
    if (filtered.length === 0) {
      console.log('[搜索功能] 无匹配结果');
    }

    this.setData({
      filteredIndustries: filtered
    });
  },

  /**
   * 点击产业卡片主体，跳转到该产业最新季度的详情页
   * @param {object} e - 事件对象，包含产业名称和最新季度
   * 改进：增强验证和日志（TC-HOME-009, TC-HOME-010）
   */
  goToIndustry: function (e) {
    const { name, period } = e.currentTarget.dataset;

    console.log('[产业跳转] 点击产业：', name, '季度：', period);

    // 验证是否有数据（TC-HOME-010）
    if (!period) {
      console.log('[产业跳转] 该产业暂无数据');
      wx.showToast({
        title: '该产业暂无数据',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 跳转到详情页（TC-HOME-009）
    console.log('[产业跳转] 跳转到详情页');
    wx.navigateTo({
      url: `/pages/industry/detail?name=${encodeURIComponent(name)}&period=${encodeURIComponent(period)}`
    });
  },

  /**
   * 点击展开/收起按钮
   * 若当前已展开则收起，否则展开（同时收起其他产业）
   * @param {object} e - 事件对象，包含产业名称
   * 改进：增强展开/收起逻辑和日志（TC-HOME-011）
   */
  toggleExpand: function (e) {
    const name = e.currentTarget.dataset.name;
    const currentExpanded = this.data.expandedIndustry;

    // 若当前已展开则收起，否则展开（同时收起其他产业）（TC-HOME-011）
    if (currentExpanded === name) {
      console.log('[展开/收起] 收起产业：', name);
      this.setData({
        expandedIndustry: null
      });
    } else {
      console.log('[展开/收起] 展开产业：', name, '，收起之前的：', currentExpanded || '无');
      this.setData({
        expandedIndustry: name
      });
    }
  },

  /**
   * 点击某个季度，跳转到该产业该季度的详情页
   * @param {object} e - 事件对象，包含产业名称和季度值
   * 改进：增强日志记录（TC-HOME-011）
   */
  goToPeriod: function (e) {
    const { name, period } = e.currentTarget.dataset;
    console.log('[季度跳转] 产业：', name, '季度：', period);
    wx.navigateTo({
      url: `/pages/industry/detail?name=${encodeURIComponent(name)}&period=${encodeURIComponent(period)}`
    });
  },

  /**
   * 下拉刷新
   * 重新加载产业列表
   * 改进：增强日志记录（TC-HOME-012）
   */
  onPullDownRefresh: function () {
    console.log('[下拉刷新] 开始刷新数据');
    this.loadIndustries();
    // 停止下拉刷新
    wx.stopPullDownRefresh();
  }
});
