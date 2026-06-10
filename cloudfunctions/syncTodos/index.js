/**
 * 云函数 - syncTodos
 * 功能：批量同步某天的待办数据到云端
 *
 * 调用方式：
 * wx.cloud.callFunction({
 *   name: 'syncTodos',
 *   data: { date: '2024-01-01', todos: [...] }
 * })
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID, APPID } = cloud.getWXContext()
  const { date, todos } = event

  if (!OPENID) {
    return { code: -1, message: '未获取到用户信息' }
  }

  if (!date) {
    return { code: -1, message: '缺少日期参数' }
  }

  try {
    // 1. 删除云端该日期的旧数据
    const oldRes = await db.collection('todos').where({
      _openid: OPENID,
      date: date
    }).get()

    for (const doc of oldRes.data) {
      await db.collection('todos').doc(doc._id).remove()
    }

    // 2. 批量写入新数据
    if (todos && todos.length > 0) {
      const docs = todos.map(todo => ({
        _openid: OPENID,
        id: todo.id,
        text: todo.text,
        priority: todo.priority,
        done: todo.done,
        date: date,
        createdAt: todo.createdAt ? new Date(todo.createdAt) : new Date(),
        updatedAt: new Date()
      }))

      // 分批写入（每次最多100条）
      const batchSize = 100
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = docs.slice(i, i + batchSize)
        await db.collection('todos').add({
          data: batch
        })
      }
    }

    return {
      code: 0,
      message: `同步成功，共 ${todos ? todos.length : 0} 条`,
      count: todos ? todos.length : 0
    }
  } catch (err) {
    console.error('[syncTodos] 错误', err)
    return { code: -1, error: err.message }
  }
}
