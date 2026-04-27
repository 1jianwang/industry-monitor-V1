// pages/admin/index.js
// 数据管理页面 - 权限控制：仅管理员可访问

const app = getApp()

Page({
  data: {
    currentTab: 0,           // 当前选中的Tab：0-文件管理 1-用户管理
    searchKeyword: '',       // 搜索关键词
    uploadList: [],          // 上传记录列表
    filteredUploadList: [], // 过滤后的上传记录列表
    userList: [],            // 用户列表
    loading: false,          // 加载状态
    isAdmin: false,          // 是否为管理员

    // 批量删除相关
    batchMode: false,        // 是否处于批量删除模式
    selectedIds: [],         // 已选中的上传记录ID数组
    isAllSelected: false     // 是否全选
  },

  /**
   * 页面加载时执行
   * 1. 检查登录状态
   * 2. 检查管理员权限
   * 3. 加载数据
   * 已修复：TC11 - 自动清理僵尸记录
   */
  onLoad: function (options) {
    // 检查登录状态
    if (!app.globalData.openid) {
      wx.redirectTo({
        url: '/pages/login/index'
      })
      return
    }

    // 检查管理员权限
    const isAdmin = this.checkAdminPermission()
    if (!isAdmin) {
      return // 无权限，checkAdminPermission 已处理跳转
    }

    // 已修复：TC11 - 自动清理僵尸记录
    this.cleanPendingUploads()

    // 加载数据
    this.loadUploadList()
    this.loadUserList()
  },

  /**
   * 已修复：TC11 - 清理僵尸上传记录
   */
  cleanPendingUploads: function() {
    wx.cloud.callFunction({
      name: 'cleanPendingUploads'
    }).then(res => {
      if (res.result && res.result.success && res.result.cleaned > 0) {
        console.log(`已清理 ${res.result.cleaned} 条僵尸记录`)
      }
    }).catch(err => {
      console.log('清理僵尸记录失败（不影响正常使用）:', err)
    })
  },

  /**
   * 检查管理员权限
   */
  checkAdminPermission: function () {
    const role = app.globalData.role
    const isAdmin = (role === 'admin')

    this.setData({ isAdmin: isAdmin })

    if (!isAdmin) {
      console.log('无管理员权限，拒绝访问')
      wx.showModal({
        title: '无权限访问',
        content: '仅管理员可使用数据管理功能',
        showCancel: false,
        success: () => {
          wx.switchTab({
            url: '/pages/home/index'
          })
        }
      })
      return false
    }

    console.log('管理员权限检查通过')
    return true
  },

  /**
   * 切换Tab
   */
  switchTab: function (e) {
    const index = parseInt(e.currentTarget.dataset.index)

    // 如果点击用户管理Tab，显示待开发提示
    if (index === 1) {
      wx.showToast({
        title: '该功能待开发',
        icon: 'none',
        duration: 2000
      })
      return
    }

    // 切换Tab时退出批量删除模式
    this.setData({
      currentTab: index,
      batchMode: false,
      selectedIds: [],
      isAllSelected: false
    })
  },

  /**
   * 搜索框输入
   */
  onSearchInput: function (e) {
    const keyword = e.detail.value
    this.setData({ searchKeyword: keyword })
    this.filterUploadList(keyword)
  },

  /**
   * 过滤上传记录列表
   */
  filterUploadList: function (keyword) {
    if (!keyword) {
      this.setData({
        filteredUploadList: this.data.uploadList
      })
      return
    }

    const filtered = this.data.uploadList.filter(item => {
      return item.industryName.includes(keyword)
    })

    this.setData({
      filteredUploadList: filtered
    })
  },

  /**
   * 加载上传记录列表
   */
  loadUploadList: function () {
    this.setData({ loading: true })

    // 调用云函数获取上传记录
    wx.cloud.callFunction({
      name: 'getUploads'
    }).then(res => {
      console.log('加载上传记录成功，数据量：', res.result.data && res.result.data.length ? res.result.data.length : 0);
      console.log('上传记录详情：', res.result.data)

      if (res.result.success) {
        // 过滤掉格式不正确的记录
        const validUploads = (res.result.data || []).filter(item => {
          // 检查 timePeriod 格式是否正确（应为 2025Q1 格式）
          const periodMatch = item.timePeriod && item.timePeriod.match(/^\d{4}Q[1-4]$/)
          if (!periodMatch) {
            console.log('过滤掉格式不正确的记录：', item.industryName, item.timePeriod)
            return false
          }
          return true
        })

        console.log('过滤后的有效记录数量：', validUploads.length)

        this.setData({
          uploadList: validUploads,
          filteredUploadList: validUploads,
          loading: false
        })
      } else {
        throw new Error(res.result.error)
      }
    }).catch(err => {
      console.error('加载上传记录失败', err)
      this.setData({ loading: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    })
  },

  /**
   * 加载用户列表
   */
  loadUserList: function () {
    // 调用云函数获取用户列表
    wx.cloud.callFunction({
      name: 'getUsers'
    }).then(res => {
      console.log('加载用户列表成功，数据量：', res.result.data && res.result.data.length ? res.result.data.length : 0);

      if (res.result.success) {
        this.setData({
          userList: res.result.data || []
        })
      } else {
        throw new Error(res.result.error)
      }
    }).catch(err => {
      console.error('加载用户列表失败', err)
      wx.showToast({
        title: '加载用户列表失败',
        icon: 'none'
      })
    })
  },

  /**
   * 进入/退出批量删除模式
   */
  toggleBatchMode: function () {
    const newBatchMode = !this.data.batchMode
    this.setData({
      batchMode: newBatchMode,
      selectedIds: [],
      isAllSelected: false
    })
  },

  /**
   * 全选/取消全选
   */
  toggleSelectAll: function () {
    const isAllSelected = !this.data.isAllSelected
    let selectedIds = []

    if (isAllSelected) {
      // 全选：只选择状态为 success 的记录
      selectedIds = this.data.filteredUploadList
        .filter(item => item.status === 'success')
        .map(item => item._id)
    }

    this.setData({
      isAllSelected: isAllSelected,
      selectedIds: selectedIds
    })
  },

  /**
   * 切换单个记录的选中状态
   */
  toggleSelectItem: function (e) {
    const id = e.currentTarget.dataset.id
    console.log('点击项目ID:', id)
    console.log('当前选中列表:', this.data.selectedIds)

    const selectedIds = [...this.data.selectedIds]
    const index = selectedIds.indexOf(id)
    console.log('索引位置:', index)

    if (index > -1) {
      // 已选中，取消选中
      selectedIds.splice(index, 1)
      console.log('取消选中，新列表:', selectedIds)
    } else {
      // 未选中，添加选中
      selectedIds.push(id)
      console.log('添加选中，新列表:', selectedIds)
    }

    // 检查是否全选
    const successCount = this.data.filteredUploadList.filter(item => item.status === 'success').length
    const isAllSelected = selectedIds.length === successCount && successCount > 0

    this.setData({
      selectedIds: selectedIds,
      isAllSelected: isAllSelected
    }, () => {
      console.log('setData完成，当前selectedIds:', this.data.selectedIds)
    })
  },

  /**
   * 批量删除
   */
  batchDelete: function () {
    const selectedIds = this.data.selectedIds
    if (selectedIds.length === 0) {
      wx.showToast({
        title: '请先选择要删除的记录',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '确认批量删除',
      content: `将删除 ${selectedIds.length} 条记录及其关联数据，不可恢复`,
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })

          // 调用云函数批量删除
          wx.cloud.callFunction({
            name: 'batchDeleteUploads',
            data: {
              uploadIds: selectedIds
            }
          }).then(result => {
            wx.hideLoading()
            console.log('批量删除结果:', result)

            if (result.result.success) {
              wx.showToast({
                title: `成功删除 ${result.result.deletedCount} 条记录`,
                icon: 'success'
              })

              // 从列表中移除已删除的记录
              const newList = this.data.uploadList.filter(item => !selectedIds.includes(item._id))
              this.setData({
                uploadList: newList,
                selectedIds: [],
                isAllSelected: false,
                batchMode: false
              })
              this.filterUploadList(this.data.searchKeyword)
            } else {
              wx.showToast({
                title: result.result.error || '删除失败',
                icon: 'none'
              })
            }
          }).catch(err => {
            wx.hideLoading()
            console.error('批量删除失败', err)
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            })
          })
        }
      }
    })
  },

  /**
   * 删除单条上传记录
   */
  deleteUpload: function (e) {
    const { id, industryName, timePeriod } = e.currentTarget.dataset

    wx.showModal({
      title: '确认删除',
      content: `将删除「${industryName}」${timePeriod}的所有数据，不可恢复`,
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })

          // 调用云函数删除
          wx.cloud.callFunction({
            name: 'deleteUpload',
            data: {
              uploadId: id,
              industryName: industryName,
              timePeriod: timePeriod
            }
          }).then(result => {
            wx.hideLoading()
            console.log('删除结果:', result)

            if (result.result.success) {
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              })
              // 从列表中移除该条记录
              const newList = this.data.uploadList.filter(item => item._id !== id)
              this.setData({
                uploadList: newList
              })
              this.filterUploadList(this.data.searchKeyword)
            } else {
              wx.showToast({
                title: result.result.error || '删除失败',
                icon: 'none'
              })
            }
          }).catch(err => {
            wx.hideLoading()
            console.error('删除失败', err)
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            })
          })
        }
      }
    })
  },

  /**
   * 切换用户角色
   */
  toggleUserRole: function (e) {
    // 显示功能待开发提示
    wx.showToast({
      title: '该功能待开发',
      icon: 'none',
      duration: 2000
    })
    return

    const { id, role, openid } = e.currentTarget.dataset
    const newRole = role === 'admin' ? 'viewer' : 'admin'
    const roleText = newRole === 'admin' ? '管理员' : '查阅者'

    wx.showModal({
      title: '确认切换角色',
      content: `将用户「${this.maskOpenid(openid)}」的角色切换为「${roleText}」`,
      confirmColor: '#1A56A0',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '切换中...' })

          // 调用云函数更新角色
          wx.cloud.callFunction({
            name: 'updateUserRole',
            data: {
              userId: id,
              newRole: newRole
            }
          }).then(result => {
            wx.hideLoading()

            if (result.result.success) {
              wx.showToast({
                title: '切换成功',
                icon: 'success'
              })
              // 刷新用户列表
              this.loadUserList()
            } else {
              throw new Error(result.result.error)
            }
          }).catch(err => {
            wx.hideLoading()
            console.error('切换角色失败', err)
            wx.showToast({
              title: '切换失败',
              icon: 'none'
            })
          })
        }
      }
    })
  },

  /**
   * 手动清理历史遗留数据
   */
  cleanLegacyData: function () {
    wx.showModal({
      title: '确认清理',
      content: '将清理格式不正确和长期处于解析中的记录，是否继续？',
      confirmColor: '#1A56A0',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '清理中...' })

          wx.cloud.callFunction({
            name: 'cleanLegacyData'
          }).then(result => {
            wx.hideLoading()
            console.log('清理结果:', result)

            if (result.result.success) {
              wx.showModal({
                title: '清理完成',
                content: `成功清理 ${result.result.cleanedCount} 条记录`,
                showCancel: false,
                success: () => {
                  // 刷新列表
                  this.loadUploadList()
                }
              })
            } else {
              wx.showToast({
                title: result.result.error || '清理失败',
                icon: 'none'
              })
            }
          }).catch(err => {
            wx.hideLoading()
            console.error('清理失败', err)
            wx.showToast({
              title: '清理失败',
              icon: 'none'
            })
          })
        }
      }
    })
  },

  /**
   * 格式化时间
   */
  formatTime: function (timestamp) {
    if (!timestamp) return '暂无'

    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')

    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  /**
   * 格式化季度显示
   * 将 2025Q1 格式转为 "2025年第一季度(1月-3月)"
   */
  formatPeriod: function (period) {
    if (!period) return period

    // 匹配标准季度格式：2025Q1
    const match = period.match(/^(\d{4})Q([1-4])$/)
    if (!match) return period // 非标准格式直接显示原文

    const year = match[1]
    const quarter = match[2]
    const quarterMap = {
      '1': { name: '第一季度', months: '1月-3月' },
      '2': { name: '第二季度', months: '4月-6月' },
      '3': { name: '第三季度', months: '7月-9月' },
      '4': { name: '第四季度', months: '10月-12月' }
    }

    const info = quarterMap[quarter]
    return `${year}年${info.name}(${info.months})`
  },

  /**
   * 脱敏显示openid
   */
  maskOpenid: function (openid) {
    if (!openid || openid.length < 8) return openid
    return openid.substring(0, 4) + '...' + openid.substring(openid.length - 4)
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function () {
    if (this.data.isAdmin) {
      this.loadUploadList()
      this.loadUserList()
    }
    wx.stopPullDownRefresh()
  }
})
