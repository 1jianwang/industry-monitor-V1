// cloudfunctions/deleteUpload/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 删除上传记录及相关数据
 * 参数：uploadId, industryName, timePeriod
 * 权限：仅管理员可调用
 */
exports.main = async (event, context) => {
  const { uploadId, industryName, timePeriod } = event
  const { OPENID } = cloud.getWXContext()

  console.log('删除上传记录请求:', { uploadId, industryName, timePeriod, openid: OPENID })

  // ==========================================
  // 第一步：验证调用者身份
  // ==========================================
  try {
    const userRes = await db.collection('users').where({
      openid: OPENID
    }).get()

    if (userRes.data.length === 0 || userRes.data[0].role !== 'admin') {
      console.error('权限不足，非管理员用户')
      return {
        success: false,
        error: '权限不足，仅管理员可执行此操作'
      }
    }

    console.log('权限验证通过，用户角色:', userRes.data[0].role)
  } catch (err) {
    console.error('权限验证失败:', err)
    return {
      success: false,
      error: '权限验证失败'
    }
  }

  try {
    // ==========================================
    // 已修复：TC29 - 调整删除顺序，优先删除数据库，最后删除云存储
    // 第一步：先查询获取文件路径
    // ==========================================
    const uploadRes = await db.collection('uploads').doc(uploadId).get()

    if (!uploadRes.data) {
      console.error('上传记录不存在')
      return {
        success: false,
        error: '上传记录不存在'
      }
    }

    const fileID = uploadRes.data.fileURL
    console.log('找到上传记录，文件URL:', fileID)

    // ==========================================
    // 第二步：删除 industry_data 数据（最重要的业务数据先删）
    // ==========================================
    const dataDeleteRes = await db.collection('industry_data')
      .where({
        industryName: industryName,
        timePeriod: timePeriod
      })
      .remove()

    console.log('删除产业数据记录数:', dataDeleteRes.stats.removed)

    // ==========================================
    // 第三步：删除 uploads 记录
    // ==========================================
    await db.collection('uploads').doc(uploadId).remove()
    console.log('删除上传记录成功')

    // ==========================================
    // 第四步：检查该产业是否还有其他上传记录
    // ==========================================
    const remainingUploads = await db.collection('uploads')
      .where({
        industryName: industryName,
        status: 'success'
      })
      .count()

    console.log('该产业剩余上传记录数:', remainingUploads.total)

    // 如果没有其他上传记录，删除 industries 集合中的产业记录
    if (remainingUploads.total === 0) {
      await db.collection('industries')
        .where({
          name: industryName
        })
        .remove()
      console.log('该产业无其他数据，已删除产业记录')
    }

    // ==========================================
    // 第五步：最后删除云存储文件（即使失败也不影响数据一致性）
    // ==========================================
    if (fileID) {
      try {
        await cloud.deleteFile({
          fileList: [fileID]
        })
        console.log('云存储文件删除成功:', fileID)
      } catch (err) {
        console.warn('云存储文件删除失败（但数据库已清理，不影响数据一致性）:', err)
      }
    }

    return {
      success: true,
      message: '删除成功'
    }

  } catch (err) {
    console.error('删除失败:', err)
    return {
      success: false,
      error: err.message || '删除失败'
    }
  }
}
