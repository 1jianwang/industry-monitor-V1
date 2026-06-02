// cloudfunctions/cleanPendingUploads/index.js

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

/**
 * 清理僵尸上传记录
 * 将超过30分钟仍为 pending 状态的记录标记为 failed
 */
exports.main = async (event, context) => {
  try {
    console.log('[清理僵尸记录] 开始执行')

    // 查找30分钟前创建的 pending 记录
    const expireTime = new Date(Date.now() - 30 * 60 * 1000)

    const res = await db.collection('uploads')
      .where({
        status: 'pending',
        createdAt: _.lt(expireTime)
      })
      .get()

    if (res.data.length === 0) {
      console.log('[清理僵尸记录] 无需清理的记录')
      return { success: true, cleaned: 0 }
    }

    console.log(`[清理僵尸记录] 发现 ${res.data.length} 条僵尸记录`)

    // 将僵尸记录标记为 failed
    let cleanedCount = 0
    for (const record of res.data) {
      try {
        await db.collection('uploads').doc(record._id).update({
          data: {
            status: 'failed',
            errorMsg: '上传超时，请重新上传',
            completedAt: db.serverDate()
          }
        })
        cleanedCount++
      } catch (err) {
        console.error(`清理记录 ${record._id} 失败:`, err)
      }
    }

    console.log(`[清理僵尸记录] 成功清理 ${cleanedCount} 条记录`)

    return {
      success: true,
      cleaned: cleanedCount,
      total: res.data.length
    }

  } catch (err) {
    console.error('[清理僵尸记录] 执行失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}
