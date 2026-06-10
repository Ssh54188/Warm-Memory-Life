/**
 * 个人资料页 v2
 * 功能：头像大卡、性别/年龄/职业编辑、资料完整度、复制UID、退出/注销
 */
const storage = require('../../utils/storage')
const app = getApp()

Page({
  data: {
    userInfo: {},
    userId: '',
    completionPercent: 0,
    phoneBindingActive: false,    // 触发 getPhoneNumber 按钮

    // 昵称编辑
    showEditNickname: false,
    editNicknameValue: '',

    // 职业编辑
    showEditOccupation: false,
    editOccupationValue: ''
  },

  onShow() {
    this._loadUserInfo()
  },

  /** 加载用户信息并计算完整度（本地优先 → 云端刷新） */
  _loadUserInfo() {
    const userInfo = app.globalData.userInfo || storage.get('weekly-planner-user', {}) || {}
    const userId = userInfo.userId || storage.get('weekly-planner-user-id', '')

    if (userId) {
      // 已有 ID，直接展示
      if (!userInfo.userId) {
        userInfo.userId = userId
      }
      this.setData({
        userInfo,
        userId,
        completionPercent: this._calcCompletion(userInfo)
      })
    } else {
      // 尚未分配 ID，先展示占位，异步分配
      this.setData({
        userInfo,
        userId: 'NJ------',
        completionPercent: this._calcCompletion(userInfo)
      })
      this._assignUserIdFromCloud(userInfo)
    }

    // 从云端拉取最新用户数据（异步，不阻塞页面渲染）
    if (wx.cloud) {
      this._loadFromCloud(userInfo, userId)
    }
  },

  /**
   * 从云数据库加载用户信息，覆盖本地数据
   * 用于跨设备同步 / 重新登录后恢复数据
   */
  async _loadFromCloud(localInfo, localUserId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'syncUserInfo',
        data: { action: 'load' }
      })
      if (res.result && res.result.success && res.result.userInfo) {
        const cloudInfo = res.result.userInfo
        // 合并：云端数据优先，保留本地 userId（云端可能没有）
        const merged = { ...localInfo, ...cloudInfo }
        if (localUserId) merged.userId = localUserId
        storage.set('weekly-planner-user', merged)
        app.globalData.userInfo = merged
        this.setData({
          userInfo: { ...merged },
          completionPercent: this._calcCompletion(merged)
        })
        console.log('[Profile] 云端数据已加载')
      }
    } catch (err) {
      console.error('[Profile] 云端加载失败，使用本地数据', err)
    }
  },

  /** 从云端分配序号 UID */
  async _assignUserIdFromCloud(userInfo) {
    try {
      if (!wx.cloud) {
        console.warn('[Profile] 云开发未初始化，使用本地 UID')
        this._fallbackLocalUserId(userInfo)
        return
      }

      const res = await wx.cloud.callFunction({
        name: 'assignUserId',
        data: {}
      })

      const result = res.result || {}
      if (result.success && result.userId) {
        const userId = result.userId
        storage.set('weekly-planner-user-id', userId)
        userInfo.userId = userId
        storage.set('weekly-planner-user', userInfo)
        app.globalData.userInfo = userInfo
        this.setData({
          userId,
          userInfo: { ...userInfo }
        })
        if (result.isNew) {
          console.log('[Profile] 已分配用户ID:', userId)
        }
      } else {
        console.warn('[Profile] 云函数分配失败，使用本地 UID')
        this._fallbackLocalUserId(userInfo)
      }
    } catch (err) {
      console.error('[Profile] 分配用户ID异常', err)
      this._fallbackLocalUserId(userInfo)
    }
  },

  /** 降级：本地生成 UID（云函数不可用时） */
  _fallbackLocalUserId(userInfo) {
    let userId = storage.get('weekly-planner-user-id', '')
    if (!userId) {
      userId = 'NJ' + Date.now().toString(36).toUpperCase().slice(-6)
      storage.set('weekly-planner-user-id', userId)
    }
    userInfo.userId = userId
    storage.set('weekly-planner-user', userInfo)
    app.globalData.userInfo = userInfo
    this.setData({
      userId,
      userInfo: { ...userInfo }
    })
  },

  /** 计算资料完整度 */
  _calcCompletion(info) {
    const fields = ['nickName', 'phone', 'gender', 'age', 'occupation']
    const filled = fields.filter(f => info[f]).length
    // 头像单独算一项
    const hasAvatar = !!info.avatarUrl
    const total = fields.length + 1
    const score = (filled + (hasAvatar ? 1 : 0))
    return Math.round((score / total) * 100)
  },

  /** 获取当前用户ID（已有值直接从 storage 读） */
  _getUserId() {
    return storage.get('weekly-planner-user-id', '')
  },

  /** 阻止事件冒泡（弹窗背景用） */
  preventBubble() {},

  /** 全量更新用户信息（本地 + 云端） */
  _updateUserInfo(updates) {
    const currentInfo = storage.get('weekly-planner-user', {}) || {}
    const newInfo = { ...currentInfo, ...updates }

    storage.set('weekly-planner-user', newInfo)
    app.globalData.userInfo = newInfo
    this.setData({
      userInfo: { ...newInfo },
      completionPercent: this._calcCompletion(newInfo)
    })

    // 异步同步到云数据库
    if (wx.cloud) {
      wx.cloud.callFunction({
        name: 'syncUserInfo',
        data: { action: 'save', userInfo: newInfo }
      }).then(res => {
        console.log('[Profile] 云端同步成功', res.result)
      }).catch(err => {
        console.error('[Profile] 云端同步失败', err)
      })
    }
  },

  // ====================================================
  //  Hero 区域
  // ====================================================

  /** 复制用户ID */
  onCopyUserId() {
    wx.setClipboardData({
      data: this.data.userId,
      success: () => {
        wx.showToast({ title: '用户ID已复制', icon: 'success' })
      }
    })
  },

  // ====================================================
  //  头像编辑
  // ====================================================

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
  //  手机号
  // ====================================================

  onPhoneTap() {
    if (this.data.userInfo.phone) {
      // 已有手机号，提示不可修改（微信只能一次性授权）
      wx.showToast({ title: '手机号暂不支持修改', icon: 'none' })
    } else {
      // 未绑定 → 触发 getPhoneNumber 按钮
      wx.showModal({
        title: '绑定手机号',
        content: '将使用微信手机号快速验证',
        confirmText: '去绑定',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 通过选择器触发隐藏的 getPhoneNumber 按钮
            this.setData({ phoneBindingActive: true })
          }
        }
      })
    }
  },

  /**
   * 微信手机号授权回调（profile 页专用）
   * 发送 code 到云函数解密 → 保存到本地和云端
   */
  async onGetPhone(e) {
    this.setData({ phoneBindingActive: false })

    const { errMsg, code } = e.detail || {}
    if (errMsg !== 'getPhoneNumber:ok') {
      if (errMsg && errMsg !== 'getPhoneNumber:cancel') {
        wx.showToast({ title: '获取手机号失败', icon: 'none' })
      }
      return
    }

    wx.showLoading({ title: '绑定中...', mask: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'syncUserInfo',
        data: { action: 'decryptPhone', code }
      })
      const result = res.result || {}
      if (result.success && result.phoneNumber) {
        this._updateUserInfo({ phone: result.phoneNumber })
        wx.hideLoading()
        wx.showToast({ title: '手机号已绑定', icon: 'success' })
      } else {
        wx.hideLoading()
        wx.showToast({ title: result.error || '绑定失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('[Profile] 手机号解密失败', err)
      wx.showToast({ title: '绑定失败，请重试', icon: 'none' })
    }
  },

  // ====================================================
  //  性别选择
  // ====================================================

  onGenderTap() {
    const current = this.data.userInfo.gender || ''
    wx.showActionSheet({
      itemList: ['男', '女', '保密'],
      success: (res) => {
        const map = { 0: '男', 1: '女', 2: '保密' }
        const gender = map[res.tapIndex]
        if (gender !== current) {
          this._updateUserInfo({ gender })
          wx.showToast({ title: '性别已更新', icon: 'success' })
        }
      },
      fail: (err) => {
        console.log('[Profile] 性别选择取消', err)
      }
    })
  },

  // ====================================================
  //  年龄选择
  // ====================================================

  onAgeTap() {
    wx.showActionSheet({
      itemList: ['18岁以下', '18-24岁', '25-30岁', '31-35岁', '36-40岁', '40岁以上'],
      success: (res) => {
        const map = {
          0: '18岁以下', 1: '18-24岁', 2: '25-30岁',
          3: '31-35岁', 4: '36-40岁', 5: '40岁以上'
        }
        const age = map[res.tapIndex]
        if (age !== this.data.userInfo.age) {
          this._updateUserInfo({ age })
          wx.showToast({ title: '年龄已更新', icon: 'success' })
        }
      },
      fail: (err) => {
        console.log('[Profile] 年龄选择取消', err)
      }
    })
  },

  // ====================================================
  //  职业编辑
  // ====================================================

  onOccupationTap() {
    this.setData({
      showEditOccupation: true,
      editOccupationValue: this.data.userInfo.occupation || ''
    })
  },

  onEditOccupationInput(e) {
    this.setData({ editOccupationValue: e.detail.value.trim() })
  },

  onConfirmOccupation() {
    const value = this.data.editOccupationValue.trim()
    if (!value) {
      wx.showToast({ title: '请输入职业', icon: 'none' })
      return
    }
    if (value.length > 30) {
      wx.showToast({ title: '职业不能超过30个字', icon: 'none' })
      return
    }

    this._updateUserInfo({ occupation: value })
    this.setData({ showEditOccupation: false })
    wx.showToast({ title: '职业已更新', icon: 'success' })
  },

  onCancelOccupation() {
    this.setData({ showEditOccupation: false, editOccupationValue: '' })
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
          this.setData({ userInfo: {}, userId: '', completionPercent: 0 })
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
