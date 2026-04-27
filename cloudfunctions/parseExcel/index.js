// 云函数：parseExcel - 解析Excel文件
// 功能：动态关键词识别模块边界，支持8大模块+3个附加模块
const cloud = require('wx-server-sdk');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

cloud.init();

// 数据库
const db = cloud.database();
const _ = db.command;

const TIMEOUT_MS = 150000;

// ==========================================
// 模块识别关键词配置
// ==========================================
const MODULE_KEYWORDS = [
  { keyword: '高水平大学', moduleName: '高水平大学' },
  { keyword: '顶尖研究机构', moduleName: '顶尖研究机构' },
  { keyword: '领衔科学家', moduleName: '领衔科学家' },
  { keyword: '主要矿产', moduleName: '主要矿产分布' },
  { keyword: '龙头企业', moduleName: '龙头企业' },
  { keyword: '市场规模', moduleName: '市场规模' },
  { keyword: '高水平论文', moduleName: '高水平论文' },
  { keyword: '产业技术规划', moduleName: '产业技术规划' },
  { keyword: '科技创新项目', moduleName: '科技创新项目' },
  { keyword: '科技成果奖', moduleName: '科技成果奖' },
  { keyword: '国家重大项目', moduleName: '国家重大项目' }
];

// ==========================================
// 每个模块的字段定义（列索引从0开始，A列=0，B列=1）
// ==========================================
const MODULE_FIELDS = {
  '高水平大学': {
    international: { startCol: 1, fields: ['名称', '研究领域', '创新优势', '_', '_', '统计来源'] },
    national: { startCol: 7, fields: ['名称', '研究领域', '创新优势', '_', '_', '统计来源'] },
    provincial: { startCol: 13, fields: ['名称', '研究领域', '创新优势', '_', '_', '统计来源'] }
  },
  '顶尖研究机构': {
    international: { startCol: 1, fields: ['名称', '研究方向', '核心技术(应用)', '_', '_', '统计来源'] },
    national: { startCol: 7, fields: ['名称', '研究方向', '核心技术及应用', '_', '_', '统计来源'] },
    provincial: { startCol: 13, fields: ['名称', '类别', '研究方向', '核心技术及应用', '_', '统计来源'] }
  },
  '领衔科学家': {
    international: { startCol: 1, fields: ['姓名', '所在单位', '核心研究领域', '主要创新理论与成果', '_', '统计来源'] },
    national: { startCol: 7, fields: ['姓名', '所在单位', '主要创新理论与成果', '_', '_', '统计来源'] },
    provincial: { startCol: 13, fields: ['姓名', '所在单位', '主要创新理论与成果', '_', '_', '统计来源'] }
  },
  '主要矿产分布': {
    international: { startCol: 1, fields: ['种类', '可开采储量/亿吨', '主要国家及储量占比', '_', '_', '_'] },
    national: { startCol: 7, fields: ['种类', '总储量(万吨)', '分布及储量占比', '_', '_', '_'] },
    provincial: { startCol: 13, fields: ['种类', '总储量(万吨)', '分布及储量占比', '_', '_', '_'] }
  },
  '龙头企业': {
    international: { startCol: 1, fields: ['名称', '主要产品种类及应用场景', '2024年产量/万吨', '2024年产值/亿美元', '领先技术', '_'] },
    national: { startCol: 7, fields: ['名称', '主要产品种类及应用场景', '2024年产量(万吨)', '2024年营收(亿元)', '领先技术', '_'] },
    provincial: { startCol: 13, fields: ['名称', '主要产品种类及应用领域', '2024年产量(万吨)', '2024年营收(亿元)', '领先技术', '_'] }
  },
  '市场规模': {
    international: { startCol: 1, fields: ['品种', '2023年产量/亿吨', '2023年产值/万亿美元', '2024年产量/亿吨', '2024年产值/万亿美元', '_'] },
    national: { startCol: 7, fields: ['产品种类', '2023年产量(万吨)', '2023年产值(亿元)', '2024年产量(万吨)', '2024年产值(亿元)', '_'] },
    provincial: { startCol: 13, fields: ['产品种类', '2021年产量(万吨)', '2022年产量(万吨)', '2023年产量(万吨)', '2024年产量(万吨)'] }
  },
  '高水平论文': {
    international: { startCol: 1, fields: ['题目', '通讯作者', '单位', '重要创新内容', '_', '_'] },
    national: { startCol: 7, fields: ['题目', '通讯作者', '单位', '重要创新内容', '_', '_'] },
    provincial: { startCol: 13, fields: ['题目', '作者', '单位', '重要创新内容', '_', '_'] }
  },
  '产业技术规划': {
    international: { startCol: 1, fields: ['名称', '国家', '发布时间', '主要内容', '_', '_'] },
    national: { startCol: 7, fields: ['名称', '省份', '主要内容', '_', '_', '_'] },
    provincial: { startCol: 13, fields: ['名称/发布时间', '_', '主要内容', '_', '_', '_'] }
  },
  '科技创新项目': {
    provincial: { startCol: 1, fields: ['项目类别', '_', '项目名称', '_', '承担单位', '_', '_', '核心技术', '_', '_', '产生成果', '_', '_', '_', '经济/战略价值'] }
  },
  '科技成果奖': {
    provincial: { startCol: 1, fields: ['获奖类别', '_', '_', '名称', '_', '_', '_', '获奖单位', '_', '_', '主要完成人', '_', '_', '_', '级别/年份'] }
  },
  '国家重大项目': {
    national: { startCol: 1, fields: ['名称', '_', '_', '项目性质', '_', '_', '_', '核心技术', '_', '_', '技术成果', '_', '_', '_', '经济/战略价值'] }
  }
};

