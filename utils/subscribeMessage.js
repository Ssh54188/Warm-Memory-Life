/**
 * 订阅消息工具函数
 * 封装微信订阅消息相关功能
 *
 * 策略：wx.requestSubscribeMessage 每次最多3个 tmplId。
 * 同一个模板 ID 重复传入，微信可能允许多次授权（实验性）。
 * 一次弹框 → 最多3条消息 → 3天不用再授权。
 */

// 订阅消息模板ID（需替换为实际申请的模板ID）
const TEMPLATE_ID = 'wqxj0PzSpIuig2db0DS4tgdJeyoBexxq_FntttyROO0'

// 每次授权申请的条数（微信上限3，多了会被截断）
const AUTH_BATCH_SIZE = 3

function getTmplIds() {
  return Array(AUTH_BATCH_SIZE).fill(TEMPLATE_ID)
}

/**
 * 请求订阅消息授权（一次弹框，最多3条）
 * @returns {Promise} 授权结果
 */
function requestSubscribeMessage() {
  return new Promise((resolve, reject) => {
    if (!TEMPLATE_ID || TEMPLATE_ID === 'your_template_id_here' || TEMPLATE_ID === 'your-template-id-here') {
      console.warn('[Subscribe] 模板ID未配置')
      reject(new Error('模板ID未配置'))
      return
    }

    const tmplIds = getTmplIds()

    // 模拟器超时保护
    const timeoutTimer = setTimeout(() => {
      console.warn('[Subscribe] 调用超时，模拟器不支持订阅消息，请在真机上测试')
      reject(new Error('timeout'))
    }, 5000)

    wx.requestSubscribeMessage({
      tmplIds,
      success: (res) => {
        clearTimeout(timeoutTimer)
        console.log('[Subscribe] 授权结果', res)

        const resultValue = res[TEMPLATE_ID]
        const errMsg = res.errMsg || ''

        // accept: 用户至少同意了一次授权（WeChat 合并同模板ID结果）
        if (resultValue === 'accept') {
          wx.setStorageSync('subscription_status', 'granted')
          wx.setStorageSync('subscription_time', Date.now())
          wx.setStorageSync('subscription_quota', AUTH_BATCH_SIZE)
          // 清除拒绝时间戳（成功授权后重置）
          wx.removeStorageSync('subscription_rejected_at')
          resolve({ accepted: true, granted: [TEMPLATE_ID], quota: AUTH_BATCH_SIZE, result: res })
          return
        }

        // reject: 用户主动拒绝，这是正常行为，不是错误
        // ban: 用户永久拒绝（关闭了该模板的接收权限）
        console.log('[Subscribe] 用户未授权，结果=' + resultValue)
        // 记录拒绝时间，防止短期内重复弹框
        wx.setStorageSync('subscription_rejected_at', Date.now())
        // 保持原有 status 不变（不覆盖 'granted' 为 'denied'）
        // 但也要记录本次尝试结果
        if (!wx.getStorageSync('subscription_status') || wx.getStorageSync('subscription_status') === 'none') {
          wx.setStorageSync('subscription_status', 'denied')
        }
        resolve({ accepted: false, reason: resultValue || 'reject', result: res })
      },
      fail: (err) => {
        clearTimeout(timeoutTimer)
        console.error('[Subscribe] API调用失败', err)
        reject(err)
      }
    })
  })
}

/**
 * 检查订阅授权状态
 * @returns {string} 授权状态：granted | expired | denied | none
 */
function checkSubscriptionStatus() {
  const status = wx.getStorageSync('subscription_status')
  const time = wx.getStorageSync('subscription_time')

  if (status === 'granted' && time) {
    const daysPassed = (Date.now() - time) / (1000 * 60 * 60 * 24)
    if (daysPassed > 7) return 'expired'
    if (getRemainingQuota() <= 0) return 'quota_empty'
  }

  // 模拟器偏好：标记为未验证，但不阻止真机逻辑
  if (status === 'granted') {
    try {
      if (wx.getSystemInfoSync().platform === 'devtools') return 'unverified'
    } catch (_) {}
  }

  return status || 'none'
}

/**
 * 检查是否应该自动弹框（避免拒绝后短时间内反复弹）
 * @returns {boolean} true = 应该弹框
 */
function shouldAutoRequest() {
  const rejectedAt = wx.getStorageSync('subscription_rejected_at')
  if (rejectedAt) {
    // 3分钟内拒绝过，不自动弹框
    const minutesPassed = (Date.now() - rejectedAt) / (1000 * 60)
    if (minutesPassed < 3) return false
  }
  return true
}

/**
 * 获取剩余可发送条数
 */
function getRemainingQuota() {
  const status = wx.getStorageSync('subscription_status')
  if (status !== 'granted') return 0
  return wx.getStorageSync('subscription_quota') || 0
}

/**
 * 消费一条配额（云端发送成功后调用）
 */
function consumeQuota() {
  const quota = getRemainingQuota()
  if (quota <= 0) return 0
  const remaining = quota - 1
  wx.setStorageSync('subscription_quota', remaining)
  return remaining
}

/**
 * 获取授权剩余天数
 */
function getAuthDaysRemaining() {
  const status = wx.getStorageSync('subscription_status')
  const time = wx.getStorageSync('subscription_time')
  if (status !== 'granted' || !time) return 0
  return Math.max(0, Math.ceil(7 - (Date.now() - time) / (1000 * 60 * 60 * 24)))
}

/**
 * 发送订阅消息（由云函数完成）
 */
function sendSubscribeMessage() {
  return Promise.reject(new Error('应由云函数发送订阅消息'))
}

/**
 * 自动续授权检查
 */
function checkAndRenewSubscription() {
  const status = checkSubscriptionStatus()
  if (status === 'granted') {
    console.log('[Subscribe] 订阅授权有效，剩余配额', getRemainingQuota())
    return Promise.resolve(true)
  }
  console.log('[Subscribe] 需要续期，状态=' + status)
  return Promise.resolve(false)
}

function getSubscriptionDetail() {
  const status = wx.getStorageSync('subscription_status')
  const time = wx.getStorageSync('subscription_time')
  let daysRemaining = 0
  if (status === 'granted' && time) {
    daysRemaining = Math.max(0, 7 - (Date.now() - time) / (1000 * 60 * 60 * 24))
  }
  return {
    status: status || 'none',
    authorizedAt: time ? new Date(time).toISOString() : null,
    daysRemaining: Math.floor(daysRemaining),
    quota: getRemainingQuota(),
    needsRenew: status !== 'granted' || getRemainingQuota() <= 0
  }
}

module.exports = {
  requestSubscribeMessage,
  checkSubscriptionStatus,
  sendSubscribeMessage,
  checkAndRenewSubscription,
  getSubscriptionDetail,
  getAuthDaysRemaining,
  getRemainingQuota,
  consumeQuota,
  shouldAutoRequest,
  TEMPLATE_ID,
  AUTH_BATCH_SIZE
}
