// 云函数：batchDeleteUploads - 批量删除上传记录及关联数据
// 功能：批量删除 uploads 记录，并删除对应的 industry_data 数据

const cloud = require('wx-server-sdk');

cloud.init();

const db = cloud.database();
const _ = db.command;

/**
 * 云函数入口
 * @param {Array} uploadIds - 要删除的上传记录ID数组
 */
exports.main = async (event, context) => {
  const { uploadIds } = event;

  const { OPENID } = cloud.getWXContext();
  try {
    const userRes = await db.collection('users')
      .where({ openid: OPENID })
      .limit(1)
      .get();
    if (!userRes.data || userRes.data.length === 0 || userRes.data[0].role !== 'admin') {
      console.error('权限不足，非管理员用户');
      return { success: false, error: '无权限执行此操作' };
    }
    console.log('权限验证通过，用户角色:', userRes.data[0].role);
  } catch (err) {
    console.error('权限校验失败:', err);
    return { success: false, error: '权限校验失败: ' + err.message };
  }

  // 参数校验
  if (!uploadIds || !Array.isArray(uploadIds) || uploadIds.length === 0) {
    return {
      success: false,
      error: '参数错误：uploadIds 必须是非空数组'
    };
  }

  console.log('批量删除请求，uploadIds:', uploadIds);

  try {
    let deletedCount = 0;

    // 遍历每个 uploadId 进行删除
    for (const uploadId of uploadIds) {
      try {
        // ==========================================
        // 第一步：查询该上传记录的详细信息
        // ==========================================
        const uploadRes = await db.collection('uploads')
          .doc(uploadId)
          .get();

        if (!uploadRes.data) {
          console.log(`上传记录 ${uploadId} 不存在，跳过`);
          continue;
        }

        const upload = uploadRes.data;
        const { industryName, timePeriod } = upload;

        console.log(`删除记录：${industryName} - ${timePeriod}`);

        // ==========================================
        // 第二步：删除 industry_data 集合中的关联数据
        // ==========================================
        const dataDeleteRes = await db.collection('industry_data')
          .where({
            industryName: industryName,
            timePeriod: timePeriod
          })
          .remove();

        console.log(`删除 industry_data 数据，删除数量：${dataDeleteRes.stats.removed}`);

        // ==========================================
        // 第三步：删除 uploads 记录
        // ==========================================
        await db.collection('uploads')
          .doc(uploadId)
          .remove();

        console.log(`删除 uploads 记录成功：${uploadId}`);

        // ==========================================
        // 第四步：检查该产业是否还有其他数据
        // 如果没有，删除 industries 记录
        // ==========================================
        const remainingDataRes = await db.collection('industry_data')
          .where({
            industryName: industryName
          })
          .count();

        if (remainingDataRes.total === 0) {
          // 该产业已无任何数据，删除 industries 记录
          const industryDeleteRes = await db.collection('industries')
            .where({
              name: industryName
            })
            .remove();

          console.log(`产业「${industryName}」已无数据，删除 industries 记录，删除数量：${industryDeleteRes.stats.removed}`);
        }

        deletedCount++;

      } catch (err) {
        console.error(`删除记录 ${uploadId} 失败:`, err);
        // 继续处理下一个，不中断整个批量删除流程
      }
    }

    console.log(`批量删除完成，成功删除 ${deletedCount} 条记录`);

    return {
      success: true,
      deletedCount: deletedCount,
      message: `成功删除 ${deletedCount} 条记录`
    };

  } catch (err) {
    console.error('批量删除失败：', err);
    return {
      success: false,
      error: err.message || '批量删除失败'
    };
  }
};