async function updateUploadStatus(db, uploadId, status, errorMsg = null) {
  const updateData = {
    status: status,
    completedAt: db.serverDate()
  };
  if (errorMsg) {
    updateData.errorMsg = errorMsg;
  }
  if (status === 'success') {
    // 成功时不需要 errorMsg
    delete updateData.errorMsg;
  }
  await db.collection('uploads').doc(uploadId).update({ data: updateData });
}

/**
 * 云函数入口
 * @param {string} event.fileID - 云存储文件ID
 * @param {string} event.industryName - 产业名称
 * @param {string} event.timePeriod - 数据时间（如：2024 或 2024Q4）
 * @param {string} event.fileName - 文件名
 */
exports.main = async (event, context) => {
  const { fileID, industryName, timePeriod, fileName } = event;

  console.log('开始解析Excel:', { fileID, industryName, timePeriod, fileName });

  const startTime = Date.now();

  const { OPENID } = cloud.getWXContext();
  try {
    const userRes = await db.collection('users')
      .where({ openid: OPENID })
      .limit(1)
      .get();
    if (!userRes.data || userRes.data.length === 0 || userRes.data[0].role !== 'admin') {
      console.error('权限不足，非管理员用户');
      return { success: false, error: '无权限执行上传操作' };
    }
    console.log('权限验证通过，用户角色:', userRes.data[0].role);
  } catch (err) {
    console.error('权限校验失败:', err);
    return { success: false, error: '权限校验失败: ' + err.message };
  }

  // 创建 uploads 记录
  let uploadId = null;
  try {
    const uploadRes = await db.collection('uploads').add({
      data: {
        industryName: industryName,
        timePeriod: timePeriod,
        fileID: fileID,
        fileName: fileName || '未知文件',
        status: 'pending',
        createdAt: db.serverDate()
      }
    });
    uploadId = uploadRes._id;
    console.log('uploads 记录创建成功，ID：', uploadId);
  } catch (err) {
    console.error('创建 uploads 记录失败:', err);
    return {
      success: false,
      error: '创建上传记录失败: ' + err.message
    };
  }

  try {
    if (Date.now() - startTime > TIMEOUT_MS) {
      await updateUploadStatus(db, uploadId, 'failed', '文件过大，解析超时，请拆分后重新上传');
      return { success: false, error: '解析超时' };
    }

    // ==========================================
    // 第一步：下载文件到临时目录
    // ==========================================
    let fileBuffer;
    try {
      const downloadRes = await cloud.downloadFile({ fileID: fileID });
      fileBuffer = downloadRes.fileContent;

      // 已修复：TC08 - 校验文件内容不为空
      if (!fileBuffer || fileBuffer.length === 0) {
        await updateUploadStatus(db, uploadId, 'failed', '文件内容为空，请检查文件是否损坏');
        return { success: false, error: '文件内容为空，请检查文件是否损坏' };
      }

      // 已修复：TC08 - 校验文件头是否为合法 xlsx 格式（xlsx 文件头为 PK\x03\x04，即 504b0304）
      const header = fileBuffer.slice(0, 4).toString('hex');
      if (header !== '504b0304') {
        await updateUploadStatus(db, uploadId, 'failed', '文件格式不合法，请上传真实的xlsx文件');
        return { success: false, error: '文件格式不合法，请上传真实的xlsx文件' };
      }
    } catch (err) {
      console.error('文件下载失败:', err);
      await updateUploadStatus(db, uploadId, 'failed', `文件下载失败：${err.message}`);
      return { success: false, error: `文件下载失败，请检查文件是否存在：${err.message}` };
    }

    const tmpFilePath = path.join('/tmp', 'upload.xlsx');
    fs.writeFileSync(tmpFilePath, fileBuffer);
    console.log('文件下载成功:', tmpFilePath);

    if (Date.now() - startTime > TIMEOUT_MS) {
      await updateUploadStatus(db, uploadId, 'failed', '文件过大，解析超时，请拆分后重新上传');
      return { success: false, error: '解析超时' };
    }

    // ==========================================
    // 第二步：读取Excel文件为二维数组
    // ==========================================
    const workbook = XLSX.readFile(tmpFilePath, {
      cellDates: true,      // 将日期单元格解析为 Date 对象
      cellNF: false,        // 不保留数字格式
      cellText: false       // 不强制转文本
    });

    // 校验工作表是否存在
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      await updateUploadStatus(db, uploadId, 'failed', 'Excel文件不包含任何工作表');
      return { success: false, error: 'Excel文件不包含任何工作表' };
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // 校验 worksheet 是否存在
    if (!worksheet) {
      await updateUploadStatus(db, uploadId, 'failed', 'Excel工作表读取失败');
      return { success: false, error: 'Excel工作表读取失败' };
    }

    // 转换为二维数组（行索引从0开始）
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      raw: false,           // 不使用原始值，自动格式化
      dateNF: 'yyyy-mm-dd'  // 日期格式
    });
    console.log('Excel读取成功，总行数:', rows.length);

    // 校验数据行是否为空
    if (!rows || rows.length === 0) {
      await updateUploadStatus(db, uploadId, 'failed', 'Excel文件无数据，请检查文件内容');
      return { success: false, error: 'Excel文件无数据' };
    }

    // 进一步校验：至少需要 2 行（1 行模块标题 + 1 行数据）
    if (rows.length < 2) {
      await updateUploadStatus(db, uploadId, 'failed', 'Excel文件数据不足，至少需要包含模块标题和数据行');
      return { success: false, error: 'Excel文件数据不足' };
    }

    if (Date.now() - startTime > TIMEOUT_MS) {
      await updateUploadStatus(db, uploadId, 'failed', '文件过大，解析超时，请拆分后重新上传');
      return { success: false, error: '解析超时' };
    }

    // ==========================================
    // 第三步：动态识别模块边界
    // ==========================================
    const boundaries = findModuleBoundaries(rows);
    console.log('识别到的模块边界：', JSON.stringify(boundaries.map(b => ({
      moduleName: b.moduleName,
      headerRow: b.headerRowIndex + 1,  // +1转为人类可读行号
      dataStart: b.dataStartRowIndex + 1,
      dataEnd: b.dataEndRowIndex + 1
    })), null, 2));

    // 如果没有识别到任何模块，返回详细错误信息
    if (boundaries.length === 0) {
      await updateUploadStatus(db, uploadId, 'failed', 'Excel文件格式不正确：未识别到任何模块标题。请确保A列包含模块关键词（如"高水平大学"、"龙头企业"等）');
      return {
        success: false,
        error: 'Excel文件格式不正确：未识别到任何模块标题。请检查A列是否包含：高水平大学、顶尖研究机构、领衔科学家、主要矿产、龙头企业、市场规模、高水平论文、产业技术规划、科技创新项目、科技成果奖、国家重大项目等关键词'
      };
    }

    // ==========================================
    // 第四步：按模块提取数据
    // ==========================================
    const allRecords = [];

    for (const boundary of boundaries) {
      if (Date.now() - startTime > TIMEOUT_MS) {
        await updateUploadStatus(db, uploadId, 'failed', '文件过大，解析超时，请拆分后重新上传');
        return { success: false, error: '解析超时' };
      }

      try {
        console.log(`开始解析模块: ${boundary.moduleName}`);
        const moduleRecords = extractModuleData(rows, boundary, industryName, timePeriod);
        allRecords.push(...moduleRecords);
        console.log(`模块 ${boundary.moduleName} 解析完成，记录数: ${moduleRecords.length}`);
      } catch (err) {
        console.error(`模块 ${boundary.moduleName} 解析失败:`, err.message);
        // 单模块失败不影响其他模块
      }
    }

    // 检查是否提取到任何数据
    if (allRecords.length === 0) {
      await updateUploadStatus(db, uploadId, 'failed', '请勿提交空白模板！请在模板中填写实际数据后再上传');
      return {
        success: false,
        error: '请勿提交空白模板！\n\n您上传的文件虽然包含了所有模块标题，但所有数据行都是空的。\n\n请在每个模块下至少填写 1 行真实数据，例如：\n• 高水平大学：填写大学名称、研究领域等\n• 龙头企业：填写企业名称、产品种类等\n\n填写完成后再重新上传。'
      };
    }

    // ==========================================
    // 第五步：批量写入数据库
    // 已修复：TC10 - 使用软删除机制，避免删除和写入非原子操作导致数据丢失
    // ==========================================
    console.log('开始写入数据库，总记录数:', allRecords.length);

    // 已修复：successCount 变量作用域问题 - 在 try 块外部定义
    let successCount = 0;
    let failedCount = 0;

    try {
      // 第一步：标记旧数据为过期（软删除），而非直接删除
      await db.collection('industry_data')
        .where({ industryName, timePeriod })
        .update({ data: { _isArchived: true } });
      console.log('已标记旧数据为过期');

      // 第二步：写入新数据
      for (const record of allRecords) {
        if (Date.now() - startTime > TIMEOUT_MS) {
          await updateUploadStatus(db, uploadId, 'failed', '文件过大，解析超时，请拆分后重新上传');
          return { success: false, error: '解析超时' };
        }

        try {
          await db.collection('industry_data').add({ data: record });
          successCount++;
        } catch (err) {
          failedCount++;
          console.error(`写入失败：${record.moduleName}-${record.level}`, err);
        }
      }
      console.log(`新数据写入完成：成功${successCount}条，失败${failedCount}条`);

      // 第三步：确认写入成功后，真正删除旧数据
      if (successCount > 0) {
        await db.collection('industry_data')
          .where({ industryName, timePeriod, _isArchived: true })
          .remove();
        console.log('已删除旧数据');
      } else {
        // 写入失败，恢复旧数据（取消软删除标记）
        await db.collection('industry_data')
          .where({ industryName, timePeriod, _isArchived: true })
          .update({ data: { _isArchived: _.remove() } });
        console.log('写入失败，已恢复旧数据');
        await updateUploadStatus(db, uploadId, 'failed', '数据写入全部失败');
        return { success: false, error: '数据写入全部失败' };
      }

      const finalStatus = successCount > 0 ? 'success' : 'failed';
      if (finalStatus === 'failed') {
        await updateUploadStatus(db, uploadId, 'failed', '数据写入全部失败');
        return { success: false, error: '数据写入全部失败' };
      }
    } catch (err) {
      console.error('数据库操作失败:', err);
      // 发生异常时，尝试恢复旧数据
      try {
        await db.collection('industry_data')
          .where({ industryName, timePeriod, _isArchived: true })
          .update({ data: { _isArchived: _.remove() } });
        console.log('异常恢复：已取消旧数据的删除标记');
      } catch (recoverErr) {
        console.error('恢复旧数据失败:', recoverErr);
      }
      throw err;
    }

    // ==========================================
    // 第六步：确保产业记录存在
    // ==========================================
    const industryRes = await db.collection('industries').where({
      name: industryName
    }).get();

    if (industryRes.data.length === 0) {
      await db.collection('industries').add({
        data: {
          name: industryName,
          createdAt: db.serverDate()
        }
      });
      console.log('新增产业记录:', industryName);
    }

    // ==========================================
    // 第七步：更新上传记录状态为成功
    // ==========================================
    await db.collection('uploads').doc(uploadId).update({
      data: {
        status: 'success',
        recordCount: successCount,
        completedAt: db.serverDate()
      }
    });

    console.log('解析完成，成功记录数:', successCount);

    return {
      success: true,
      message: '解析成功',
      count: successCount
    };

  } catch (err) {
    console.error('解析失败:', err);

    // 更新上传记录状态为失败
    if (uploadId) {
      try {
        await updateUploadStatus(db, uploadId, 'failed', err.message);
      } catch (updateErr) {
        console.error('更新失败状态出错:', updateErr);
      }
    }

    return {
      success: false,
      error: err.message
    };
  }
};

