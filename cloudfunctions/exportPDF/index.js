// cloudfunctions/exportPDF/index.js
// 导出产业数据PDF报告云函数

const cloud = require('wx-server-sdk')
const pdfMake = require('pdfmake')
const path = require('path')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * 净化函数：移除云存储路径不支持的特殊字符
 */
function sanitizeForPath(str) {
  return String(str)
    .replace(/[\/\\:*?"<>|&=]/g, '_')  // 替换特殊字符为下划线
    .replace(/\s+/g, '_')               // 空格替换为下划线
    .trim();
}

/**
 * 清理旧PDF文件，避免无限积累
 */
async function cleanOldPDF(db, cloud, industryName, timePeriod) {
  try {
    console.log('[清理旧PDF] 开始查询旧PDF记录');
    const oldFiles = await db.collection('pdf_records')
      .where({ industryName, timePeriod })
      .get();

    if (oldFiles.data.length > 0) {
      console.log(`[清理旧PDF] 发现 ${oldFiles.data.length} 个旧PDF文件`);
      const fileIDs = oldFiles.data.map(f => f.fileID).filter(Boolean);

      if (fileIDs.length > 0) {
        await cloud.deleteFile({ fileList: fileIDs });
        console.log('[清理旧PDF] 云存储文件删除成功');
      }

      await db.collection('pdf_records')
        .where({ industryName, timePeriod })
        .remove();
      console.log('[清理旧PDF] 数据库记录删除成功');
    } else {
      console.log('[清理旧PDF] 无旧PDF需要清理');
    }
  } catch (e) {
    console.warn('[清理旧PDF] 清理失败（不影响新PDF生成）：', e);
  }
}

exports.main = async (event, context) => {
  const startTime = Date.now()
  console.log('[PDF导出] 开始执行')

  const { OPENID } = cloud.getWXContext()
  const db = cloud.database()
  const { industryName, timePeriod } = event

  try {
    // ==========================================
    // 第一步：并行执行权限校验和数据查询（优化性能）
    // ==========================================
    console.log('[PDF导出] 步骤1: 并行查询用户、数据和清理旧PDF')
    const [userRes, dataRes] = await Promise.all([
      db.collection('users').where({ openid: OPENID }).limit(1).get(),
      db.collection('industry_data').where({ industryName, timePeriod }).limit(100).get(),
      cleanOldPDF(db, cloud, industryName, timePeriod)
    ])

    console.log(`[PDF导出] 查询完成, 耗时=${Date.now() - startTime}ms`)

    if (!userRes.data || userRes.data.length === 0) {
      return { success: false, error: '请先登录' }
    }

    if (!dataRes.data || dataRes.data.length === 0) {
      return { success: false, error: '该季度暂无数据' }
    }

    // ==========================================
    // 第二步：将数据按模块分组（优化）
    // ==========================================
    const moduleMap = {}
    dataRes.data.forEach(record => {
      const moduleName = record.moduleName
      if (!moduleMap[moduleName]) {
        moduleMap[moduleName] = {}
      }
      moduleMap[moduleName][record.level] = record.items || []
    })

    console.log(`[PDF导出] 模块分组完成, 耗时=${Date.now() - startTime}ms`)

    // ==========================================
    // 第三步：构建 PDF 文档定义（简化格式化）
    // ==========================================
    const formatPeriod = (p) => {
      const match = String(p).match(/^(\d{4})Q([1-4])$/)
      if (!match) return p
      return `${match[1]}年第${['一','二','三','四'][match[2]-1]}季度`
    }

    // 定义模块顺序
    const MODULE_ORDER = [
      '高水平大学', '顶尖研究机构', '领衔科学家',
      '主要矿产分布', '龙头企业', '市场规模',
      '高水平论文', '产业技术规划',
      '科技创新项目', '科技成果奖', '国家重大项目'
    ]

    // 定义层级标签
    const LEVEL_LABELS = {
      international: '国际前沿',
      national: '国内现状',
      provincial: '省级现状'
    }

    // 构建PDF内容数组
    const content = []

    // 封面标题
    content.push({
      text: `${industryName}产业创新统计监测报告`,
      style: 'title',
      alignment: 'center',
      margin: [0, 40, 0, 10]
    })

    content.push({
      text: formatPeriod(timePeriod),
      style: 'subtitle',
      alignment: 'center',
      margin: [0, 0, 0, 10]
    })

    content.push({
      text: `生成时间：${new Date().toLocaleDateString('zh-CN')}`,
      style: 'meta',
      alignment: 'center',
      margin: [0, 0, 0, 40]
    })

    // 分割线
    content.push({
      canvas: [{
        type: 'line',
        x1: 0,
        y1: 0,
        x2: 515,
        y2: 0,
        lineWidth: 1,
        lineColor: '#1A56A0'
      }]
    })

    content.push({ text: '', margin: [0, 0, 0, 20] })

    // ==========================================
    // 逐模块生成内容（优化：限制数据量）
    // ==========================================
    MODULE_ORDER.forEach(moduleName => {
      const moduleData = moduleMap[moduleName]
      if (!moduleData) return

      // 模块标题
      content.push({
        text: moduleName,
        style: 'moduleTitle',
        margin: [0, 20, 0, 10]
      })

      // 逐层级生成表格
      Object.entries(LEVEL_LABELS).forEach(([level, label]) => {
        const items = moduleData[level]
        if (!items || items.length === 0) return

        // 层级标题
        content.push({
          text: label,
          style: 'levelTitle',
          margin: [0, 8, 0, 4]
        })

        // 取第一条数据的所有key作为表头
        const headers = Object.keys(items[0]).filter(k => !k.startsWith('_'))
        if (headers.length === 0) return

        // 限制每个层级最多显示50条数据，避免PDF过大
        const limitedItems = items.slice(0, 50)

        // 构建表格数据
        const tableBody = []

        // 表头行（深蓝色背景）
        tableBody.push(headers.map(h => ({
          text: h,
          style: 'tableHeader',
          fillColor: '#1A56A0',
          color: '#ffffff'
        })))

        // 数据行（交替浅色背景）
        limitedItems.forEach((item, idx) => {
          tableBody.push(headers.map(h => ({
            text: (item[h] === null || item[h] === undefined) ? '' : String(item[h]),
            style: 'tableCell',
            fillColor: idx % 2 === 0 ? '#F3F4F6' : '#FFFFFF'
          })))
        })

        // 添加表格
        content.push({
          table: {
            headerRows: 1,
            widths: Array(headers.length).fill('*'),
            body: tableBody
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#DDDDDD',
            vLineColor: () => '#DDDDDD'
          },
          margin: [0, 0, 0, 12]
        })

        // 如果数据被截断，添加提示
        if (items.length > 50) {
          content.push({
            text: `（仅显示前50条，共${items.length}条数据）`,
            style: 'meta',
            margin: [0, -8, 0, 8]
          })
        }
      })
    })

    console.log(`[PDF导出] 内容构建完成, 耗时=${Date.now() - startTime}ms`)

    // 页脚声明
    content.push({ text: '', margin: [0, 20, 0, 0] })
    content.push({
      canvas: [{
        type: 'line',
        x1: 0,
        y1: 0,
        x2: 515,
        y2: 0,
        lineWidth: 0.5,
        lineColor: '#CCCCCC'
      }]
    })
    content.push({
      text: '本报告由产业创新统计监测系统自动生成，仅供内部参考',
      style: 'footer',
      alignment: 'center',
      margin: [0, 8, 0, 0]
    })

    // ==========================================
    // 第六步：定义PDF样式
    // ==========================================
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
      defaultStyle: {
        font: 'NotoSansSC'
      },
      content,
      styles: {
        title: {
          fontSize: 20,
          bold: true,
          color: '#1A56A0'
        },
        subtitle: {
          fontSize: 14,
          color: '#2E75B6'
        },
        meta: {
          fontSize: 10,
          color: '#999999'
        },
        moduleTitle: {
          fontSize: 13,
          bold: true,
          color: '#1A56A0',
          background: '#E6F1FB',
          margin: [4, 0, 4, 0]
        },
        levelTitle: {
          fontSize: 11,
          bold: true,
          color: '#2E75B6'
        },
        tableHeader: {
          fontSize: 9,
          bold: true
        },
        tableCell: {
          fontSize: 9,
          color: '#333333'
        },
        footer: {
          fontSize: 9,
          color: '#999999'
        }
      },
      // 页码设置
      footer: (currentPage, pageCount) => ({
        text: `${currentPage} / ${pageCount}`,
        alignment: 'center',
        fontSize: 9,
        color: '#999999',
        margin: [0, 10, 0, 0]
      })
    }

    // ==========================================
    // 第四步：生成PDF Buffer（优化）
    // ==========================================
    const fonts = {
      NotoSansSC: {
        normal: path.join(__dirname, 'fonts/NotoSansSC-Regular.ttf'),
        bold: path.join(__dirname, 'fonts/NotoSansSC-Medium.ttf'),
        italics: path.join(__dirname, 'fonts/NotoSansSC-Regular.ttf'),
        bolditalics: path.join(__dirname, 'fonts/NotoSansSC-Medium.ttf')
      }
    }

    const printer = new pdfMake(fonts)
    const pdfDoc = printer.createPdfKitDocument(docDefinition)

    const chunks = []
    pdfDoc.on('data', chunk => chunks.push(chunk))

    const pdfBuffer = await new Promise((resolve, reject) => {
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
      pdfDoc.on('error', reject)
      pdfDoc.end()
    })

    console.log(`[PDF导出] PDF生成完成, 大小=${pdfBuffer.length}字节, 耗时=${Date.now() - startTime}ms`)

    // ==========================================
    // 第五步：并行上传和获取临时链接
    // ==========================================
    const timestamp = Date.now()
    // 使用净化后的名称构建云存储路径
    const safeName = sanitizeForPath(industryName)
    const safePeriod = sanitizeForPath(timePeriod)
    const fileName = `reports/${safeName}_${safePeriod}_${timestamp}.pdf`

    const uploadRes = await cloud.uploadFile({
      cloudPath: fileName,
      fileContent: pdfBuffer
    })

    const tempUrlRes = await cloud.getTempFileURL({
      fileList: [uploadRes.fileID]
    })

    const downloadURL = tempUrlRes.fileList[0].tempFileURL

    console.log(`[PDF导出] 完成, 总耗时=${Date.now() - startTime}ms`)

    // 记录PDF文件信息到数据库
    try {
      await db.collection('pdf_records').add({
        data: {
          industryName,
          timePeriod,
          fileID: uploadRes.fileID,
          createdAt: db.serverDate(),
          createdBy: OPENID
        }
      });
      console.log('[PDF导出] PDF记录已保存到数据库');
    } catch (err) {
      console.warn('[PDF导出] 保存PDF记录失败（不影响导出）:', err);
    }

    // 返回给用户的文件名仍使用原始名称（只有路径需要净化）
    return {
      success: true,
      downloadURL,
      fileID: uploadRes.fileID,
      fileName: `${industryName}${formatPeriod(timePeriod)}创新报告.pdf`
    }

  } catch (err) {
    console.error('PDF生成失败：', err)
    return {
      success: false,
      error: `PDF生成失败：${err.message}`
    }
  }
}
