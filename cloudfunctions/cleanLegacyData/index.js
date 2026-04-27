// 云函数：cleanLegacyData - 清理历史遗留数据
// 功能：删除状态异常或格式不正确的上传记录

const cloud = require('wx-server-sdk');

cloud.init();

const db = cloud.database();

/**
 * 云函数入口
 * 清理以下类型的记录：
 * 1. timePeriod 格式不正确的记录（如 "2025" 而非 "2025Q1"）
 * 2. 长期处于 parsing 状态的记录
 */
exports.main = async (event, context) => {
  try {
    console.log('开始清理历史遗留数据...');

    // ==========================================
    // 第一步：查询所有上传记录
    // ==========================================
    const uploadsRes = await db.collection('uploads').get();
    const uploads = uploadsRes.data;

    console.log(`共查询到 ${uploads.length} 条上传记录`);

    let cleanedCount = 0;
    const cleanedRecords = [];

    // ==========================================
    // 第二步：筛选需要清理的记录
    // ==========================================
    for (const upload of uploads) {
      let shouldClean = false;
      let reason = '';

      // 检查 timePeriod 格式是否正确（应为 2025Q1 格式）
      const periodMatch = upload.timePeriod && upload.timePeriod.match(/^\d{4}Q[1-4]$/);
      if (!periodMatch) {
        shouldClean = true;
        reason = `时间格式不正确: ${upload.timePeriod}`;
      }

      // 检查是否长期处于 parsing 状态（超过1小时）
      if (upload.status === 'parsing') {
        const uploadTime = new Date(upload.uploadedAt || upload.createdAt).getTime();
        const now = Date.now();
        const hoursPassed = (now - uploadTime) / (1000 * 60 * 60);

        if (hoursPassed > 1) {
          shouldClean = true;
          reason = `长期处于解析中状态: ${hoursPassed.toFixed(1)} 小时`;
        }
      }

      // 如果需要清理，执行删除
      if (shouldClean) {
        console.log(`清理记录: ${upload.industryName} - ${upload.timePeriod}, 原因: ${reason}`);

        try {
          // 删除 uploads 记录
          await db.collection('uploads').doc(upload._id).remove();

          // 删除关联的 industry_data 数据
          if (upload.industryName && upload.timePeriod) {
            await db.collection('industry_data')
              .where({
                industryName: upload.industryName,
                timePeriod: upload.timePeriod
              })
              .remove();
          }

          cleanedCount++;
          cleanedRecords.push({
            industryName: upload.industryName,
            timePeriod: upload.timePeriod,
            reason: reason
          });

        } catch (err) {
          console.error(`删除记录失败: ${upload._id}`, err);
        }
      }
    }

    console.log(`清理完成，共清理 ${cleanedCount} 条记录`);

    return {
      success: true,
      cleanedCount: cleanedCount,
      cleanedRecords: cleanedRecords,
      message: `成功清理 ${cleanedCount} 条历史遗留数据`
    };

  } catch (err) {
    console.error('清理历史遗留数据失败：', err);
    return {
      success: false,
      error: err.message || '清理失败'
    };
  }
};