/**
 * 动态扫描模块起始行
 * @param {Array} rows - 整个Sheet的二维数组
 * @returns {Array} 模块边界数组
 */
function findModuleBoundaries(rows) {
  const boundaries = [];

  rows.forEach((row, rowIndex) => {
    const cellA = String(row[0] || '').trim();
    if (!cellA) return;

    // 遍历关键词表，检查A列是否包含该关键词
    MODULE_KEYWORDS.forEach(({ keyword, moduleName }) => {
      if (cellA.includes(keyword)) {
        boundaries.push({
          moduleName,
          headerRowIndex: rowIndex,      // 标题行行号（同时也是表头行）
          dataStartRowIndex: rowIndex + 1 // 数据从下一行开始
        });
      }
    });
  });

  // 按行号排序，确保顺序正确
  boundaries.sort((a, b) => a.headerRowIndex - b.headerRowIndex);

  // 计算每个模块的数据结束行（= 下一个模块的标题行 - 1）
  boundaries.forEach((b, i) => {
    if (i < boundaries.length - 1) {
      b.dataEndRowIndex = boundaries[i + 1].headerRowIndex - 1;
    } else {
      b.dataEndRowIndex = rows.length - 1;  // 最后一个模块到文件末尾
    }
  });

  return boundaries;
}

