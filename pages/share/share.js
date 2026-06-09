// pages/share/share.js
const app = getApp()

Page({
  data: {
    inviteType: 'todo',   // 'todo' 或 'calendar'
    inviteCode: '',          // 生成的邀请码
    inputCode: '',          // 用户输入的邀请码
    todoPartner: null,      // 待办共享对象 openid
    calendarPartner: null,  // 日程共享对象 openid
    sharedTodos: [],        // 对方待办数据
    sharedEvents: [],       // 对方日程数据
  },

  onLoad() {
    this._checkShareStatus()
  },

  onShow() {
    this._checkShareStatus()
  },

  // 查询当前共享状态
  async _checkShareStatus() {
    try {
      const [todoRes, calendarRes] = await Promise.all([
        wx.cloud.callFunction({ name: 'getSharedData', data: { type: 'todo' } }),
        wx.cloud.callFunction({ name: 'getSharedData', data: { type: 'calendar' } })
      ])

      this.setData({
        todoPartner: todoRes.result.data.partnerExists ? todoRes.result.data.partnerOpenid : null,
        calendarPartner: calendarRes.result.data.partnerExists ? calendarRes.result.data.partnerOpenid : null,
        sharedTodos: todoRes.result.data.partnerItems || [],
        sharedEvents: calendarRes.result.data.partnerItems || [],
      })
    } catch (e) {
      console.error('[Share] 查询共享状态失败', e)
    }
  },

  // 切换邀请类型
  onSelectType(e) {
    this.setData({ inviteType: e.currentTarget.dataset.type, inviteCode: '' })
  },

  // 生成邀请码
  async onCreateInvite() {
    wx.showLoading({ title: '生成中', mask: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'createInvitation',
        data: { type: this.data.inviteType }
      })
      wx.hideLoading()
      if (res.result.code === 0) {
        this.setData({ inviteCode: res.result.data.code })
        wx.showToast({ title: '邀请码已生成', icon: 'success' })
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      console.error('[Share] 生成邀请码失败', e)
      wx.showToast({ title: '生成失败', icon: 'none' })
    }
  },

  // 复制邀请码
  onCopyCode() {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    })
  },

  // 输入邀请码
  onInputCode(e) {
    this.setData({ inputCode: e.detail.value.toUpperCase() })
  },

  // 接受邀请
  async onAcceptInvite() {
    const code = this.data.inputCode.trim()
    if (!code || code.length !== 6) {
      wx.showToast({ title: '请输入6位邀请码', icon: 'none' })
      return
    }
    wx.showLoading({ title: '处理中', mask: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'acceptInvitation',
        data: { code }
      })
      wx.hideLoading()
      if (res.result.code === 0) {
        wx.showToast({ title: '接受邀请成功', icon: 'success' })
        this.setData({ inputCode: '' })
        this._checkShareStatus()
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      console.error('[Share] 接受邀请失败', e)
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  // 取消共享
  async onDisableShare(e) {
    const type = e.currentTarget.dataset.type
    wx.showModal({
      title: '提示',
      content: `确定取消${type === 'todo' ? '待办' : '日程'}共享？`,
      success: async (res) => {
        if (res.confirm) {
          // 删除共享关系
          try {
            await wx.cloud.callFunction({
              name: 'syncData',
              data: { type, action: 'disableShare' }
            })
            wx.showToast({ title: '已取消共享', icon: 'success' })
            this._checkShareStatus()
          } catch (e) {
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
  },
})
