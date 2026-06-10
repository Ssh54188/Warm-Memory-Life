/**
 * syncUserInfo — 用户信息云端同步
 *
 * 支持的 action：
 *   save         — 保存/更新用户信息到 users 集合（自动关联 openId）
 *   load         — 从 users 集合加载用户信息
 *   decryptPhone — 解密微信手机号（需 code from bindgetphonenumber）
 *   getOpenId    — 仅返回当前用户的 openId（用于验证登录态）
 *
 * 依赖数据库集合（需在云开发控制台手动创建）：
 *   users — _openid 自动由微信云开发填入，文档字段见下方 schema
 *
 * 注意：decryptPhone 需要云函数有 openapi.phonenumber 权限
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) {
    return { success: false, error: '无法获取 openId，请先调用 wx.login()' }
  }

  switch (action) {
    case 'save':
      return handleSave(event, OPENID)
    case 'load':
      return handleLoad(OPENID)
    case 'decryptPhone':
      return handleDecryptPhone(event, OPENID)
    case 'getOpenId':
      return { success: true, openId: OPENID }
    default:
      return { success: false, error: '未知操作: ' + action }
  }
}

/**
 * 保存用户信息
 * event.userInfo: { nickName, avatarUrl, phone, gender, age, occupation, wechatName, ... }
 */
async function handleSave(event, openId) {
  const { userInfo } = event
  if (!userInfo || typeof userInfo !== 'object') {
    return { success: false, error: '缺少 userInfo 参数' }
  }

  // 白名单：只允许写入已知字段
  const allowedFields = [
    'nickName', 'avatarUrl', 'phone', 'gender', 'age',
    'occupation', 'wechatName', 'email'
  ]
  const data = {}
  const now = new Date()
  for (const key of allowedFields) {
    if (userInfo[key] !== undefined && userInfo[key] !== null) {
      data[key] = userInfo[key]
    }
  }
  data.updatedAt = now

  const usersColl = db.collection('users')

  try {
    // 查询是否已有记录（通过 _openid）
    const existing = await usersColl.where({ _openid: openId }).limit(1).get()

    if (existing.data.length > 0) {
      // 更新已有记录
      await usersColl.doc(existing.data[0]._id).update({ data })
      return {
        success: true,
        action: 'updated',
        userId: existing.data[0].userId || ''
      }
    } else {
      // 新建记录
      data.createdAt = now
      data._openid = openId
      const addRes = await usersColl.add({ data })
      return {
        success: true,
        action: 'created',
        _id: addRes._id
      }
    }
  } catch (e) {
    // 集合不存在
    if (e.errCode === -502005) {
      return {
        success: false,
        error: '集合 users 不存在，请在云开发控制台手动创建'
      }
    }
    return { success: false, error: '保存失败: ' + (e.errMsg || e.message || '') }
  }
}

/**
 * 加载用户信息
 */
async function handleLoad(openId) {
  const usersColl = db.collection('users')

  try {
    const res = await usersColl.where({ _openid: openId }).limit(1).get()
    if (res.data.length > 0) {
      const user = res.data[0]
      // 移除敏感/内部字段
      delete user._id
      delete user._openid
      delete user.createdAt
      return { success: true, userInfo: user }
    } else {
      return { success: true, userInfo: null, message: '未找到云端用户数据' }
    }
  } catch (e) {
    if (e.errCode === -502005) {
      return { success: false, error: '集合 users 不存在，请在云开发控制台手动创建' }
    }
    return { success: false, error: '加载失败: ' + (e.errMsg || e.message || '') }
  }
}

/**
 * 解密手机号
 * event.code — 来自 bindgetphonenumber 事件 e.detail.code
 */
async function handleDecryptPhone(event, openId) {
  const { code } = event
  if (!code) {
    return { success: false, error: '缺少 code 参数' }
  }

  let phoneNumber
  try {
    const result = await cloud.openapi.phonenumber.getPhoneNumber({ code })
    phoneNumber = result.phoneInfo
      ? (result.phoneInfo.purePhoneNumber || result.phoneInfo.phoneNumber)
      : null

    if (!phoneNumber) {
      return { success: false, error: '解密手机号失败：未获取到号码' }
    }
  } catch (e) {
    // 常见错误码及用户友好提示
    if (e.errCode === -1) {
      return { success: false, error: '手机号解密系统错误，请确认已开通微信手机号快速验证能力' }
    }
    return { success: false, error: '解密失败: ' + (e.errMsg || e.message || '') }
  }

  // 解密成功 → 将手机号保存到用户数据
  const usersColl = db.collection('users')
  try {
    const existing = await usersColl.where({ _openid: openId }).limit(1).get()
    const now = new Date()
    if (existing.data.length > 0) {
      await usersColl.doc(existing.data[0]._id).update({
        data: { phone: phoneNumber, updatedAt: now }
      })
    } else {
      await usersColl.add({
        data: {
          _openid: openId,
          phone: phoneNumber,
          createdAt: now,
          updatedAt: now
        }
      })
    }
  } catch (e) {
    // 即使保存失败也返回手机号（前端可自行处理）
    if (e.errCode === -502005) {
      return {
        success: true,
        phoneNumber,
        warning: '手机号已解密但 users 集合不存在，已自动跳过云存储'
      }
    }
    return {
      success: true,
      phoneNumber,
      warning: '手机号已解密但保存失败: ' + (e.errMsg || e.message || '')
    }
  }

  return { success: true, phoneNumber }
}
