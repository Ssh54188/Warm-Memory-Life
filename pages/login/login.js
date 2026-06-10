/**
 * 登录页 — v2.0 真正的微信登录
 * 支持：微信一键登录（获取真实头像+昵称） / 手机号登录 / 邮箱登录 / 跳过登录
 * 核心能力：
 *   - 使用 <button open-type="chooseAvatar"> 获取用户头像
 *   - 使用 <input type="nickname"> 获取微信昵称
 *   - 支持登录前修改头像和昵称
 *   - 头像和昵称持久化存储，同步到"我的"页面
 */
const storage = require('../../utils/storage')
const app = getApp()

/**
 * 生成客户端会话标识符（UUID v4）
 * 本地优先应用：token 用于客户端会话状态管理，非服务端认证
 */
function generateSessionToken() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

Page({
  data: {
    loginTab: 'wechat',       // wechat | phone | email
    tabs: [
      { key: 'wechat', label: '微信登录' },
      { key: 'phone', label: '手机号' },
      { key: 'email', label: '邮箱' }
    ],

    // ====== 微信登录 - 用户信息（核心改动）======
    avatarUrl: '',             // 用户选择的头像 URL（临时路径或本地路径）
    nickName: '',              // 用户昵称（来自微信昵称输入框或手动修改）
    hasChosenAvatar: false,    // 是否已选择头像
    canChooseAvatar: true,     // 是否可以选头像（微信基础库 2.21.2+）

    // 邮箱登录
    email: '',
    emailPwd: '',

    // 状态
    loading: false,
    showSkip: true,
    alreadyLoggedIn: false,    // 是否已登录（从"我的"页导航过来）
    currentUser: null,
    editingName: false,        // 是否正在编辑昵称
    nicknameInputFocus: false  // 控制昵称输入框自动聚焦
  },

  onLoad(options) {
    // 仅在首次冷启动时自动跳过登录页；主动导航过来时始终展示
    if (!options || !options.from) {
      if (storage.get('token', '')) {
        setTimeout(() => wx.reLaunch({ url: '/pages/overview/overview' }), 30)
        return
      }
      if (storage.get('login_skipped', false)) {
        setTimeout(() => wx.reLaunch({ url: '/pages/overview/overview' }), 30)
      }
    } else {
      // 从其他页面导航过来，检查是否已登录
      const userInfo = storage.get('weekly-planner-user', null)
      if (userInfo) {
        this.setData({
          alreadyLoggedIn: true,
          currentUser: userInfo,
          showSkip: false,
          avatarUrl: userInfo.avatarUrl || '',
          nickName: userInfo.nickName || '',
          hasChosenAvatar: !!userInfo.avatarUrl
        })
      }
    }
  },

  onShow() {
    // 每次显示时刷新用户信息
    const userInfo = storage.get('weekly-planner-user', null)
    if (userInfo && !this.data.alreadyLoggedIn) {
      this.setData({
        avatarUrl: userInfo.avatarUrl || '',
        nickName: userInfo.nickName || '',
        hasChosenAvatar: !!userInfo.avatarUrl
      })
    }
  },

  /**
   * 用户点击昵称区域 → 触发隐藏的 nickname input 获取微信昵称
   */
  onTapNicknameArea() {
    this.setData({ nicknameInputFocus: true })
  },

  // ====================================================
  //  Tab 切换
  // ====================================================

  onSwitchTab(e) {
    const { key } = e.currentTarget.dataset
    this.setData({ loginTab: key })
  },

  // ====================================================
  //  微信登录 — 头像选择（核心功能）
  // ====================================================

  /**
   * 选择头像回调
   * 通过 <button open-type="chooseAvatar"> 触发
   * @param {Object} e - 事件对象，e.detail.avatarUrl 为临时文件路径
   */
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    if (!avatarUrl) {
      wx.showToast({ title: '选择头像失败', icon: 'none' })
      return
    }

    // 将临时头像保存到本地永久路径（避免临时文件被清理）
    this._saveAvatarLocally(avatarUrl).then((savedPath) => {
      this.setData({
        avatarUrl: savedPath,
        hasChosenAvatar: true
      })
    }).catch(() => {
      // 保存失败时直接使用临时路径（小程序内短期可用）
      this.setData({
        avatarUrl: avatarUrl,
        hasChosenAvatar: true
      })
    })
  },

  /**
   * 将头像临时文件保存到用户本地文件系统（永久存储）
   * @param {string} tempPath - 临时文件路径
   * @returns {Promise<string>} 永久文件路径
   */
  _saveAvatarLocally(tempPath) {
    return new Promise((resolve, reject) => {
      // 生成唯一文件名
      const fileName = `avatar_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`
      const fs = wx.getFileSystemManager()

      // 确保目录存在（使用 USER_DATA_PATH）
      const savePath = `${wx.env.USER_DATA_PATH}/${fileName}`

      fs.saveFile({
        tempFilePath: tempPath,
        filePath: savePath,
        success: () => resolve(savePath),
        fail: (err) => {
          console.warn('[Login] 保存头像失败，使用临时路径', err)
          reject(err)
        }
      })
    })
  },

  // ====================================================
  //  微信登录 — 昵称输入（核心功能）
  // ====================================================

  /**
   * 昵称输入回调
   * 通过 <input type="nickname"> 或普通 input 触发
   * 微信会自动填充用户的微信昵称作为 placeholder/初始值
   */
  onNicknameInput(e) {
    this.setData({ nickName: e.detail.value.trim() })
  },

  /**
   * 昵称输入框聚焦时切换到编辑模式
   */
  onNicknameFocus() {
    this.setData({ editingName: true })
  },

  /**
   * 昵称输入框失焦时退出编辑模式
   */
  onNicknameBlur() {
    this.setData({ editingName: false })
  },

  // ====================================================
  //  微信一键登录（v2.0 真正的登录流程）
  // ====================================================

  onWechatLogin() {
    const { avatarUrl, nickName, hasChosenAvatar } = this.data

    // 直接登录，不设"微信用户"这种无意义兜底，也不弹头像确认
    this._doWechatLogin(hasChosenAvatar ? avatarUrl : '')
  },

  /** 执行微信登录的核心逻辑 */
  _doWechatLogin(avatarUrl) {
    this.setData({ loading: true })

    wx.login({
      success: (loginRes) => {
        if (loginRes.code) {
          const sessionToken = `sid_${generateSessionToken()}`
          // 构建完整的用户信息对象（包含真实的头像和昵称 + 微信绑定标记）
          const userInfo = {
            nickName: this.data.nickName.trim(),
            avatarUrl: avatarUrl,
            wechatName: this.data.nickName.trim(),   // 标记微信已绑定
            loginMethod: 'wechat'
          }
          this._onLoginSuccess(sessionToken, userInfo)
        } else {
          this._onLocalLogin()
        }
      },
      fail: () => {
        this._onLocalLogin()
      }
    })
  },

  /** 本地登录降级方案（wx.login 失败时使用） */
  _onLocalLogin() {
    const sessionToken = `local_${generateSessionToken()}`
    const userInfo = {
      nickName: this.data.nickName.trim() || '访客用户',
      avatarUrl: this.data.avatarUrl || '',
      loginMethod: 'guest'
    }
    this._onLoginSuccess(sessionToken, userInfo)
  },

  // ====================================================
  //  手机号登录
  // ====================================================

  async onGetPhone(e) {
    const { errMsg, code } = e.detail
    if (errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({ title: '获取手机号失败', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    try {
      // ① 调用云函数解密真实手机号
      const phoneRes = await wx.cloud.callFunction({
        name: 'syncUserInfo',
        data: { action: 'decryptPhone', code }
      })

      const sessionToken = `phone_${generateSessionToken()}`

      if (phoneRes.result && phoneRes.result.success && phoneRes.result.phoneNumber) {
        const userInfo = {
          phone: phoneRes.result.phoneNumber,
          avatarUrl: this.data.avatarUrl || '',
          nickName: this.data.nickName.trim() || '手机用户',
          loginMethod: 'phone'
        }
        this._onLoginSuccess(sessionToken, userInfo)
      } else {
        // 解密失败（如未开通手机号能力），提示并停止
        const errorMsg = (phoneRes.result && phoneRes.result.error) || '手机号获取失败'
        wx.showToast({ title: errorMsg, icon: 'none', duration: 2000 })
        this.setData({ loading: false })
      }
    } catch (err) {
      console.error('[Login] 手机号登录失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  },

  // ====================================================
  //  邮箱登录
  // ====================================================

  onEmailInput(e) {
    this.setData({ email: e.detail.value })
  },

  onPwdInput(e) {
    this.setData({ emailPwd: e.detail.value })
  },

  onEmailLogin() {
    const { email, emailPwd } = this.data
    if (!email.trim()) {
      wx.showToast({ title: '请输入邮箱', icon: 'none' })
      return
    }
    if (!emailPwd.trim()) {
      wx.showToast({ title: '请输入密码', icon: 'none' })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      wx.showToast({ title: '邮箱格式不正确', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    const sessionToken = `email_${generateSessionToken()}`
    const userInfo = {
      email: email.trim(),
      avatarUrl: this.data.avatarUrl || '',
      nickName: this.data.nickName.trim() || email.split('@')[0],
      loginMethod: 'email'
    }
    this._onLoginSuccess(sessionToken, userInfo)
  },

  // ====================================================
  //  登录成功处理
  // ====================================================

  _onLoginSuccess(token, userInfo) {
    storage.set('token', token)
    storage.set('weekly-planner-user', userInfo)
    app.globalData.isLoggedIn = true
    app.globalData.userInfo = userInfo

    this.setData({ loading: false })

    // 异步同步到云数据库
    if (wx.cloud) {
      wx.cloud.callFunction({
        name: 'syncUserInfo',
        data: { action: 'save', userInfo }
      }).then(res => {
        console.log('[Login] 云端同步成功', res.result)
      }).catch(err => {
        console.error('[Login] 云端同步失败', err)
      })
    }
    wx.showToast({ title: '登录成功', icon: 'success', duration: 800 })
    setTimeout(() => { this._goHome() }, 800)
  },

  // ====================================================
  //  退出登录
  // ====================================================

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后数据将保留在本地。',
      confirmColor: '#d4756b',
      success: (res) => {
        if (res.confirm) {
          storage.remove('token')
          storage.remove('weekly-planner-user')
          app.globalData.isLoggedIn = false
          app.globalData.userInfo = null
          this.setData({
            alreadyLoggedIn: false,
            currentUser: null,
            showSkip: true,
            avatarUrl: '',
            nickName: '',
            hasChosenAvatar: false
          })
          wx.showToast({ title: '已退出', icon: 'success' })
        }
      }
    })
  },

  // ====================================================
  //  跳过登录
  // ====================================================

  onSkip() {
    storage.set('login_skipped', true)
    this._goHome()
  },

  // ====================================================
  //  导航
  // ====================================================

  _goHome() {
    wx.reLaunch({ url: '/pages/overview/overview' })
  }
})
