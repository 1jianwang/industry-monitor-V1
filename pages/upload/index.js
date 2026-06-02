// pages/upload/index.js
// 上传页面 - 权限控制：仅管理员可访问

const request = require('../../utils/request.js');

// 获取应用实例
const app = getApp();

Page({
  data: {
    // 产业分类选择（预设10个材料类别 + 自定义）
    industryCategories: [
      '钢铁材料', '铝材料', '镁材料', '铜材料',
      '半导体材料', '稀土永磁材料', '先进建筑材料',
      '先进高分子材料', '碳纤维及其复合材料', '碳基薄膜电子材料',
      '自定义'
    ],
    selectedCategoryIndex: -1,
    selectedCategory: '',
    customCategory: '',             // 自定义产业分类

    // 季度时间选择
    quarterOptions: [],             // 季度选项数组
    selectedQuarterIndex: -1,
    selectedQuarter: '',
    customQuarter: '',              // 自定义季度

    // 文件相关
    selectedFile: null,             // 已选择的文件对象 {name, path}

    // 上传状态
    uploading: false,               // 是否正在上传
    uploadProgress: 0,              // 上传进度 0-100

    // 上传结果
    uploadResult: null,             // 上传结果 {success, count, error}

    // 权限
    isAdmin: false,                 // 是否为管理员

    // 上传成功后保存的信息（用于查看数据跳转）
    lastUploadIndustry: '',         // 最后上传的产业名称
    lastUploadPeriod: '',           // 最后上传的时间周期

    // 表单验证状态
    canSelectFile: false,           // 是否可以选择文件
    canUpload: false,               // 是否可以上传

    // 模板文件云存储路径（请替换为你上传后的实际路径）
    templateFileID: 'cloud://cloud1-d2gahyqj8acd9ec22.636c-cloud1-d2gahyqj8acd9ec22-1423027928/templates/XX产业领域创新统计监测体系.xlsx'
  },

  /**
   * 页面加载时执行
   * 1. 检查登录状态
   * 2. 检查管理员权限
   * 3. 生成季度选项
   */
  onLoad: function (options) {
    // ==========================================
    // 第一步：检查登录状态
    // ==========================================
    if (!app.globalData.openid) {
      wx.redirectTo({
        url: '/pages/login/index'
      });
      return;
    }

    // ==========================================
    // 第二步：检查管理员权限
    // ==========================================
    const isAdmin = this.checkAdminPermission();
    if (!isAdmin) {
      return; // 无权限，checkAdminPermission 已处理跳转
    }

    // ==========================================
    // 第三步：生成季度选项
    // ==========================================
    this.generateQuarterOptions();
  },

  /**
   * 检查管理员权限
   * 若 role 不是 admin，无权访问，返回首页
   */
  checkAdminPermission: function () {
    const role = app.globalData.role;
    const isAdmin = (role === 'admin');

    this.setData({ isAdmin: isAdmin });

    if (!isAdmin) {
      console.log('无管理员权限，拒绝访问');
      wx.showModal({
        title: '无权限访问',
        content: '仅管理员可使用上传功能',
        showCancel: false,
        success: () => {
          wx.switchTab({
            url: '/pages/home/index'
          });
        }
      });
      return false;
    }

    console.log('管理员权限检查通过');
    return true;
  },

  /**
   * 生成季度选项
   * 包含当前年份和上一年份的所有季度，以及自定义选项
   */
  generateQuarterOptions: function () {
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear];
    const quarters = [
      { label: '第一季度（1月-3月）', value: 'Q1' },
      { label: '第二季度（4月-6月）', value: 'Q2' },
      { label: '第三季度（7月-9月）', value: 'Q3' },
      { label: '第四季度（10月-12月）', value: 'Q4' }
    ];

    const quarterOptions = [];

    // 生成年份+季度组合
    years.forEach(year => {
      quarters.forEach(q => {
        quarterOptions.push({
          label: `${year}年 ${q.label}`,
          value: `${year}${q.value}`  // 如：2026Q1
        });
      });
    });

    // 添加自定义选项
    quarterOptions.push({
      label: '自定义时间',
      value: 'custom'
    });

    this.setData({ quarterOptions });
  },

  /**
   * 产业分类选择
   */
  onCategoryChange: function (e) {
    const index = e.detail.value;
    const category = this.data.industryCategories[index];

    this.setData({
      selectedCategoryIndex: index,
      selectedCategory: category,
      customCategory: category === '自定义' ? this.data.customCategory : ''
    });

    // 更新表单验证状态
    this.updateFormValidation();
  },

  /**
   * 自定义产业分类输入
   */
  onCustomCategoryInput: function (e) {
    this.setData({
      customCategory: e.detail.value
    });

    // 更新表单验证状态
    this.updateFormValidation();
  },

  /**
   * 季度选择
   */
  onQuarterChange: function (e) {
    const index = e.detail.value;
    const quarter = this.data.quarterOptions[index];

    this.setData({
      selectedQuarterIndex: index,
      selectedQuarter: quarter.value,
      customQuarter: quarter.value === 'custom' ? this.data.customQuarter : ''
    });

    // 更新表单验证状态
    this.updateFormValidation();
  },

  /**
   * 自定义季度输入
   */
  onCustomQuarterInput: function (e) {
    this.setData({
      customQuarter: e.detail.value
    });

    // 更新表单验证状态
    this.updateFormValidation();
  },

  /**
   * 获取最终产业名称
   * 如果选择了自定义，返回自定义输入的值，否则返回选中的分类
   */
  getFinalIndustryName: function () {
    const { selectedCategory, customCategory } = this.data;

    if (selectedCategory === '自定义') {
      return customCategory.trim();
    }

    return selectedCategory;
  },

  /**
   * 获取最终时间值
   * 如果选择了自定义，返回自定义输入的值，否则返回选中的季度值
   */
  getFinalTimePeriod: function () {
    const { selectedQuarter, customQuarter } = this.data;

    if (selectedQuarter === 'custom') {
      return customQuarter.trim();
    }

    return selectedQuarter;
  },

  /**
   * 更新表单验证状态
   * 检查产业分类和时间是否已填写，决定是否可以选择文件和上传
   */
  updateFormValidation: function () {
    const industryName = this.getFinalIndustryName();
    const timePeriod = this.getFinalTimePeriod();

    // 产业分类和时间都已填写，才可以选择文件
    const canSelectFile = !!(industryName && timePeriod);

    // 产业分类、时间、文件都已选择，才可以上传
    const canUpload = canSelectFile && !!this.data.selectedFile;

    this.setData({
      canSelectFile: canSelectFile,
      canUpload: canUpload
    });
  },

  /**
   * 页面显示时执行
   */
  onShow: function () {
    // 每次显示时都检查权限
    if (!app.globalData.openid) {
      wx.redirectTo({
        url: '/pages/login/index'
      });
      return;
    }

    // 重新验证角色，防止管理员降权后仍可访问
    this.verifyAdminRole();
  },

  /**
   * 验证管理员角色（从云端获取最新角色）
   */
  verifyAdminRole: function () {
    request.callCloud('getUserRole', {})
      .then(res => {
        if (res && res.success && res.data) {
          const newRole = res.data.role;
          const app = getApp();

          // 更新全局角色
          app.globalData.role = newRole;
          wx.setStorageSync('role', newRole);

          // 若角色已变更为非管理员，立即跳出当前页
          if (newRole !== 'admin') {
            wx.showToast({
              title: '权限已变更，无法访问',
              icon: 'none',
              duration: 2000
            });
            setTimeout(() => {
              wx.switchTab({ url: '/pages/home/index' });
            }, 2000);
          }
        }
      })
      .catch(err => {
        console.log('角色验证失败，使用缓存角色:', err);
        // 验证失败时，仍检查缓存角色
        if (app.globalData.role !== 'admin') {
          wx.showToast({
            title: '无上传权限，仅管理员可用',
            icon: 'none'
          });
        }
      });
  },

  /**
   * 下载 Excel 模板文件
   */
  downloadTemplate: function () {
    wx.showLoading({
      title: '准备下载...',
      mask: true
    });

    // 方式一：如果模板文件已上传到云存储
    const templateFileID = this.data.templateFileID;

    // 检查是否配置了模板文件路径
    if (!templateFileID || templateFileID.includes('your-env-id')) {
      wx.hideLoading();
      wx.showModal({
        title: '模板未配置',
        content: '请先将模板文件上传到云存储，并在代码中配置 templateFileID。\n\n上传步骤：\n1. 打开微信开发者工具\n2. 云开发 → 存储\n3. 创建 templates 文件夹\n4. 上传模板文件\n5. 复制文件 ID 到代码中',
        showCancel: false,
        confirmText: '我知道了'
      });
      return;
    }

    // 从云存储下载模板文件
    wx.cloud.downloadFile({
      fileID: templateFileID,
      success: (res) => {
        wx.hideLoading();

        if (res.statusCode === 200) {
          const tempFilePath = res.tempFilePath;

          // 打开文件预览
          wx.openDocument({
            filePath: tempFilePath,
            fileType: 'xlsx',
            showMenu: true, // 显示右上角菜单，用户可以转发或保存到本地
            success: () => {
              wx.showToast({
                title: '模板已打开',
                icon: 'success',
                duration: 2000
              });
            },
            fail: (err) => {
              console.error('打开文件失败:', err);
              wx.showModal({
                title: '打开失败',
                content: '无法打开模板文件，请确保已安装 WPS 或其他 Office 应用',
                showCancel: false
              });
            }
          });
        } else {
          wx.showToast({
            title: '下载失败，请重试',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('下载模板失败:', err);
        wx.showModal({
          title: '下载失败',
          content: '模板文件下载失败，请检查网络连接或联系管理员',
          showCancel: false
        });
      }
    });
  },

  /**
   * 选择文件按钮点击事件
   * 使用 wx.chooseMessageFile 选择微信聊天中的文件（Excel）
   */
  chooseFile: function () {
    // 检查权限
    if (!this.data.isAdmin) {
      wx.showToast({
        title: '无上传权限',
        icon: 'none'
      });
      return;
    }

    // 检查是否已填写产业分类和时间
    if (!this.data.canSelectFile) {
      wx.showToast({
        title: '请先选择产业分类和数据时间',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    wx.chooseMessageFile({
      count: 1,          // 最多选择 1 个文件
      type: 'file',      // 选择文件类型
      extension: ['xlsx'], // 限制文件扩展名
      success: (res) => {
        const file = res.tempFiles[0];
        const fileName = file.name;

        // 严格校验文件扩展名（不区分大小写）
        if (!fileName.toLowerCase().endsWith('.xlsx')) {
          wx.showToast({
            title: '仅支持 .xlsx 格式（Excel 2007+）',
            icon: 'none',
            duration: 3000
          });
          return;
        }

        // 校验文件大小（限制 10MB）
        if (file.size > 10 * 1024 * 1024) {
          wx.showToast({
            title: '文件过大，请上传小于 10MB 的文件',
            icon: 'none',
            duration: 3000
          });
          return;
        }

        // 校验文件大小不为 0
        if (file.size === 0) {
          wx.showToast({
            title: '文件为空，请检查文件是否损坏',
            icon: 'none',
            duration: 3000
          });
          return;
        }

        console.log('选择的文件：', fileName, '大小：', (file.size / 1024).toFixed(2) + 'KB');
        this.setData({
          selectedFile: {
            name: fileName,
            path: file.path,
            size: file.size
          }
        });

        // 更新表单验证状态
        this.updateFormValidation();
      },
      fail: (err) => {
        console.error('选择文件失败', err);
        wx.showToast({
          title: '请选择 Excel 文件',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 净化函数：移除云存储路径不支持的特殊字符
   */
  sanitizeForPath: function (str) {
    return String(str)
      .replace(/[\/\\:*?"<>|&=]/g, '_')  // 替换特殊字符为下划线
      .replace(/\s+/g, '_')               // 空格替换为下划线
      .trim();
  },

  /**
   * 上传文件按钮点击事件
   * 流程：
   * 1. 校验表单
   * 2. 上传文件到云存储
   * 3. 写入 uploads 集合（status: pending）
   * 4. 调用 parseExcel 云函数
   * 5. 更新页面状态
   */
  /**
   * 上传文件按钮点击事件
   * 流程：
   * 1. 校验表单
   * 2. 上传文件到云存储
   * 3. 写入 uploads 集合（status: pending）
   * 4. 调用 parseExcel 云函数
   * 5. 更新页面状态
   */
  uploadFile: function () {
    // ==========================================
    // 第一步：校验表单
    // ==========================================
    // 检查产业分类
    const industryName = this.getFinalIndustryName();
    if (!industryName) {
      wx.showToast({
        title: this.data.selectedCategory === '自定义' ? '请输入自定义产业分类' : '请选择产业分类',
        icon: 'none'
      });
      return;
    }

    // 检查季度时间
    const timePeriod = this.getFinalTimePeriod();
    if (!timePeriod) {
      wx.showToast({
        title: this.data.selectedQuarter === 'custom' ? '请输入自定义时间' : '请选择季度时间',
        icon: 'none'
      });
      return;
    }

    // 检查是否选择了文件
    if (!this.data.selectedFile) {
      wx.showToast({
        title: '请先选择文件',
        icon: 'none'
      });
      return;
    }

    // 检查管理员权限
    if (!this.data.isAdmin) {
      wx.showToast({
        title: '无上传权限',
        icon: 'none'
      });
      return;
    }

    const file = this.data.selectedFile;

    // 重置上传结果
    this.setData({
      uploading: true,
      uploadProgress: 0,
      uploadResult: null
    });

    // ==========================================
    // 第二步：上传文件到云存储
    // ==========================================
    // 使用净化后的名称构建云存储路径
    const safeName = this.sanitizeForPath(industryName);
    const safePeriod = this.sanitizeForPath(timePeriod);
    let safeFileName = file.name.replace(/[\/\\:*?"<>|]/g, '_');

    // 限制文件名长度（保留扩展名）
    const maxFileNameLength = 100;
    if (safeFileName.length > maxFileNameLength) {
      const ext = safeFileName.substring(safeFileName.lastIndexOf('.'));
      const nameWithoutExt = safeFileName.substring(0, safeFileName.lastIndexOf('.'));
      safeFileName = nameWithoutExt.substring(0, maxFileNameLength - ext.length) + ext;
      console.log('文件名过长，已截断为：', safeFileName);
    }

    const cloudPath = `uploads/${safeName}/${safePeriod}/${Date.now()}_${safeFileName}`;

    // 校验最终路径长度
    if (cloudPath.length > 1000) {
      wx.showToast({
        title: '文件路径过长，请简化产业名称或时间',
        icon: 'none',
        duration: 3000
      });
      this.setData({ uploading: false });
      return;
    }

    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: file.path,
      success: (uploadRes) => {
        console.log('文件上传成功，fileID：', uploadRes.fileID);
        this.setData({ uploadProgress: 50 });

        // ==========================================
        // 直接调用 parseExcel 云函数（云函数内部会创建 uploads 记录）
        // ==========================================
        request.callCloud('parseExcel', {
          fileID: uploadRes.fileID,
          industryName: industryName,
          timePeriod: timePeriod,
          fileName: file.name
        })
          .then((parseRes) => {
            this.setData({
              uploading: false,
              uploadProgress: 100
            });
            console.log('Excel 解析结果：', parseRes);

            if (parseRes.success) {
              // 解析成功，保存产业名称和时间周期用于跳转
              this.setData({
                uploadResult: {
                  success: true,
                  count: parseRes.count
                },
                lastUploadIndustry: industryName,
                lastUploadPeriod: timePeriod
              });

              wx.showToast({
                title: '上传并解析成功',
                icon: 'success',
                duration: 2000
              });

              // 清空表单
              this.setData({
                selectedFile: null,
                selectedCategoryIndex: -1,
                selectedCategory: '',
                customCategory: '',
                selectedQuarterIndex: -1,
                selectedQuarter: '',
                customQuarter: ''
              });

              // 更新表单验证状态
              this.updateFormValidation();
            } else {
              // 解析失败 - 显示详细错误信息
              const errorMsg = parseRes.error || '解析失败';

              this.setData({
                uploadResult: {
                  success: false,
                  error: errorMsg
                }
              });

              // 使用 Modal 显示详细错误，方便用户查看
              wx.showModal({
                title: '上传失败',
                content: errorMsg,
                showCancel: false,
                confirmText: '我知道了'
              });
            }
          })
          .catch((err) => {
            this.setData({ uploading: false });
            console.error('解析 Excel 失败', err);

            this.setData({
              uploadResult: {
                success: false,
                error: err.errMsg || '解析失败，请检查文件格式'
              }
            });

            wx.showToast({
              title: '解析失败，请检查文件格式',
              icon: 'none'
            });
          });
      },
      fail: (err) => {
        this.setData({ uploading: false });
        console.error('文件上传失败', err);
        wx.showToast({
          title: '上传失败，请重试',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 查看数据按钮点击事件
   * 跳转到产业详情页，并传递时间参数
   */
  viewData: function () {
    const industryName = this.data.lastUploadIndustry;
    const timePeriod = this.data.lastUploadPeriod;

    if (industryName && timePeriod) {
      wx.navigateTo({
        url: '/pages/industry/detail?name=' + encodeURIComponent(industryName) + '&period=' + encodeURIComponent(timePeriod)
      });
    } else {
      wx.showToast({
        title: '无法获取产业信息',
        icon: 'none'
      });
    }
  }
});