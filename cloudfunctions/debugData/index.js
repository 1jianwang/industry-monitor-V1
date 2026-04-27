// cloudfunctions/debugData/index.js
// 诊断云函数：检查数据库中的数据状态
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 诊断数据库状态
 * 参数：industryName（可选）
 */
exports.main = async (event, context) => {
  const { industryName } = event

  try {
    console.log('开始诊断数据库状态...')

    // ==========================================
    // 1. 检查 uploads 集合
    // ==========================================
    let uploadsQuery = db.collection('uploads')
    if (industryName) {
      uploadsQuery = uploadsQuery.where({ industryName })
    }

    const uploadsRes = await uploadsQuery.orderBy('createdAt', 'desc').get()
    console.log('uploads 集合记录数:', uploadsRes.data.length)

    const uploadsInfo = uploadsRes.data.map(item => ({
      _id: item._id,
      industryName: item.industryName,
      timePeriod: item.timePeriod,
      status: item.status,
      fileName: item.fileName,
      createdAt: item.createdAt
    }))

    // ==========================================
    // 2. 检查 industry_data 集合
    // ==========================================
    let dataQuery = db.collection('industry_data')
    if (industryName) {
      dataQuery = dataQuery.where({ industryName })
    }

    const dataCountRes = await dataQuery.count()
    console.log('industry_data 集合记录数:', dataCountRes.total)

    // 获取前20条数据样本
    const dataSampleRes = await dataQuery.limit(20).get()
    const dataSample = dataSampleRes.data.map(item => ({
      _id: item._id,
      industryName: item.industryName,
      timePeriod: item.timePeriod,
      moduleName: item.moduleName,
      level: item.level,
      itemsCount: item.items ? item.items.length : 0
    }))

    // ==========================================
    // 3. 按产业和时间分组统计
    // ==========================================
    const groupStats = {}

    for (const upload of uploadsRes.data) {
      const key = `${upload.industryName}_${upload.timePeriod}`

      const dataRes = await db.collection('industry_data')
        .where({
          industryName: upload.industryName,
          timePeriod: upload.timePeriod
        })
        .count()

      groupStats[key] = {
        industryName: upload.industryName,
        timePeriod: upload.timePeriod,
        uploadStatus: upload.status,
        dataCount: dataRes.total
      }
    }

    // ==========================================
    // 4. 检查 industries 集合
    // ==========================================
    let industriesQuery = db.collection('industries')
    if (industryName) {
      industriesQuery = industriesQuery.where({ name: industryName })
    }

    const industriesRes = await industriesQuery.get()
    const industriesInfo = industriesRes.data.map(item => ({
      _id: item._id,
      name: item.name,
      createdAt: item.createdAt
    }))

    // ==========================================
    // 返回诊断结果
    // ==========================================
    return {
      success: true,
      summary: {
        uploadsCount: uploadsRes.data.length,
        industryDataCount: dataCountRes.total,
        industriesCount: industriesRes.data.length
      },
      uploads: uploadsInfo,
      dataSample: dataSample,
      groupStats: groupStats,
      industries: industriesInfo
    }

  } catch (err) {
    console.error('诊断失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}
