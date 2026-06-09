const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

/**
 * 获取共享数据
 * 调用方式：wx.cloud.callFunction({ name: 'getSharedData', data: { type: 'todo' | 'calendar', date: '2026-06-09' } })
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { type, date } = event

  if (!['todo', 'calendar'].includes(type)) {
    return { code: -1, message: 'type 必须是 todo 或 calendar' }
  }

  // 查找共享关系
  const pairs = await db.collection('shared_pairs')
    .where({
      type,
      status: 'active',
      $or: [
        { userA: openid },
        { userB: openid }
      ]
    })
    .get()

  if (pairs.data.length === 0) {
    return { code: 0, data: { items: [], partnerExists: false } }
  }

  const pair = pairs.data[0]
  const partnerOpenid = pair.userA === openid ? pair.userB : pair.userA

  // 获取对方的数据
  const partnerData = await db.collection(`${type}s`)
    .where({
      _openid: partnerOpenid,
      ...(date ? { date } : {})
    })
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get()

  // 获取自己的数据
  const myData = await db.collection(`${type}s`)
    .where({
      _openid: openid,
      ...(date ? { date } : {})
    })
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get()

  return {
    code: 0,
    data: {
      partnerExists: true,
      partnerOpenid,
      partnerItems: partnerData.data,
      myItems: myData.data
    }
  }
}
