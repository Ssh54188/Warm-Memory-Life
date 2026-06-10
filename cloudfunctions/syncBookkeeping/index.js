/**
 * syncBookkeeping — 记账数据云端同步
 *
 * 依赖数据库集合（需手动创建）：
 *   transactions — 交易记录
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action, data } = event
  const { OPENID } = cloud.getWXContext()
  const coll = db.collection('transactions')

  switch (action) {
    case 'add':
      return handleAdd(coll, OPENID, data)
    case 'update':
      return handleUpdate(coll, OPENID, data)
    case 'remove':
      return handleRemove(coll, OPENID, data)
    case 'load':
      return handleLoad(coll, OPENID)
    case 'monthStats':
      return handleMonthStats(coll, OPENID, event.year, event.month)
    default:
      return { success: false, error: '未知 action: ' + action }
  }
}

async function handleAdd(coll, openId, data) {
  try {
    data._openid = openId
    data.createdAt = Date.now()
    await coll.add({ data })
    return { success: true, action: 'add' }
  } catch (e) {
    if (e.errCode === -502005) return { success: false, error: '集合 transactions 不存在' }
    return { success: false, error: e.message }
  }
}

async function handleUpdate(coll, openId, data) {
  try {
    const existing = await coll.where({ id: data.id, _openid: openId }).limit(1).get()
    if (existing.data.length === 0) {
      return { success: false, error: '记录不存在' }
    }
    await coll.doc(existing.data[0]._id).update({
      data: {
        type: data.type,
        amount: data.amount,
        category: data.category,
        date: data.date,
        note: data.note || '',
        updatedAt: Date.now()
      }
    })
    return { success: true, action: 'update' }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

async function handleRemove(coll, openId, data) {
  try {
    await coll.where({ id: data.id, _openid: openId }).remove()
    return { success: true, action: 'remove' }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

async function handleLoad(coll, openId) {
  try {
    const res = await coll.where({ _openid: openId }).orderBy('createdAt', 'desc').limit(500).get()
    return { success: true, list: res.data }
  } catch (e) {
    if (e.errCode === -502005) return { success: false, error: '集合 transactions 不存在' }
    return { success: false, error: e.message }
  }
}

async function handleMonthStats(coll, openId, year, month) {
  try {
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    const res = await coll.where({
      _openid: openId,
      date: db.RegExp({ regexp: `^${prefix}`, options: '' })
    }).get()
    return { success: true, list: res.data }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
