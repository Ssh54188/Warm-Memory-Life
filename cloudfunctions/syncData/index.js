const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

/**
 * 同步数据（创建/更新/删除/取消共享）
 * 调用方式：wx.cloud.callFunction({
 *   name: 'syncData',
 *   data: { 
 *     type: 'todo' | 'calendar', 
 *     action: 'add' | 'update' | 'delete' | 'disableShare'
 *     item: {...} 
 *   }
 * })
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { type, action, item } = event

  if (!['todo', 'calendar'].includes(type)) {
    return { code: -1, message: 'type 必须是 todo 或 calendar' }
  }

  if (!['add', 'update', 'delete', 'disableShare'].includes(action)) {
    return { code: -1, message: 'action 必须是 add、update、delete 或 disableShare' }
  }

  // 取消共享
  if (action === 'disableShare') {
    try {
      await db.collection('shared_pairs')
        .where({
          type,
          status: 'active',
          $or: [
            { userA: openid },
            { userB: openid }
          ]
        })
        .update({
          data: { status: 'disabled', disabledAt: db.serverDate() }
        })
      return { code: 0, message: '已取消共享' }
    } catch (err) {
      console.error('disableShare error:', err)
      return { code: -1, message: err.message || '取消共享失败' }
    }
  }

  const collection = db.collection(`${type}s`)

  try {
    if (action === 'add') {
      const result = await collection.add({
        data: {
          _id: item.id,      // 用本地 id 作为云端文档 id，保证更新/删除能对齐
          ...item,
          _openid: openid,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      })
      return { code: 0, data: { id: result._id }, message: '添加成功' }
    }

    if (action === 'update') {
      const { id, ...updateData } = item
      await collection.doc(id).update({
        data: {
          ...updateData,
          updatedAt: db.serverDate()
        }
      })
      return { code: 0, message: '更新成功' }
    }

    if (action === 'delete') {
      await collection.doc(item.id).remove()
      return { code: 0, message: '删除成功' }
    }
  } catch (err) {
    console.error('syncData error:', err)
    return { code: -1, message: err.message || '操作失败' }
  }
}
