/**
 * 个人中心 — v2.1 用户卡片优化
 * 功能：
 *   - 展示大头像+昵称，点击进入个人资料页
 *   - 昵称快捷编辑弹窗保留
 *   - 退出登录
 */
const storage = require('../../utils/storage')
const { exportJSON, importJSON } = require('../../utils/data')
const app = getApp()

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    storageInfo: { size: 0, percent: 0 },

    // 昵称编辑
    showEditNickname: false,
    editNicknameValue: ''
  },

  onShow() {
    this._refreshUserInfo()
  },

  /** 刷新用户信息（每次显示页面时调用） */
  _refreshUserInfo() {
    const { isLoggedIn, userInfo } = app.globalData
    const info = storage.getInfo()
    this.setData({
      isLoggedIn,
      userInfo: userInfo ? { ...userInfo } : null,
      storageInfo: {
        size: info.size,
        percent: info.limit > 0 ? Math.round((info.size / info.limit) * 100) : 0
      }
    })
  },

  // ====================================================
  //  导航
  // ====================================================

  goLogin() {
    wx.navigateTo({
      url: '/pages/login/login?from=mine',
      fail: () => wx.reLaunch({ url: '/pages/login/login?from=mine' })
    })
  },

  goQuadrant() {
    wx.switchTab({ url: '/pages/calendar/calendar' })
  },

  goHabits() {
    wx.navigateTo({ url: '/pages/habit/habit' })
  },

  goNotes() {
    wx.navigateTo({ url: '/pages/note/note' })
  },

  goPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' })
  },

  goAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement' })
  },

  // ====================================================
  //  用户卡片点击
  // ====================================================

  /**
   * 点击用户卡片 — 已登录跳转个人资料页，未登录跳转登录
   */
  onUserCardTap() {
    if (!this.data.isLoggedIn) {
      this.goLogin()
      return
    }
    wx.navigateTo({ url: '/pages/profile/profile' })
  },

  // ====================================================
  //  昵称管理（快捷入口保留）
  // ====================================================

  onEditNicknameInput(e) {
    this.setData({ editNicknameValue: e.detail.value.trim() })
  },

  onConfirmNickname() {
    const newNickName = this.data.editNicknameValue.trim()
    if (!newNickName) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' })
      return
    }
    if (newNickName.length > 20) {
      wx.showToast({ title: '昵称不能超过20个字', icon: 'none' })
      return
    }

    this._updateUserInfo({ nickName: newNickName })
    this.setData({ showEditNickname: false })
    wx.showToast({ title: '昵称已更新', icon: 'success' })
  },

  onCancelNickname() {
    this.setData({ showEditNickname: false, editNicknameValue: '' })
  },

  // ====================================================
  //  更新用户信息（统一方法）
  // ====================================================

  _updateUserInfo(updates) {
    const currentInfo = storage.get('weekly-planner-user', {}) || {}
    const newInfo = { ...currentInfo, ...updates }

    storage.set('weekly-planner-user', newInfo)
    app.globalData.userInfo = newInfo
    this.setData({ userInfo: { ...newInfo } })
  },

  // ====================================================
  //  数据备份与恢复（本地优先，替代虚假"云端同步"）
  // ====================================================

  /** 导出数据备份 —— 复制 JSON 到剪贴板 */
  onSync() {
    wx.showActionSheet({
      itemList: ['导出数据备份', '从剪贴板恢复数据'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this._exportBackup()
        } else {
          this._showRestorePrompt()
        }
      }
    })
  },

  /** 导出：将全量数据复制到剪贴板 */
  _exportBackup() {
    try {
      const json = exportJSON()
      wx.setClipboardData({
        data: json,
        success: () => {
          wx.showModal({
            title: '备份已复制',
            content: '数据已复制到剪贴板，请粘贴到安全的地方保存（如微信收藏或备忘录）。',
            showCancel: false,
            confirmText: '知道了'
          })
        },
        fail: () => {
          wx.showToast({ title: '复制失败，请重试', icon: 'none' })
        }
      })
    } catch (e) {
      wx.showToast({ title: '导出失败', icon: 'none' })
      console.error('[Export] 导出失败', e)
    }
  },

  /** 恢复：提示用户粘贴 */
  _showRestorePrompt() {
    wx.showModal({
      title: '恢复数据',
      content: '请先复制之前备份的 JSON 数据到剪贴板，然后点击"开始恢复"。注意：恢复将覆盖当前数据。',
      confirmText: '开始恢复',
      success: (res) => {
        if (res.confirm) {
          wx.getClipboardData({
            success: (clipRes) => {
              this._importBackup(clipRes.data)
            },
            fail: () => {
              wx.showToast({ title: '无法读取剪贴板，请手动粘贴', icon: 'none' })
            }
          })
        }
      }
    })
  },

  /** 导入数据 */
  _importBackup(jsonStr) {
    const result = importJSON(jsonStr)
    if (result.success) {
      app.refreshData()
      wx.showToast({ title: '数据已恢复', icon: 'success' })
    } else {
      wx.showModal({
        title: '恢复失败',
        content: result.message || '数据格式不正确，请检查后重试。',
        showCancel: false
      })
    }
  },

  // ====================================================
  //  退出登录
  // ====================================================

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后数据将保留在本地，登录后可同步到云端。',
      confirmColor: '#d4756b',
      success: (res) => {
        if (res.confirm) {
          storage.remove('token')
          storage.remove('weekly-planner-user')
          storage.set('login_skipped', true)
          app.globalData.isLoggedIn = false
          app.globalData.userInfo = null
          this.setData({ isLoggedIn: false, userInfo: null })
          wx.showToast({ title: '已退出', icon: 'success' })
        }
      }
    })
  }
})
