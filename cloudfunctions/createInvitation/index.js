const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

/**
 * 生成共享邀请码
 * 调用方式：wx.cloud.callFunction({ name: 'createInvitation', data: { type: 'todo' | 'calendar' } })
 * 返回：{ code: 'ABC12', expiresAt: 1234567890 }
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { type = 'todo' } = event // 'todo' 或 'calendar'

  if (!['todo', 'calendar'].includes(type)) {
    return { code: -1, message: 'type 必须是 todo 或 calendar' }
  }

  // 生成6位邀请码
  const code = Math.random().toString(36).substring(2, 8).toUpperCase()

  // 存储到数据库
  await db.collection('share_invitations').add({
    data: {
      code,
      creatorOpenid: openid,
      type, // 'todo' 或 'calendar'
      status: 'pending', // pending | accepted | expired
      createdAt: db.serverDate(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时过期
    }
  })

  return {
    code: 0,
    data: { code, type }
  }
}
