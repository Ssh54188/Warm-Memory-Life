/**
 * 个人中心 — v1.0.2
 * 用户信息 + 功能入口 + 设置 + 退出登录
 */
const storage = require('../../utils/storage')
const app = getApp()

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    storageInfo: { size: 0, percent: 0 }
  },

  onShow() {
    const { isLoggedIn, userInfo } = app.globalData
    const info = storage.getInfo()
    this.setData({
      isLoggedIn,
      userInfo,
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
  //  同步（预留）
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
