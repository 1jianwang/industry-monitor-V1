// cloudfunctions/getUploads/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 获取所有上传记录
 * 权限：仅管理员可调用
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  try {
    // 验证管理员身份
    const userRes = await db.collection('users').where({
      openid: OPENID
    }).get()

    if (userRes.data.length === 0 || userRes.data[0].role !== 'admin') {
      return {
        success: false,
        error: '权限不足，仅管理员可访问'
      }
    }

    // 查询所有上传记录，按上传时间倒序
    const uploadRes = await db.collection('uploads')
      .orderBy('uploadedAt', 'desc')
      .get()

    return {
      success: true,
      data: uploadRes.data
    }

  } catch (err) {
    console.error('获取上传记录失败:', err)
    return {
      success: false,
      error: err.message || '获取失败'
    }
  }
}
