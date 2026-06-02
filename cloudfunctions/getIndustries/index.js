// 云函数：getIndustries - 获取产业列表
// 功能：查询所有产业，并获取每个产业最新上传的时间、所有已上传的季度列表
const cloud = require('wx-server-sdk');

cloud.init();

const db = cloud.database();
const _ = db.command;

/**
 * 格式化季度显示
 * 将 2026Q1 格式转为 "2026年 第一季度"
 * @param {string} period - 季度值，如 2026Q1
 * @returns {string} 格式化后的季度文字
 */
function formatPeriod(period) {
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
}

/**
 * 统计跨季度去重的条目总数
 *
 * 去重规则：
 * - 同一产业下，不同季度出现相同条目名称，只计1次
 * - 不同产业的同名条目各自计算，不互相影响
 * - 使用「产业名::条目名」作为唯一键进行去重
 *
 * @param {object} db - 数据库实例
 * @param {string} moduleName - 模块名称，如「龙头企业」「科技创新项目」
 * @param {string} level - 级别，如「provincial」「national」
 * @param {string} nameField - 去重字段名，如「名称」「项目名称」
 * @returns {number} 去重后的条目总数
 */
async function countUniqueItems(db, moduleName, level, nameField) {
  const uniqueSet = new Set();
  let skip = 0;
  const pageSize = 100;
  let hasMore = true;

  while (hasMore) {
    const res = await db.collection('industry_data')
      .where({
        moduleName: moduleName,
        level: level
      })
      .skip(skip)
      .limit(pageSize)
      .get();

    console.log(`查询 ${moduleName}(${level}) 第${skip / pageSize + 1}页，记录数：${res.data.length}`);

    res.data.forEach(record => {
      const industryName = record.industryName;

      if (Array.isArray(record.items)) {
        record.items.forEach(item => {
          const itemName = item[nameField];
          if (itemName && String(itemName).trim() !== '') {
            uniqueSet.add(`${industryName}::${String(itemName).trim()}`);
          }
        });
      }
    });

    hasMore = res.data.length === pageSize;
    skip += pageSize;
  }

  console.log(`${moduleName}(${level}) 去重后总数：`, uniqueSet.size);

  return uniqueSet.size;
}

/**
 * 分页获取所有产业记录
 */
async function getAllIndustries(db, query) {
  const allData = [];
  let skip = 0;
  const pageSize = 100;
  let hasMore = true;

  while (hasMore) {
    const res = await query
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    allData.push(...res.data);
    hasMore = res.data.length === pageSize;
    skip += pageSize;
  }

  return allData;
}

/**
 * 云函数入口
 * 返回产业列表，包含：name, latestTime, periods
 */
