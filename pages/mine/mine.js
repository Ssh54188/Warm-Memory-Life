/**
 * 个人中心 — v2.1 用户卡片优化
 * 功能：
 *   - 展示大头像+昵称，点击进入个人资料页
 *   - 昵称快捷编辑弹窗保留
 *   - 退出登录
 */
const storage = require('../../utils/storage')
const { exportJSON, importJSON } = require('../../utils/data')
const { requestSubscribeMessage, checkSubscriptionStatus, getAuthDaysRemaining, getRemainingQuota, shouldAutoRequest } = require('../../utils/subscribeMessage')
const app = getApp()

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    storageInfo: { size: 0, percent: 0 },

    // 昵称编辑
    showEditNickname: false,
    editNicknameValue: '',

    // 提醒设置
    showReminderPanel: false,
    reminderEnabled: false,
    reminderTime: '09:00',
    subscriptionStatus: 'none', // none | granted | expired | denied | quota_empty
    authDaysRemaining: 0,      // 7天冷却期剩余天数
    subscriptionQuota: 0,      // 剩余可发送条数
  },

  onShow() {
    this._refreshUserInfo()
    this._loadReminderSettings()
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

  goBookkeeping() {
    wx.navigateTo({ url: '/pages/bookkeeping/bookkeeping' })
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

  /**
   * 加载提醒设置
   */
  _loadReminderSettings() {
    try {
      // 从本地存储加载
      const settings = storage.get('reminder_settings', {})
      this.setData({
        reminderEnabled: settings.enabled || false,
        reminderTime: settings.time || '09:00'
      })

      // 检查订阅状态
      const status = checkSubscriptionStatus()
      this.setData({
        subscriptionStatus: status,
        authDaysRemaining: getAuthDaysRemaining(),
        subscriptionQuota: getRemainingQuota()
      })

      // 如果已登录，从云端同步设置
      if (this.data.isLoggedIn) {
        this._syncReminderSettingsFromCloud()
      }
    } catch (e) {
      console.error('[Reminder] 加载设置失败', e)
    }
  },

  /**
   * 保存提醒设置到本地和云端
   */
  _saveReminderSettings() {
    try {
      const settings = {
        enabled: this.data.reminderEnabled,
        time: this.data.reminderTime,
        subscriptionQuota: getRemainingQuota(),
        updatedAt: new Date().toISOString()
      }
      storage.set('reminder_settings', settings)

      // 如果已登录，同步到云端
      if (this.data.isLoggedIn) {
        this._syncReminderSettingsToCloud(settings)
      }

      // 提醒设置已保存到本地和云端
      // 定时推送由云端 scheduler 云函数的定时触发器自动执行，
      // 无需小程序端注册。只需确保用户已授权订阅消息即可。
    } catch (e) {
      console.error('[Reminder] 保存设置失败', e)
    }
  },

  /**
   * 打开提醒设置面板
   */
  onOpenReminderSettings() {
    this._loadReminderSettings()
    this.setData({ showReminderPanel: true })
  },

  /**
   * 关闭提醒设置面板
   */
  onCloseReminderSettings() {
    this.setData({ showReminderPanel: false })
  },

  /** 阻止事件冒泡（面板内部点击不关闭） */
  preventBubble() {},

  /**
   * 切换提醒开关
   */
  onReminderToggle(e) {
    const enabled = e.detail.value
    this.setData({ reminderEnabled: enabled })

    if (enabled) {
      const status = checkSubscriptionStatus()
      const daysLeft = getAuthDaysRemaining()
      const quota = getRemainingQuota()
      this.setData({
        subscriptionStatus: status,
        authDaysRemaining: daysLeft,
        subscriptionQuota: quota
      })

      // 仅在这三种状态时自动弹框，且距离上次拒绝 >= 3 分钟
      if ((status === 'none' || status === 'expired' || status === 'quota_empty') && shouldAutoRequest()) {
        setTimeout(() => this.onRequestSubscribe(), 600)
      }
    }
    // 关闭提醒时不删除授权记录，保留7天冷却期

    this._saveReminderSettings()

    wx.showToast({
      title: enabled ? '提醒已开启 🔔' : '提醒已关闭',
      icon: 'none',
      duration: 1200
    })
  },

  /**
   * 提醒时间变更
   */
  onReminderTimeChange(e) {
    const time = e.detail.value
    this.setData({ reminderTime: time })
    this._saveReminderSettings()

    wx.showToast({
      title: `提醒时间已设为${time}`,
      icon: 'none',
      duration: 1000
    })
  },

  /**
   * 请求订阅授权（含并发锁，防止重复弹框）
   */
  onRequestSubscribe() {
    // 并发锁：如果正在请求中，忽略
    if (this._subscribing) {
      console.log('[Reminder] 订阅请求进行中，忽略重复调用')
      return
    }
    this._subscribing = true

    wx.showLoading({ title: '唤起授权...' })

    requestSubscribeMessage()
      .then((res) => {
        this._subscribing = false
        wx.hideLoading()

        if (res.accepted) {
          // 用户接受了授权
          this.setData({
            subscriptionStatus: 'granted',
            authDaysRemaining: 7,
            subscriptionQuota: getRemainingQuota()
          })
          this._saveReminderSettings()
          wx.showToast({
            title: `🎉 已获取 ${res.quota} 条消息配额`,
            icon: 'none',
            duration: 2000
          })
        } else {
          // 用户拒绝了授权（正常行为，不是错误）
          console.log('[Reminder] 用户取消了授权')
          this.setData({
            subscriptionStatus: 'quota_empty',
            authDaysRemaining: getAuthDaysRemaining(),
            subscriptionQuota: getRemainingQuota()
          })
          wx.showToast({
            title: '未授权，可随时再次开启',
            icon: 'none',
            duration: 2000
          })
        }
      })
      .catch((err) => {
        this._subscribing = false
        wx.hideLoading()
        console.error('[Reminder] 订阅授权异常', err)

        // 模拟器不支持订阅消息，给出明确提示
        if (err.message === 'timeout') {
          this.setData({ subscriptionStatus: 'unverified' })
          wx.showModal({
            title: '模拟器提示',
            content: '开发者工具模拟器不支持订阅消息授权，请在「真机调试」中测试此功能。',
            showCancel: false,
            confirmText: '知道了'
          })
          return
        }

        // 真正的API错误
        this.setData({
          subscriptionStatus: checkSubscriptionStatus(),
          subscriptionQuota: getRemainingQuota()
        })

        wx.showModal({
          title: '授权异常',
          content: '订阅消息授权调用失败，请稍后重试。\n\n' + (err.errMsg || err.message || ''),
          confirmText: '去设置',
          cancelText: '暂不',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting()
            }
          }
        })
      })
  },

  /**
   * 同步提醒设置到云端
   */
  _syncReminderSettingsToCloud(settings) {
    if (!wx.cloud) {
      console.warn('[Reminder] 云开发未初始化')
      return
    }

    wx.cloud.callFunction({
      name: 'syncUserSettings',
      data: {
        type: 'reminder',
        data: settings
      }
    }).then(res => {
      console.log('[Reminder] 云端同步成功', res)
    }).catch(err => {
      console.error('[Reminder] 云端同步失败', err)
    })
  },

  /**
   * 从云端同步提醒设置
   */
  _syncReminderSettingsFromCloud() {
    if (!wx.cloud) {
      console.warn('[Reminder] 云开发未初始化')
      return
    }

    wx.cloud.callFunction({
      name: 'syncUserSettings',
      data: {
        type: 'reminder',
        action: 'get'
      }
    }).then(res => {
      if (res.result && res.result.data) {
        const cloudSettings = res.result.data
        this.setData({
          reminderEnabled: cloudSettings.enabled || false,
          reminderTime: cloudSettings.time || '09:00'
        })
        // 同步云端配额到本地
        if (cloudSettings.subscriptionQuota != null) {
          wx.setStorageSync('subscription_quota', cloudSettings.subscriptionQuota)
          this.setData({ subscriptionQuota: cloudSettings.subscriptionQuota })
        }
        storage.set('reminder_settings', cloudSettings)
      }
    }).catch(err => {
      console.error('[Reminder] 云端同步失败', err)
    })
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
