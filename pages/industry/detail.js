// pages/industry/detail.js
Page({
  // 图表实例存储（不放在 data 中，避免序列化导致循环引用错误）
  chartInstances: {},

  data: {
    industryName: '',
    timePeriods: [],
    formattedPeriods: [],      // 格式化后的时间列表，用于 picker 显示
    currentTimeIndex: 0,
    currentTimePeriod: '',
    currentColumn: 'international',
    currentModule: 'universities',
    modules: [
      { key: 'universities', name: '高水平大学' },
      { key: 'institutions', name: '顶尖研究机构' },
      { key: 'scientists', name: '领衔科学家' },
      { key: 'minerals', name: '主要矿产分布' },
      { key: 'enterprises', name: '龙头企业' },
      { key: 'market', name: '市场规模' },
      { key: 'papers', name: '高水平论文' },
      { key: 'planning', name: '产业技术规划' },
      { key: 'projects', name: '科技创新项目' },
      { key: 'awards', name: '科技成果奖' },
      { key: 'national_projects', name: '国家重大项目' }
    ],
    allData: {},
    currentData: [],
    loading: false,
    hasData: false,
    // 数据统计
    totalDataCount: 0,        // 总数据条数
    // 特定模块的可用栏位限制
    moduleColumnRestrictions: {
      'projects': ['provincial'],           // 科技创新项目仅省内
      'awards': ['provincial'],             // 科技成果奖仅省内
      'national_projects': ['national']     // 国家重大项目仅国内
    },
    previousColumn: 'international',
    isLoading: false,
    isSwitching: false,
    // 图表相关
    chartType: '产量', // 市场规模图表切换：产量/产值
    marketChartTitle: '市场规模',  // 市场规模图表标题（动态）
    marketChartEc: {
      lazyLoad: true
    },
    enterpriseChartEc: {
      lazyLoad: true
    },
    enterpriseChartTitle: '龙头企业',  // 龙头企业图表标题（动态）
    mineralChartEc: {
      lazyLoad: true
    },
    mineralChartTitle: '矿产储量分布',  // 矿产图表标题（动态）
    // 导出PDF相关
    exporting: false,  // 导出中状态
    // 已修复：TC27 - 图表实例存储，用于页面卸载时销毁
    chartInstances: {}
  },

  onLoad: function (options) {
    if (options.name) {
      const industryName = decodeURIComponent(options.name);
      const timePeriod = options.period ? decodeURIComponent(options.period) : null;

      this.setData({ industryName });
      this.loadTimePeriods(industryName, timePeriod);
    }
  },

  /**
   * 加载时间列表
   * @param {string} industryName - 产业名称
   * @param {string} targetPeriod - 目标时间（可选，从URL传入）
   */
  loadTimePeriods: function (industryName, targetPeriod) {
    this.setData({ loading: true });
    wx.cloud.callFunction({
      name: 'getIndustryData',
      data: { industryName }
    })
    .then(res => {
      console.log('=== 时间列表返回 ===');
      console.log('完整返回:', JSON.stringify(res.result));

      const timePeriods = res.result.timePeriods || [];
      if (timePeriods.length > 0) {
        // 如果指定了目标时间且存在，则使用目标时间，否则使用第一个
        let currentIndex = 0;
        let currentPeriod = timePeriods[0];

        if (targetPeriod && timePeriods.includes(targetPeriod)) {
          currentIndex = timePeriods.indexOf(targetPeriod);
          currentPeriod = targetPeriod;
        }

        // 生成格式化的时间列表供 picker 显示
        const formattedPeriods = timePeriods.map(p => ({
          value: p,
          label: this.formatPeriod(p)
        }));

        this.setData({
          timePeriods,
          formattedPeriods,
          currentTimePeriod: currentPeriod,
          currentTimeIndex: currentIndex
        });
        this.loadIndustryData(industryName, currentPeriod);
      } else {
        this.setData({ loading: false, hasData: false });
        wx.showToast({ title: '暂无数据', icon: 'none' });
      }
    })
    .catch(err => {
      console.error('加载时间列表失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  /**
   * 加载产业数据
   */
  loadIndustryData: function (industryName, timePeriod) {
    if (this.data.isLoading) {
      console.log('正在加载中，忽略本次请求');
      return;
    }

    this.setData({ loading: true, isLoading: true });
    wx.cloud.callFunction({
      name: 'getIndustryData',
      data: { industryName, timePeriod }
    })
    .then(res => {
      console.log('=== 产业数据返回 ===');
      console.log('完整返回:', JSON.stringify(res.result));

      if (!res || !res.result) {
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
        this.setData({ loading: false });
        return;
      }
      const result = res.result;
      if (!result.success || !result.data || Object.keys(result.data).length === 0) {
        this.setData({ loading: false, hasData: false });
        wx.showToast({ title: result.error || '暂无数据', icon: 'none' });
        return;
      }

      const data = result.data || {};
      console.log('data对象的keys:', Object.keys(data));

      // 打印第一个模块的数据结构
      const firstKey = Object.keys(data)[0];
      if (firstKey) {
        console.log('第一个模块名:', firstKey);
        console.log('第一个模块数据:', JSON.stringify(data[firstKey]));
      }

      // 计算总数据条数
      let totalCount = 0;
      Object.keys(data).forEach(moduleName => {
        const moduleData = data[moduleName];
        // 统计三个层级的数据条数
        totalCount += (moduleData.international || []).length;
        totalCount += (moduleData.national || []).length;
        totalCount += (moduleData.provincial || []).length;
      });

      console.log('总数据条数:', totalCount);

      this.setData({
        allData: data,
        loading: false,
        isLoading: false,
        hasData: Object.keys(data).length > 0,
        totalDataCount: totalCount
      });

      this.updateCurrentData();
    })
    .catch(err => {
      console.error('加载产业数据失败', err);
      this.setData({ loading: false, isLoading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  /**
   * 时间切换
   */
  onTimeChange: function (e) {
    if (this.data.isLoading) {
      console.log('正在加载中，忽略本次切换');
      return;
    }

    const index = e.detail.value;
    const timePeriod = this.data.timePeriods[index];
    this.setData({
      currentTimeIndex: index,
      currentTimePeriod: timePeriod
    });
    this.loadIndustryData(this.data.industryName, timePeriod);
  },

  /**
   * 三栏切换
   */
  switchColumn: function (e) {
    if (this.data.isSwitching) {
      console.log('切换中，忽略本次操作');
      return;
    }

    const column = e.currentTarget.dataset.column;
    console.log('切换栏位到:', column);

    const { currentModule, moduleColumnRestrictions } = this.data;

    // 检查当前模块是否有栏位限制
    const restrictions = moduleColumnRestrictions[currentModule];

    if (restrictions && restrictions.length > 0 && !restrictions.includes(column)) {
      // 当前模块不支持该栏位，给出提示
      const moduleConfig = this.data.modules.find(m => m.key === currentModule);
      const moduleName = moduleConfig ? moduleConfig.name : '该模块';
      const columnNames = {
        'international': '国际',
        'national': '国内',
        'provincial': '省内'
      };
      const allowedNames = restrictions.map(r => columnNames[r]).join('、');

      wx.showToast({
        title: `${moduleName}仅支持${allowedNames}数据`,
        icon: 'none',
        duration: 2000
      });
      return; // 不执行切换
    }

    // 保存当前栏位作为上一次的栏位
    this.setData({
      previousColumn: this.data.currentColumn,
      currentColumn: column,
      isSwitching: true
    });

    this.updateCurrentData();
    this.renderChartIfNeeded();

    setTimeout(() => {
      this.setData({ isSwitching: false });
    }, 300);
  },

  /**
   * 模块切换
   */
  switchModule: function (e) {
    const module = e.currentTarget.dataset.module;
    console.log('切换模块到:', module);

    const { moduleColumnRestrictions, currentColumn } = this.data;

    // 检查该模块是否有栏位限制
    const restrictions = moduleColumnRestrictions[module];

    if (restrictions && restrictions.length > 0) {
      // 如果当前栏位不在允许的范围内，自动切换到第一个可用栏位
      if (!restrictions.includes(currentColumn)) {
        const targetColumn = restrictions[0];
        console.log(`模块 ${module} 仅支持 ${restrictions.join(',')}，自动切换到: ${targetColumn}`);

        this.setData({
          currentModule: module,
          currentColumn: targetColumn,
          previousColumn: currentColumn  // 保存切换前的栏位
        });
      } else {
        // 当前栏位在允许范围内，直接切换模块
        this.setData({ currentModule: module });
      }
    } else {
      // 没有限制的模块，直接切换
      this.setData({ currentModule: module });
    }

    this.updateCurrentData();
    // 切换模块后渲染对应图表
    this.renderChartIfNeeded();
  },

  getCurrentList: function(dataMap, moduleName, level) {
    // 已修复：TC41 - 替换可选链为显式判断
    return (dataMap && dataMap[moduleName] && dataMap[moduleName][level]) ? dataMap[moduleName][level] : [];
  },

  /**
   * 更新当前显示数据
   */
  updateCurrentData: function () {
    const { allData, currentModule, currentColumn, modules } = this.data;

    // 根据 currentModule 的 key 找到对应的中文名称
    const moduleConfig = modules.find(m => m.key === currentModule);
    const moduleName = moduleConfig ? moduleConfig.name : '';

    console.log('=== 更新显示数据 ===');
    console.log('当前模块key:', currentModule);
    console.log('对应中文名:', moduleName);
    console.log('当前栏位:', currentColumn);
    console.log('allData的keys:', Object.keys(allData));

    const items = this.getCurrentList(allData, moduleName, currentColumn);
    console.log('栏位数据items数组长度:', items.length);

    // 将 items 数组转换为适合渲染的格式
    // items 是行数组，每行是一个对象 { 字段名: 值, ... }
    // 转换为 [[{key, value}, ...], [{key, value}, ...], ...]
    const currentList = items.map(rowObj => {
      return Object.entries(rowObj)
        .filter(([k, v]) => !k.startsWith('_') && v !== null && v !== '' && v !== undefined)
        .map(([k, v]) => ({ key: k, value: String(v) }));
    });

    console.log('最终数据行数:', currentList.length);
    if (currentList.length > 0) {
      console.log('第一行字段数:', currentList[0].length);
    }

    this.setData({
      currentData: currentList,
      hasData: currentList.length > 0
    });
  },

  getChartComponent: function(id, retryCount = 0) {
    const component = this.selectComponent(id);
    if (!component && retryCount < 3) {
      console.warn(`图表组件 ${id} 未找到，500ms后重试（第${retryCount + 1}次）`);
      setTimeout(() => this.getChartComponent(id, retryCount + 1), 500);
      return null;
    }
    if (!component) {
      console.error(`图表组件 ${id} 无法找到，请检查组件ID和wx:if条件`);
    }
    return component;
  },

  /**
   * 根据当前模块判断是否需要渲染图表
   */
  renderChartIfNeeded: function () {
    const { currentModule } = this.data;
    console.log('Tab切换到:', currentModule, '，开始判断是否初始化图表');
    wx.nextTick(() => {
      if (currentModule === 'market') {
        console.log('触发市场规模图表初始化');
        this.initMarketChart();
      } else if (currentModule === 'enterprises') {
        console.log('触发龙头企业图表初始化');
        this.initEnterpriseChart();
      } else if (currentModule === 'minerals') {
        console.log('触发矿产分布图表初始化');
        this.initMineralChart();
      }
    });
  },

  /**
   * 格式化时间显示
   * 将 2026Q1 格式转为可读文字「2026年 第一季度」
   * @param {string} period - 时间值，如 2026Q1
   * @returns {string} 格式化后的时间文字
   */
  formatPeriod: function (period) {
    if (!period) return period;

    // 匹配标准季度格式：2026Q1
    const match = period.match(/^(\d{4})Q([1-4])$/);
    if (!match) return period; // 非标准格式直接显示原文

    const year = match[1];
    const quarter = match[2];
    const quarterMap = {
      '1': '第一季度',
      '2': '第二季度',
      '3': '第三季度',
      '4': '第四季度'
    };

    return `${year}年 ${quarterMap[quarter]}`;
  },

  /**
   * 导出PDF报告
   */
  exportPDF: async function() {
    // 防止重复点击
    if (this.data.exporting) return;

    // 检查是否有数据
    if (!this.data.hasData || !this.data.industryName || !this.data.currentTimePeriod) {
      wx.showToast({ title: '暂无可导出的数据', icon: 'none' });
      return;
    }

    this.setData({ exporting: true });
    wx.showLoading({ title: '正在生成报告...', mask: true });

    try {
      // 调用云函数生成PDF（设置30秒超时）
      const res = await wx.cloud.callFunction({
        name: 'exportPDF',
        data: {
          industryName: this.data.industryName,
          timePeriod: this.data.currentTimePeriod
        },
        config: {
          timeout: 30000
        }
      });

      wx.hideLoading();

      // 检查返回结果
      if (!res.result || !res.result.success) {
        wx.showToast({
          title: (res.result && res.result.error) ? res.result.error : '导出失败',
          icon: 'none'
        });
        return;
      }

      // 下载PDF到本地
      wx.showLoading({ title: '正在下载...', mask: true });
      wx.downloadFile({
        url: res.result.downloadURL,
        success: (downloadRes) => {
          wx.hideLoading();
          if (downloadRes.statusCode === 200) {
            // 打开文件预览
            wx.openDocument({
              filePath: downloadRes.tempFilePath,
              fileType: 'pdf',
              showMenu: true,  // 显示右上角菜单，可转发/保存
              success: () => {
                console.log('PDF打开成功');
              },
              fail: (err) => {
                console.error('PDF打开失败：', err);
                wx.showToast({
                  title: '请在文件管理中查看',
                  icon: 'none'
                });
              }
            });
          } else {
            wx.showToast({
              title: '下载失败，请重试',
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('下载失败：', err);
          wx.showToast({
            title: '下载失败，请重试',
            icon: 'none'
          });
        }
      });

    } catch (err) {
      wx.hideLoading();
      console.error('导出PDF失败：', err);
      wx.showToast({
        title: '网络异常，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ exporting: false });
    }
  },

  /**
   * 切换市场规模图表类型（产量/产值）
   */
  switchChartType: function (e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ chartType: type });
    this.initMarketChart();
  },

  /**
   * 初始化市场规模折线图
   */
  initMarketChart: function () {
    console.log('=== 开始初始化市场规模图表 ===');

    const { allData, currentColumn, chartType, currentModule } = this.data;
    console.log('当前模块key:', currentModule);
    console.log('当前栏位:', currentColumn);
    console.log('图表类型:', chartType);
    console.log('allData的keys:', Object.keys(allData));

    const moduleData = allData['市场规模'] || {};
    console.log('市场规模模块数据:', JSON.stringify(moduleData));

    const items = moduleData[currentColumn] || [];
    console.log('当前栏位数据条数:', items.length);

    if (!items || items.length === 0) {
      console.log('市场规模图表：无数据，跳过渲染');
      return;
    }

    // 提取年份和数据系列
    const seriesMap = {}; // { 品种名: [数值数组] }
    const years = new Set();

    items.forEach(row => {
      const productName = row['品种'] || row['产品种类'] || '未知';

      // 跳过表头行（品种字段值为"品种"本身）
      if (productName === '品种' || productName === '产品种类') {
        return;
      }

      // 提取年份数据
      Object.keys(row).forEach(key => {
        // 匹配年份字段，如 "2021年产量"、"2023年产值" 等
        // 支持格式：2024年产量/万吨、2024年产量(万吨)、2024年产值/亿美元、2024年产值(亿元)
        const yearMatch = key.match(/(\d{4})年(产量|产值)/);
        if (yearMatch) {
          const year = yearMatch[1];
          const dataType = yearMatch[2];

          // 只处理当前选中的类型
          if (dataType === chartType) {
            years.add(year);
            if (!seriesMap[productName]) {
              seriesMap[productName] = {};
            }
            const value = parseFloat(row[key]);
            if (!isNaN(value)) {
              seriesMap[productName][year] = value;
            }
          }
        }
      });
    });

    const yearList = Array.from(years).sort();
    const series = Object.keys(seriesMap).map((name, index) => {
      // 品牌色系配色方案
      const brandColors = ['#1A56A0', '#2E75B6', '#4A8FD8', '#667eea', '#5B9BD5', '#70AD47'];
      return {
        name: name,
        type: 'line',
        data: yearList.map(year => seriesMap[name][year] || 0),
        smooth: true,
        lineStyle: {
          width: 3
        },
        itemStyle: {
          color: brandColors[index % brandColors.length]
        },
        emphasis: {
          focus: 'series',
          itemStyle: {
            borderWidth: 2,
            borderColor: '#fff'
          }
        }
      };
    });

    // 数据验证：限制产品数量和年份数量，防止图表拥挤
    const MAX_PRODUCTS = 8;  // 最多显示 8 个产品系列
    const MAX_YEARS = 15;    // 最多显示 15 个年份

    if (!yearList || yearList.length === 0) {
      console.log('市场规模图表：无有效年份数据，跳过渲染');
      return;
    }
    if (!series || series.length === 0 || series.every(s => s.data.every(v => v === 0))) {
      console.log('市场规模图表：所有数值为空，跳过渲染');
      return;
    }

    // 限制产品数量：按数据总和排序，取前 N 个
    let limitedSeries = series;
    if (series.length > MAX_PRODUCTS) {
      // 计算每个产品的数据总和
      const seriesWithSum = series.map(s => ({
        ...s,
        sum: s.data.reduce((acc, val) => acc + val, 0)
      }));
      // 按总和降序排序，取前 MAX_PRODUCTS 个
      limitedSeries = seriesWithSum
        .sort((a, b) => b.sum - a.sum)
        .slice(0, MAX_PRODUCTS)
        .map(({ sum, ...rest }) => rest);  // 移除临时的 sum 字段

      console.log(`市场规模图表：产品过多，仅显示数据量最大的前 ${MAX_PRODUCTS} 个产品（共 ${series.length} 个）`);
    }

    // 限制年份数量：取最近的 N 年
    let limitedYearList = yearList;
    if (yearList.length > MAX_YEARS) {
      limitedYearList = yearList.slice(-MAX_YEARS);  // 取最后 N 个年份（最近的）
      // 更新系列数据，只保留对应年份的数据
      limitedSeries = limitedSeries.map(s => ({
        ...s,
        data: limitedYearList.map(year => {
          const yearIndex = yearList.indexOf(year);
          return s.data[yearIndex] || 0;
        })
      }));

      console.log(`市场规模图表：年份过多，仅显示最近 ${MAX_YEARS} 年（共 ${yearList.length} 年）`);
    }

    console.log('市场规模图表数据:', { yearList: limitedYearList, series: limitedSeries });

    // 设置图表配置
    this.setData({
      marketChartEc: {
        lazyLoad: true,
        onInit: (canvas, width, height, dpr) => {
          console.log('canvas回调执行，canvas:', canvas, '宽:', width, '高:', height);
          const echarts = require('../../ec-canvas/echarts.min');
          console.log('echarts对象:', echarts);
          console.log('echarts版本:', echarts.version);

          // 已修复：TC27 - 销毁旧的图表实例，避免内存泄漏
          if (this.chartInstances.market) {
            try {
              this.chartInstances.market.dispose();
              console.log('已销毁旧的市场规模图表实例');
            } catch (e) {
              console.warn('销毁旧图表实例失败:', e);
            }
          }

          const chart = echarts.init(canvas, null, {
            width: width,
            height: height,
            devicePixelRatio: dpr
          });

          // 已修复：TC27 - 保存图表实例引用（存储到页面实例属性，不放在 data 中）
          this.chartInstances.market = chart;

          // 设置动态标题
          let titleText = '市场规模';
          if (series.length > MAX_PRODUCTS || yearList.length > MAX_YEARS) {
            const parts = [];
            if (series.length > MAX_PRODUCTS) {
              parts.push(`前${MAX_PRODUCTS}个产品`);
            }
            if (yearList.length > MAX_YEARS) {
              parts.push(`最近${MAX_YEARS}年`);
            }
            titleText = `市场规模（${parts.join('，')}）`;
          }
          this.setData({ marketChartTitle: titleText });

          chart.setOption({
            title: {
              text: `${chartType}趋势`,
              left: 'center',
              textStyle: {
                fontSize: 16,
                color: '#1A56A0',
                fontWeight: 'bold'
              }
            },
            tooltip: {
              trigger: 'axis',
              confine: true,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderColor: '#1A56A0',
              borderWidth: 1,
              textStyle: {
                color: '#333'
              }
            },
            legend: {
              top: 35,
              left: 'center',
              textStyle: { fontSize: 11, color: '#666' },
              itemWidth: 20,
              itemHeight: 12
            },
            grid: {
              left: '10%',
              right: '10%',
              bottom: '15%',
              top: '28%',
              containLabel: true
            },
            xAxis: {
              type: 'category',
              data: limitedYearList,
              axisLabel: {
                fontSize: 11,
                color: '#666'
              },
              axisLine: {
                lineStyle: {
                  color: '#E5E7EB'
                }
              }
            },
            yAxis: {
              type: 'value',
              axisLabel: {
                fontSize: 11,
                color: '#666'
              },
              axisLine: {
                lineStyle: {
                  color: '#E5E7EB'
                }
              },
              splitLine: {
                lineStyle: {
                  color: '#F0F0F0',
                  type: 'dashed'
                }
              }
            },
            series: limitedSeries
          });

          return chart;
        }
      }
    }, () => {
      // setData完成后，等待DOM更新再初始化图表
      console.log('setData完成，准备初始化市场规模图表');
      setTimeout(() => {
        const chartComponent = this.getChartComponent('#market-chart');
        if (chartComponent) {
          chartComponent.init();
          console.log('市场规模图表初始化完成');
        }
      }, 100);
    });
  },

  /**
   * 初始化龙头企业柱状图
   * 已修复：TC25 - 限制最多显示10家企业，避免图表拥挤
   */
  initEnterpriseChart: function () {
    const { allData, currentColumn } = this.data;
    const moduleData = allData['龙头企业'] || {};
    const items = moduleData[currentColumn] || [];

    if (!items || items.length === 0) {
      console.log('龙头企业图表：无数据，跳过渲染');
      return;
    }

    // 提取企业名称和营收数据
    const enterprises = [];
    const revenues = [];

    items.forEach(row => {
      const name = row['名称'] || '未知';

      // 跳过表头行
      if (name === '名称') {
        return;
      }

      // 查找营收字段（可能是"2024年营收(亿元)"、"2024年产值/亿美元"等）
      let revenue = 0;
      Object.keys(row).forEach(key => {
        if (key.includes('营收') || key.includes('产值')) {
          const value = parseFloat(row[key]);
          if (!isNaN(value)) {
            revenue = value;
          }
        }
      });

      // 企业名称过长时截断
      const displayName = name.length > 8 ? name.substring(0, 8) + '…' : name;
      enterprises.push(displayName);
      revenues.push(revenue);
    });

    // 已修复：TC25 - 限制最多显示10家企业
    const limitedEnterprises = enterprises.slice(0, 10);
    const limitedRevenues = revenues.slice(0, 10);

    // 如果数据被截断，在控制台提示
    if (enterprises.length > 10) {
      console.log(`龙头企业图表：仅显示前10家企业（共${enterprises.length}家）`);
    }

    console.log('龙头企业图表数据:', { enterprises: limitedEnterprises, revenues: limitedRevenues });

    // 设置图表配置
    this.setData({
      enterpriseChartEc: {
        lazyLoad: true,
        onInit: (canvas, width, height, dpr) => {
          const echarts = require('../../ec-canvas/echarts.min');

          // 已修复：TC27 - 销毁旧的图表实例
          if (this.chartInstances.enterprise) {
            try {
              this.chartInstances.enterprise.dispose();
            } catch (e) {
              console.warn('销毁旧图表实例失败:', e);
            }
          }

          const chart = echarts.init(canvas, null, {
            width: width,
            height: height,
            devicePixelRatio: dpr
          });

          // 已修复：TC27 - 保存图表实例引用（存储到页面实例属性，不放在 data 中）
          this.chartInstances.enterprise = chart;

          // 设置动态标题
          const titleText = enterprises.length > 10 ? '龙头企业（前10）' : '龙头企业';
          this.setData({ enterpriseChartTitle: titleText });

          chart.setOption({
            tooltip: {
              trigger: 'axis',
              axisPointer: { type: 'shadow' },
              confine: true,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderColor: '#1A56A0',
              borderWidth: 1,
              textStyle: {
                color: '#333'
              }
            },
            grid: {
              left: '15%',
              right: '10%',
              bottom: '15%',
              top: '10%',
              containLabel: true
            },
            xAxis: {
              type: 'category',
              data: limitedEnterprises,
              axisLabel: {
                fontSize: 10,
                color: '#666',
                interval: 0,
                rotate: 30
              },
              axisLine: {
                lineStyle: {
                  color: '#E5E7EB'
                }
              }
            },
            yAxis: {
              type: 'value',
              name: '营收(亿元)',
              nameTextStyle: {
                color: '#666',
                fontSize: 11
              },
              axisLabel: {
                fontSize: 11,
                color: '#666'
              },
              axisLine: {
                lineStyle: {
                  color: '#E5E7EB'
                }
              },
              splitLine: {
                lineStyle: {
                  color: '#F0F0F0',
                  type: 'dashed'
                }
              }
            },
            series: [{
              type: 'bar',
              data: limitedRevenues,
              barWidth: '50%',
              itemStyle: {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [{
                    offset: 0,
                    color: '#2E75B6'
                  }, {
                    offset: 1,
                    color: '#1A56A0'
                  }]
                },
                borderRadius: [8, 8, 0, 0]
              },
              emphasis: {
                itemStyle: {
                  color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [{
                      offset: 0,
                      color: '#4A8FD8'
                    }, {
                      offset: 1,
                      color: '#2E75B6'
                    }]
                  }
                }
              },
              label: {
                show: true,
                position: 'top',
                fontSize: 10,
                color: '#666'
              }
            }]
          });

          return chart;
        }
      }
    }, () => {
      // setData完成后，等待DOM更新再初始化图表
      setTimeout(() => {
        const chartComponent = this.getChartComponent('#enterprise-chart');
        if (chartComponent) {
          chartComponent.init();
          console.log('龙头企业图表初始化完成');
        }
      }, 100);
    });
  },

  /**
   * 初始化矿产分布饼图
   */
  initMineralChart: function () {
    const { allData, currentColumn } = this.data;
    const moduleData = allData['主要矿产分布'] || {};
    const items = moduleData[currentColumn] || [];

    if (!items || items.length === 0) {
      console.log('矿产饼图：无数据，跳过渲染');
      return;
    }

    // 提取矿种和储量数据
    const pieData = [];

    items.forEach(row => {
      const name = row['种类'] || '未知';

      // 跳过表头行
      if (name === '种类') {
        return;
      }

      // 查找储量字段（可能是"可开采储量/亿吨"、"总储量(万吨)"等）
      let reserve = 0;
      Object.keys(row).forEach(key => {
        if (key.includes('储量')) {
          const value = parseFloat(row[key]);
          if (!isNaN(value)) {
            reserve = value;
          }
        }
      });

      if (reserve > 0) {
        pieData.push({ name: name, value: reserve });
      }
    });

    if (!pieData || pieData.length === 0 || pieData.every(d => d.value === 0)) {
      console.log('矿产饼图：无有效数据，跳过渲染');
      return;
    }

    // 数据验证：限制矿产数量，防止饼图过于拥挤
    const MAX_MINERALS = 10;  // 最多显示 10 种矿产
    let limitedPieData = pieData;

    if (pieData.length > MAX_MINERALS) {
      // 按储量降序排序，取前 MAX_MINERALS 个
      limitedPieData = pieData
        .sort((a, b) => b.value - a.value)
        .slice(0, MAX_MINERALS);

      console.log(`矿产分布图表：矿产种类过多，仅显示储量最大的前 ${MAX_MINERALS} 种（共 ${pieData.length} 种）`);
    }

    console.log('矿产分布图表数据:', limitedPieData);

    // 动态设置图表标题
    const chartTitle = limitedPieData.length < pieData.length ? '矿产储量分布（前10）' : '矿产储量分布';

    // 设置图表配置
    this.setData({
      mineralChartTitle: chartTitle,  // 更新标题
      mineralChartEc: {
        lazyLoad: true,
        onInit: (canvas, width, height, dpr) => {
          const echarts = require('../../ec-canvas/echarts.min');

          // 销毁旧的图表实例
          if (this.chartInstances.mineral) {
            try {
              this.chartInstances.mineral.dispose();
            } catch (e) {
              console.warn('销毁旧图表实例失败:', e);
            }
          }

          const chart = echarts.init(canvas, null, {
            width: width,
            height: height,
            devicePixelRatio: dpr
          });

          // 保存图表实例引用（存储到页面实例属性，不放在 data 中）
          this.chartInstances.mineral = chart;

          chart.setOption({
            title: {
              text: limitedPieData.length < pieData.length ? '主要矿产分布（前10）' : '主要矿产分布',
              left: 'center',
              top: 10,
              textStyle: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#1A56A0'
              }
            },
            tooltip: {
              trigger: 'item',
              formatter: '{b}: {c} ({d}%)',
              confine: true,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderColor: '#1A56A0',
              borderWidth: 1,
              textStyle: {
                color: '#333'
              }
            },
            legend: {
              bottom: 10,
              left: 'center',
              textStyle: {
                fontSize: 11,
                color: '#666'
              },
              itemWidth: 16,
              itemHeight: 12
            },
            series: [{
              type: 'pie',
              radius: ['40%', '65%'],
              center: ['50%', '45%'],
              data: limitedPieData,
              label: {
                fontSize: 11,
                color: '#666'
              },
              labelLine: {
                length: 15,
                length2: 10
              },
              itemStyle: {
                borderRadius: 8,
                borderColor: '#fff',
                borderWidth: 2
              },
              color: ['#1A56A0', '#2E75B6', '#4A8FD8', '#667eea', '#5B9BD5', '#70AD47', '#FFC000', '#ED7D31', '#A5A5A5', '#5470C6'],
              emphasis: {
                itemStyle: {
                  shadowBlur: 10,
                  shadowOffsetX: 0,
                  shadowColor: 'rgba(0, 0, 0, 0.3)'
                },
                label: {
                  fontSize: 13,
                  fontWeight: 'bold'
                }
              }
            }]
          });

          return chart;
        }
      }
    }, () => {
      // setData完成后，等待DOM更新再初始化图表
      setTimeout(() => {
        const chartComponent = this.getChartComponent('#mineral-chart');
        if (chartComponent) {
          chartComponent.init();
          console.log('矿产分布图表初始化完成');
        }
      }, 100);
    });
  },

  /**
   * 已修复：TC27 - 页面卸载时销毁所有图表实例，避免内存泄漏
   */
  onUnload: function() {
    console.log('页面卸载，开始销毁图表实例');
    const instances = this.data.chartInstances || {};
    Object.keys(instances).forEach(key => {
      try {
        if (instances[key] && instances[key].dispose) {
          instances[key].dispose();
          console.log(`已销毁图表实例: ${key}`);
        }
      } catch (e) {
        console.warn(`销毁图表实例 ${key} 失败:`, e);
      }
    });
    this.setData({ chartInstances: {} });
  }
});