exports.main = async (event, context) => {
  try {
    // ==========================================
    // 第一步：查询所有产业
    // ==========================================
    let query = db.collection('industries');

    // 如果传入了IDs数组，则按IDs查询
    if (event.ids && Array.isArray(event.ids) && event.ids.length > 0) {
      query = query.where({
        _id: _.in(event.ids)
      });
    }

    const industries = await getAllIndustries(db, query);

    console.log('查询到产业数量:', industries.length);

    // ==========================================
    // 第二步：为每个产业查询所有已上传的季度列表
    // ==========================================
    const result = [];

    for (const industry of industries) {
      // 分页查询该产业所有成功的上传记录，按上传时间倒序
      const allUploads = [];
      let skip = 0;
      const pageSize = 100;
      let hasMore = true;

      while (hasMore) {
        const uploadsRes = await db.collection('uploads')
          .where({
            industryName: industry.name,
            status: 'success'
          })
          .orderBy('createdAt', 'desc')
          .skip(skip)
          .limit(pageSize)
          .get();

        allUploads.push(...uploadsRes.data);
        hasMore = uploadsRes.data.length === pageSize;
        skip += pageSize;
      }

      // 提取所有不重复的季度值
      const periodSet = new Set();
      allUploads.forEach(upload => {
        if (upload.timePeriod) {
          periodSet.add(upload.timePeriod);
        }
      });

      // 转为数组并排序（倒序，最新的在前）
      const periodValues = Array.from(periodSet).sort((a, b) => {
        // 简单字符串比较即可，因为格式统一为 2026Q1
        return b.localeCompare(a);
      });

      // 格式化为 {value, label} 格式
      const periods = periodValues.map(p => ({
        value: p,
        label: formatPeriod(p)
      }));

      // 最新季度
      const latestTime = periodValues.length > 0 ? periodValues[0] : '';

      result.push({
        _id: industry._id,
        name: industry.name,
        latestTime: latestTime,
        periods: periods,  // 新增：所有季度列表
        moduleCount: 8,    // 固定为8大模块
        createdAt: industry.createdAt
      });
    }

    console.log('返回产业列表，数量:', result.length);

    // ==========================================
    // 第三步：统计汇总数据（summary）
    // ==========================================

    // 统计总季度数
    let totalPeriods = 0;
    for (const industry of result) {
      totalPeriods += industry.periods.length;
    }

    // 【新逻辑】跨季度去重统计省级龙头企业和科技项目
    // 注意：去重字段名必须与数据库 items 中实际存储的 key 完全一致
    // 这里使用「名称」和「项目名称」，如果实际字段名不同需要修改
    console.log('开始统计跨季度去重数据...');

    const totalEnterprises = await countUniqueItems(
      db,
      '龙头企业',       // module
      'provincial',     // level
      '名称'            // 去重字段名（请确认数据库中实际字段名）
    );

    const totalProjects = await countUniqueItems(
      db,
      '科技创新项目',   // module
      'provincial',     // level
      '项目名称'        // 去重字段名（请确认数据库中实际字段名）
    );

    const summary = {
      totalIndustries: industries.length,  // 已有产业总数
      totalPeriods: totalPeriods,          // 所有产业上传成功的季度总数
      totalEnterprises: totalEnterprises,  // 【新】跨季度去重后的省级龙头企业总数
      totalProjects: totalProjects,        // 【新】跨季度去重后的省级科技项目总数
      radarData: [],                       // 雷达图数据（保留用于未来扩展）
      completeness: []                     // 数据完整度（保留用于未来扩展）
    };

    // 【保留】为每个产业统计最新季度的各模块数据（用于雷达图和完整度）
    for (const industry of industries) {
      // 获取该产业最新季度
      const industryResult = result.find(r => r._id === industry._id);
      const latestPeriod = industryResult?.latestTime;

      if (!latestPeriod) {
        // 没有上传数据的产业，完整度为0
        summary.completeness.push({
          name: industry.name,
          uploaded: 0,
          total: 4,
          percent: 0
        });
        continue;
      }

      // 查询该产业最新季度的所有模块数据
      const industryDataRes = await db.collection('industry_data')
        .where({
          industryName: industry.name,
          timePeriod: latestPeriod
        })
        .get();

      const industryData = industryDataRes.data;

      // 统计各模块省级数据数量（用于雷达图）
      let enterprises = 0;  // 省级龙头企业
      let projects = 0;     // 省级科技创新项目
      let awards = 0;       // 省级科技成果奖
      let papers = 0;       // 高水平论文（省级）
      let policies = 0;     // 产业技术规划（省级）

      industryData.forEach(data => {
        if (data.level === 'provincial') {
          const itemCount = Array.isArray(data.items) ? data.items.length : 0;

          switch (data.moduleName) {
            case '龙头企业':
              enterprises += itemCount;
              break;
            case '科技创新项目':
              projects += itemCount;
              break;
            case '科技成果奖':
              awards += itemCount;
              break;
            case '高水平论文':
              papers += itemCount;
              break;
            case '产业技术规划':
              policies += itemCount;
              break;
          }
        }
      });

      // 添加到雷达图数据
      summary.radarData.push({
        name: industry.name,
        enterprises: enterprises,
        projects: projects,
        awards: awards,
        papers: papers,
        policies: policies
      });

      // 计算数据完整度（已上传季度数 / 4个季度）
      const uploadedCount = industryResult.periods.length;
      summary.completeness.push({
        name: industry.name,
        uploaded: uploadedCount,
        total: 4,
        percent: Math.round((uploadedCount / 4) * 100)
      });
    }

    console.log('汇总统计完成:', summary);

    return {
      success: true,
      industries: result,  // 产业列表
      summary: summary     // 汇总统计数据
    };

  } catch (err) {
    console.error('getIndustries 云函数错误：', err);
    return {
      success: false,
      error: err.message || '服务器错误',
      industries: [],
      summary: null
    };
  }
};
