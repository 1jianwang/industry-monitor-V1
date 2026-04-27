// cloudfunctions/updateUserRole/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 更新用户角色
 * 参数：userId, newRole
 * 权限：仅管理员可调用
 */
exports.main = async (event, context) => {
  const { userId, newRole } = event
  const { OPENID } = cloud.getWXContext()

  try {
    // 验证管理员身份
    const userRes = await db.collection('users').where({
      openid: OPENID
    }).get()

    if (userRes.data.length === 0 || userRes.data[0].role !== 'admin') {
      return {
        success: false,
        error: '权限不足，仅管理员可执行此操作'
      }
    }

    // 验证新角色值
    if (newRole !== 'admin' && newRole !== 'viewer') {
      return {
        success: false,
        error: '无效的角色值'
      }
    }

    // 更新用户角色
    await db.collection('users').doc(userId).update({
      data: {
        role: newRole
      }
    })

    return {
      success: true,
      message: '角色更新成功'
    }

  } catch (err) {
    console.error('更新用户角色失败:', err)
    return {
      success: false,
      error: err.message || '更新失败'
    }
  }
}
