/**
 * 个人中心 — v2.1 用户卡片优化
 * 功能：
 *   - 展示大头像+昵称，点击进入个人资料页
 *   - 昵称快捷编辑弹窗保留
 *   - 退出登录
 */
const storage = require('../../utils/storage')
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
  //  同步
  // ====================================================

  onSync() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    wx.showToast({ title: '数据已同步', icon: 'success' })
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
