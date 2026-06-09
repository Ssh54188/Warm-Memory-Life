/**
 * 个人资料页
 * 功能：展示/编辑头像、昵称、手机号等资料，退出登录、账号注销
 */
const storage = require('../../utils/storage')
const app = getApp()

Page({
  data: {
    userInfo: {},
    userId: '',
    showEditNickname: false,
    editNicknameValue: ''
  },

  onShow() {
    this._loadUserInfo()
  },

  /** 加载用户信息 */
  _loadUserInfo() {
    const userInfo = app.globalData.userInfo || storage.get('weekly-planner-user', {}) || {}
    const userId = userInfo.userId || this._getOrCreateUserId()
    this.setData({ userInfo, userId })
  },

  /** 获取或生成用户ID */
  _getOrCreateUserId() {
    let userId = storage.get('weekly-planner-user-id', '')
    if (!userId) {
      userId = 'U' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase()
      storage.set('weekly-planner-user-id', userId)
    }
    return userId
  },

  // ====================================================
  //  头像编辑
  // ====================================================

  /** 点击头像行 */
  onAvatarTap() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this._saveAvatar(tempFilePath)
      },
      fail: () => {
        wx.showToast({ title: '选择头像失败', icon: 'none' })
      }
    })
  },

  /** 保存头像到本地并更新 */
  _saveAvatar(tempPath) {
    wx.showLoading({ title: '保存中...' })

    const fileName = `avatar_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`
    const fs = wx.getFileSystemManager()
    const savePath = `${wx.env.USER_DATA_PATH}/${fileName}`

    fs.saveFile({
      tempFilePath: tempPath,
      filePath: savePath,
      success: () => {
        this._updateUserInfo({ avatarUrl: savePath })
        wx.hideLoading()
        wx.showToast({ title: '头像已更新', icon: 'success' })
      },
      fail: () => {
        this._updateUserInfo({ avatarUrl: tempPath })
        wx.hideLoading()
        wx.showToast({ title: '头像已更新', icon: 'success' })
      }
    })
  },

  // ====================================================
  //  昵称编辑
  // ====================================================

  onNicknameTap() {
    this.setData({
      showEditNickname: true,
      editNicknameValue: this.data.userInfo.nickName || ''
    })
  },

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
  //  更新用户信息
  // ====================================================

  _updateUserInfo(updates) {
    const currentInfo = storage.get('weekly-planner-user', {}) || {}
    const newInfo = { ...currentInfo, ...updates }

    storage.set('weekly-planner-user', newInfo)
    app.globalData.userInfo = newInfo
    this.setData({ userInfo: { ...newInfo } })
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
          this.setData({ userInfo: {}, userId: '' })
          wx.showToast({ title: '已退出', icon: 'success' })
          setTimeout(() => {
            wx.navigateBack()
          }, 800)
        }
      }
    })
  },

  // ====================================================
  //  账号注销
  // ====================================================

  onDeleteAccount() {
    wx.showModal({
      title: '账号注销',
      content: '注销后个人资料和登录状态将被清除，手账数据会保留在本地。确定要注销吗？',
      confirmText: '确定注销',
      confirmColor: '#d4756b',
      success: (res) => {
        if (res.confirm) {
          // 仅清除用户/登录相关数据，保留手账核心数据
          storage.remove('token')
          storage.remove('weekly-planner-user')
          storage.remove('weekly-planner-user-id')
          storage.remove('login_skipped')
          app.globalData.isLoggedIn = false
          app.globalData.userInfo = null
          wx.showToast({ title: '账号已注销', icon: 'success' })
          setTimeout(() => {
            wx.reLaunch({ url: '/pages/mine/mine' })
          }, 800)
        }
      }
    })
  }
})
