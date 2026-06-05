/**
 * 登录页 — v1.0.2
 * 支持：微信一键登录 / 手机号登录 / 邮箱登录 / 跳过登录
 */
const storage = require('../../utils/storage')
const app = getApp()

Page({
  data: {
    loginTab: 'wechat',       // wechat | phone | email
    tabs: [
      { key: 'wechat', label: '微信登录' },
      { key: 'phone', label: '手机号' },
      { key: 'email', label: '邮箱' }
    ],

    // 邮箱登录
    email: '',
    emailPwd: '',

    // 状态
    loading: false,
    canGetPhone: false,
    showSkip: true,
    alreadyLoggedIn: false,   // 是否已登录（从"我的"页导航过来）
    currentUser: null
  },

  onLoad(options) {
    // 仅在首次冷启动时自动跳过登录页；主动导航过来时（如从"我的"页）始终展示
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
        this.setData({ alreadyLoggedIn: true, currentUser: userInfo, showSkip: false })
      }
    }
  },

  // ====================================================
  //  Tab 切换
  // ====================================================

  onSwitchTab(e) {
    const { key } = e.currentTarget.dataset
    this.setData({ loginTab: key })
  },

  // ====================================================
  //  微信一键登录（v1.0.2 不再使用已废弃的 getUserProfile）
  // ====================================================

  onWechatLogin() {
    this.setData({ loading: true })

    // 直接使用 wx.login 获取 code，不再依赖已废弃的 getUserProfile
    wx.login({
      success: (loginRes) => {
        if (loginRes.code) {
          const mockToken = `token_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
          // code 可通过后端换取 openid，当前使用模拟用户信息
          const userInfo = { nickName: '微信用户', loginMethod: 'wechat' }
          this._onLoginSuccess(mockToken, userInfo)
        } else {
          // code 为空时直接用模拟登录
          this._onMockLogin()
        }
      },
      fail: () => {
        // wx.login 失败时降级为模拟登录
        this._onMockLogin()
      }
    })
  },

  /** 模拟登录（wx.login 失败时的降级方案） */
  _onMockLogin() {
    const mockToken = `token_guest_${Date.now()}`
    const userInfo = { nickName: '访客用户', loginMethod: 'guest' }
    this._onLoginSuccess(mockToken, userInfo)
  },

  // ====================================================
  //  手机号登录
  // ====================================================

  onGetPhone(e) {
    const { errMsg, code } = e.detail
    if (errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({ title: '获取手机号失败', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    // TODO: 发送加密数据到后端解密
    // 当前本地模拟
    const mockToken = `token_phone_${Date.now()}`
    const userInfo = { phone: '已绑定手机号' }
    this._onLoginSuccess(mockToken, userInfo)
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

    // TODO: 发送到后端校验
    // 当前本地模拟
    const mockToken = `token_email_${Date.now()}`
    const userInfo = { email: email.trim() }
    this._onLoginSuccess(mockToken, userInfo)
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
    wx.showToast({ title: '登录成功', icon: 'success', duration: 800 })
    // 直接跳转，reLaunch 会关闭登录页
    setTimeout(() => { this._goHome() }, 800)
  },

  // ====================================================
  //  退出登录（在登录页中切换账号）
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
          this.setData({ alreadyLoggedIn: false, currentUser: null, showSkip: true })
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
