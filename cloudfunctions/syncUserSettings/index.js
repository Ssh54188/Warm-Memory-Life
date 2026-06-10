/**
 * 云函数 - syncUserSettings
 * 功能：同步用户设置到云端
 *
 * 调用方式：
 * - 保存：wx.cloud.callFunction({ name: 'syncUserSettings', data: { type: 'reminder', data: {...} } })
 * - 读取：wx.cloud.callFunction({ name: 'syncUserSettings', data: { type: 'reminder', action: 'get' } })
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID, APPID } = cloud.getWXContext()
  const { type, data, action } = event

  if (!OPENID) {
    return { success: false, message: '未获取到用户信息' }
  }

  try {
    // 查询用户设置
    const settingsRes = await db.collection('user_settings').where({
      _openid: OPENID
    }).get()

    if (action === 'get') {
      // 读取设置
      if (settingsRes.data.length > 0) {
        const settings = settingsRes.data[0]
        if (type === 'reminder') {
          return { success: true, data: settings.reminder || {} }
        }
        return { success: true, data: settings }
      }
      return { success: true, data: {} }
    }

    // 保存设置
    if (type === 'reminder') {
      const reminderData = {
        enabled: data.enabled || false,
        time: data.time || '09:00',
        subscriptionQuota: data.subscriptionQuota != null ? data.subscriptionQuota : 0,
        updatedAt: new Date()
      }

      if (settingsRes.data.length > 0) {
        // 更新
        await db.collection('user_settings').doc(settingsRes.data[0]._id).update({
          data: { reminder: reminderData }
        })
      } else {
        // 新建
        await db.collection('user_settings').add({
          data: {
            _openid: OPENID,
            reminder: reminderData,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        })
      }

      return { success: true, message: '提醒设置已保存' }
    }

    return { success: false, message: '未知的设置类型' }
  } catch (err) {
    console.error('[syncUserSettings] 错误', err)
    return { success: false, error: err.message }
  }
}
