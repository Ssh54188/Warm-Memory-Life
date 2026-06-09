const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

/**
 * 接受共享邀请
 * 调用方式：wx.cloud.callFunction({ name: 'acceptInvitation', data: { code: 'ABC123' } })
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { code } = event

  if (!code) {
    return { code: -1, message: '缺少邀请码' }
  }

  // 查找邀请
  const invitations = await db.collection('share_invitations')
    .where({ code: code.toUpperCase(), status: 'pending' })
    .get()

  if (invitations.data.length === 0) {
    return { code: -1, message: '邀请码无效或已过期' }
  }

  const invitation = invitations.data[0]

  // 检查是否自己接受自己的邀请
  if (invitation.fromOpenid === openid) {
    return { code: -1, message: '不能接受自己的邀请' }
  }

  // 检查是否已经存在共享关系
  const existingPair = await db.collection('shared_pairs')
    .where({
      type: invitation.type,
      $or: [
        { userA: openid, userB: invitation.creatorOpenid },
        { userA: invitation.creatorOpenid, userB: openid }
      ]
    })
    .get()

  if (existingPair.data.length > 0) {
    return { code: -1, message: '已经存在共享关系' }
  }

  // 创建共享关系
  await db.collection('shared_pairs').add({
    data: {
      userA: invitation.creatorOpenid,
      userB: openid,
      type: invitation.type, // 'todo' 或 'calendar'
      createdAt: db.serverDate(),
      status: 'active'
    }
  })

  // 更新邀请状态
  await db.collection('share_invitations').doc(invitation._id).update({
    data: { status: 'accepted', acceptedBy: openid, acceptedAt: db.serverDate() }
  })

  return {
    code: 0,
    message: '接受邀请成功',
    data: { type: invitation.type }
  }
}
