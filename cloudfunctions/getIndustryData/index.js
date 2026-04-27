// 云函数：getIndustryData - 获取产业数据详情
// 功能：查询指定产业的数据，支持按时间筛选，返回结构化数据
const cloud = require('wx-server-sdk');

cloud.init();

const db = cloud.database();

/**
 * 云函数入口
 * @param {string} event.industryName - 产业名称（必填）
 * @param {string} event.timePeriod - 数据时间（可选，不传则返回所有时间列表）
 */
exports.main = async (event, context) => {
  try {
    const { industryName, timePeriod } = event;

    // 检查必填参数
    if (!industryName) {
      return {
        success: false,
        error: '缺少产业名称参数'
      };
    }

    console.log('查询产业数据:', { industryName, timePeriod });

    // ==========================================
    // 查询该产业所有可用的时间版本
    // ==========================================
    const uploadsRes = await db.collection('uploads')
      .where({
        industryName: industryName,
        status: 'success'
      })
      .orderBy('createdAt', 'desc')
      .get();

    // 提取所有不重复的时间版本
    const timePeriods = [...new Set(uploadsRes.data.map(item => item.timePeriod))];
    console.log('可用时间版本:', timePeriods);

    // 如果没有传时间参数，只返回时间列表
    if (!timePeriod) {
      return {
        success: true,
        timePeriods: timePeriods
      };
    }

    // ==========================================
    // 查询指定时间的产业数据
    // ==========================================
    const MAX_LIMIT = 100;
    let allData = [];
    let hasMore = true;
    let skip = 0;

    while (hasMore) {
      const dataRes = await db.collection('industry_data')
        .where({
          industryName: industryName,
          timePeriod: timePeriod
        })
        .skip(skip)
        .limit(MAX_LIMIT)
        .get();

      allData = allData.concat(dataRes.data);

      if (dataRes.data.length < MAX_LIMIT) {
        hasMore = false;
      } else {
        skip += MAX_LIMIT;
      }
    }

    console.log('查询到数据条数:', allData.length);

    // ==========================================
    // 组织数据结构：按模块和层级分组
    // ==========================================
    const organizedData = {};

    console.log('开始组织数据，原始记录数:', allData.length);

    allData.forEach((record, index) => {
      const moduleName = record.moduleName;
      const level = record.level; // international/national/provincial

      // 调试：打印前3条记录的结构
      if (index < 3) {
        console.log(`记录${index}:`, JSON.stringify({
          moduleName,
          level,
          hasItems: !!record.items,
          itemsLength: record.items ? record.items.length : 0
        }));
      }

      if (!organizedData[moduleName]) {
        organizedData[moduleName] = {
          international: [],
          national: [],
          provincial: []
        };
      }

      // 处理 items 数组格式（新格式：每个模块+层级一条记录，包含items数组）
      if (record.items && Array.isArray(record.items)) {
        organizedData[moduleName][level] = record.items;
      }
    });

    console.log('组织后的数据模块数:', Object.keys(organizedData).length);
    // 打印每个模块的数据量
    Object.keys(organizedData).forEach(moduleName => {
      const intCount = organizedData[moduleName].international.length;
      const natCount = organizedData[moduleName].national.length;
      const provCount = organizedData[moduleName].provincial.length;
      console.log(`${moduleName}: 国际${intCount}条, 国内${natCount}条, 省级${provCount}条`);
    });

    // ==========================================
    // 返回结果
    // ==========================================
    return {
      success: true,
      data: organizedData,
      timePeriods: timePeriods,
      currentTimePeriod: timePeriod
    };

  } catch (err) {
    console.error('getIndustryData 云函数错误：', err);
    return {
      success: false,
      error: err.message || '服务器错误'
    };
  }
};