/**
 * 按动态边界提取每个模块的数据
 * @param {Array} rows - 整个Sheet的二维数组
 * @param {Object} boundary - 模块边界信息
 * @param {string} industryName - 产业名称
 * @param {string} timePeriod - 数据时间
 * @returns {Array} 解析后的记录数组
 */
function extractModuleData(rows, boundary, industryName, timePeriod) {
  const { moduleName, dataStartRowIndex, dataEndRowIndex } = boundary;
  const fieldConfig = MODULE_FIELDS[moduleName];
  if (!fieldConfig) {
    console.warn(`模块 ${moduleName} 没有字段配置，跳过`);
    return [];
  }

  // 为每个层级准备一个items数组
  const levelData = {};

  // 遍历该模块的所有数据行（不再限制行数！）
  for (let i = dataStartRowIndex; i <= dataEndRowIndex; i++) {
    const row = rows[i];
    if (!row) continue;

    // 判断是否为完全空行，是则跳过
    const isEmptyRow = row.every(cell => cell === null || cell === undefined || String(cell).trim() === '');
    if (isEmptyRow) continue;

    let isHeaderRow = false;
    let headerDebugInfo = [];

    Object.entries(fieldConfig).forEach(([level, config]) => {
      const { startCol, fields } = config;
      let matchCount = 0;
      let totalFields = 0;

      fields.forEach((fieldName, idx) => {
        if (fieldName === '_') return;
        totalFields++;
        const cellValue = String(row[startCol + idx] || '').trim();
        // 检查单元格值是否包含字段名（表头行特征）
        if (cellValue && fieldName && cellValue.includes(fieldName)) {
          matchCount++;
          headerDebugInfo.push(`${level}列${startCol + idx}: "${cellValue}" 包含 "${fieldName}"`);
        }
      });

      // 如果超过一半的字段匹配，认为是表头行
      if (totalFields > 0 && matchCount >= totalFields / 2) {
        isHeaderRow = true;
      }
    });

    if (isHeaderRow) {
      continue;
    }

    // 对每个层级（international/national/provincial）提取数据
    Object.entries(fieldConfig).forEach(([level, config]) => {
      const { startCol, fields } = config;
      const item = {};
      let hasValue = false;

      fields.forEach((fieldName, idx) => {
        if (fieldName === '_') return;  // 跳过占位字段
        const rawValue = row[startCol + idx];

        // 跳过 null/undefined
        if (rawValue === null || rawValue === undefined) return;

        // 处理日期对象
        if (rawValue instanceof Date) {
          const year = rawValue.getFullYear();
          const month = String(rawValue.getMonth() + 1).padStart(2, '0');
          const day = String(rawValue.getDate()).padStart(2, '0');
          item[fieldName] = `${year}-${month}-${day}`;
          hasValue = true;
          return;
        }

        // 处理普通值
        const cellValue = String(rawValue).trim();

        // 过滤 Excel 错误值
        if (cellValue.startsWith('#') && ['#REF!', '#VALUE!', '#DIV/0!', '#N/A', '#NAME?', '#NULL!', '#NUM!'].includes(cellValue)) {
          console.warn(`单元格错误值：${cellValue}，行${i+1}，列${startCol+idx+1}`);
          return;
        }

        // 移除不可见字符（换行、制表符、全角空格）
        const cleanValue = cellValue.replace(/[\r\n\t　]/g, '');

        if (cleanValue !== '' && cleanValue.length > 0) {
          item[fieldName] = cleanValue;
          hasValue = true;
        }
      });

      // 只有该行在该层级有实际数据时才记录
      if (hasValue) {
        if (!levelData[level]) {
          levelData[level] = [];
        }
        levelData[level].push(item);
      }
    });
  }

  // 为每个层级创建一条记录
  const records = [];
  Object.entries(levelData).forEach(([level, items]) => {
    if (items.length > 0) {
      records.push({
        industryName: industryName,
        timePeriod: timePeriod,
        moduleName: moduleName,
        level: level,
        items: items,
        createdAt: new Date()
      });
    }
  });

  return records;
}
