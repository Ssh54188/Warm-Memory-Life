/**
 * 用户协议页
 * 符合微信小程序审核要求：必须有实质内容和返回功能
 */
Page({
  data: {
    pageTitle: '暖记生活 · 用户协议',
    effectiveDate: '2026年6月1日'
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '用户协议' })
  },

  /**
   * 分享配置 — 微信审核要求页面需支持分享
   */
  onShareAppMessage() {
    return {
      title: '暖记生活 · 用户协议',
      path: '/pages/agreement/agreement'
    }
  }
})
