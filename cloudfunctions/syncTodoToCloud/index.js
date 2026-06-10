/**
 * 云函数 - syncTodoToCloud
 * 功能：同步待办数据到云端数据库
 *
 * 调用方式：
 * - 新增/更新：wx.cloud.callFunction({ name: 'syncTodoToCloud', data: { action: 'upsert', todo: {...} } })
 * - 删除：wx.cloud.callFunction({ name: 'syncTodoToCloud', data: { action: 'delete', todoId: 'xxx' } })
 * - 查询：wx.cloud.callFunction({ name: 'syncTodoToCloud', data: { action: 'query', date: '2024-01-01' } })
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID, APPID } = cloud.getWXContext()
  const { action, todo, todoId, date } = event

  if (!OPENID) {
    return { code: -1, message: '未获取到用户信息' }
  }

  try {
    if (action === 'upsert') {
      // 新增或更新待办
      if (!todo || !todo.id) {
        return { code: -1, message: '待办数据不完整' }
      }

      const query = {
        _openid: OPENID,
        id: todo.id
      }

      const existRes = await db.collection('todos').where(query).get()

      if (existRes.data.length > 0) {
        // 更新
        await db.collection('todos').doc(existRes.data[0]._id).update({
          data: {
            text: todo.text,
            priority: todo.priority,
            done: todo.done,
            date: todo.date,
            updatedAt: new Date()
          }
        })
        return { code: 0, message: '更新成功' }
      } else {
        // 新增
        await db.collection('todos').add({
          data: {
            _openid: OPENID,
            id: todo.id,
            text: todo.text,
            priority: todo.priority,
            done: todo.done,
            date: todo.date,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        })
        return { code: 0, message: '添加成功' }
      }
    }

    if (action === 'delete') {
      // 删除待办
      if (!todoId) {
        return { code: -1, message: '缺少待办ID' }
      }

      const query = {
        _openid: OPENID,
        id: todoId
      }

      const existRes = await db.collection('todos').where(query).get()

      if (existRes.data.length > 0) {
        await db.collection('todos').doc(existRes.data[0]._id).remove()
        return { code: 0, message: '删除成功' }
      }

      return { code: 0, message: '待办不存在' }
    }

    if (action === 'query') {
      // 查询待办
      const query = { _openid: OPENID }
      if (date) {
        query.date = date
      }

      const res = await db.collection('todos').where(query).orderBy('createdAt', 'desc').get()
      return { code: 0, data: res.data }
    }

    return { code: -1, message: '未知操作类型' }
  } catch (err) {
    console.error('[syncTodoToCloud] 错误', err)
    return { code: -1, error: err.message }
  }
}
