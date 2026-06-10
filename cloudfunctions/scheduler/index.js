/**
 * 云函数 - scheduler
 * 功能：定时扫描待办事项，发送订阅消息提醒 + 诊断模式
 *
 * 部署说明：
 * 1. 上传云函数时 config.json 中的定时触发器会自动创建
 * 2. 默认每30分钟触发一次，扫描当前时间段需要提醒的用户
 * 3. 需在微信公众平台申请订阅消息模板，并填入下方 TEMPLATE_ID
 * 4. 用户需先在小程序端授权订阅消息，否则发送会失败（静默跳过）
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// ★ 替换为你在微信公众平台申请的订阅消息模板 ID
const TEMPLATE_ID = 'wqxj0PzSpIuig2db0DS4tgdJeyoBexxq_FntttyROO0'

/**
 * 主函数
 */
exports.main = async (event, context) => {
  const { action = 'scan', time } = event
  const now = new Date()
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const targetTime = time || nowTime

  console.log(`[Scheduler] 开始执行，动作：${action}，当前时间：${nowTime}，目标时间：${targetTime}`)

  try {
    if (action === 'scan') {
      return await scanAndNotify(targetTime)
    }
    if (action === 'diagnose') {
      return await diagnose()
    }
    return { success: false, message: '未知操作类型' }
  } catch (err) {
    console.error('[Scheduler] 执行失败', err)
    return { success: false, error: err.message, stack: err.stack }
  }
}

/**
 * ★ 一键诊断：逐步检查整个提醒链路
 * 从小程序端调用：cloud.callFunction({ name: 'scheduler', data: { action: 'diagnose' } })
 */
async function diagnose() {
  const { OPENID } = cloud.getWXContext()
  const report = { steps: [], overall: '' }
  const today = formatDate(new Date())

  // ---- Step 1: 检查 user_settings 集合 ----
  try {
    const settingsRes = await db.collection('user_settings').where({ _openid: OPENID }).get()
    if (settingsRes.data.length === 0) {
      report.steps.push({ step: 1, name: '云端提醒设置', status: 'fail', detail: '未找到记录。请在小程序中开启提醒开关并保存。', hint: '重新打开提醒开关触发云端同步' })
    } else {
      const s = settingsRes.data[0]
      report.steps.push({
        step: 1, name: '云端提醒设置', status: 'ok',
        detail: `已开启=${s.reminder?.enabled}, 时间=${s.reminder?.time}, updatedAt=${s.reminder?.updatedAt}`
      })
    }
  } catch (e) {
    report.steps.push({ step: 1, name: '云端提醒设置', status: 'error', detail: `查询失败: ${e.message}。请确认 user_settings 集合已创建。` })
  }

  // ---- Step 2: 检查 todos 集合 ----
  try {
    const todosRes = await db.collection('todos').where({ _openid: OPENID, date: today }).get()
    const undone = todosRes.data.filter(t => !t.done)
    report.steps.push({
      step: 2, name: '今日待办数据', status: todosRes.data.length > 0 ? 'ok' : 'warn',
      detail: `云端共 ${todosRes.data.length} 条，未完成 ${undone.length} 条。${todosRes.data.length === 0 ? '（今天还同步过待办，去待办页操作一下触发同步）' : ''}`
    })
  } catch (e) {
    report.steps.push({ step: 2, name: '今日待办数据', status: 'error', detail: `查询失败: ${e.message}。请确认 todos 集合已创建。` })
  }

  // ---- Step 3: 尝试发送一条测试订阅消息 ----
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: OPENID,
      templateId: TEMPLATE_ID,
      page: 'pages/todo/todo',
      data: {
        thing26: { value: '这是一条诊断测试消息' },
        phrase25: { value: '待测试' },
        phrase9: { value: '一般' },
        time10: { value: formatDateCN(new Date()) },
        thing17: { value: '今日任务' }
      }
    })
    report.steps.push({ step: 3, name: '发送测试消息', status: 'ok', detail: 'API 调用成功，应在手机微信收到订阅消息。如果没收到，请检查微信设置→订阅消息是否已授权。' })
  } catch (e) {
    let hint = ''
    if (e.errCode === 43101) hint = '→ 用户拒绝了订阅或未授权，请重新授权'
    else if (e.errCode === 47003) hint = '→ 模板参数错误，字段名与模板不匹配，请检查模板详情'
    else if (e.errCode === 40003) hint = '→ openid 无效'
    else if (e.message.includes('not authorized')) hint = '→ 云环境未开通"订阅消息"能力，需在云开发控制台→设置→全局设置中开通'
    report.steps.push({
      step: 3, name: '发送测试消息', status: 'fail',
      detail: `errCode=${e.errCode || '-'}, errMsg=${e.message} ${hint}`
    })
  }

  // ---- Step 4: 检查 push_logs 集合（历史推送记录） ----
  try {
    const logsRes = await db.collection('push_logs').where({ _openid: OPENID }).orderBy('pushTime', 'desc').limit(3).get()
    report.steps.push({
      step: 4, name: '历史推送记录', status: 'ok',
      detail: `共 ${logsRes.data.length} 条（近3条）。${logsRes.data.map(l => `${formatLocalTime(l.pushTime)} ${l.status}`).join(' | ') || '无'}`
    })
  } catch (e) {
    report.steps.push({ step: 4, name: '历史推送记录', status: 'warn', detail: `查询失败: ${e.message}。push_logs 集合可能未创建。` })
  }

  // ---- 汇总 ----
  const failCount = report.steps.filter(s => s.status === 'fail' || s.status === 'error').length
  report.overall = failCount === 0 ? '链路正常 ✓' : `发现 ${failCount} 个问题，请逐条检查`

  return { success: true, ...report }
}

/**
 * 扫描需要提醒的用户并发送订阅消息
 */
async function scanAndNotify(targetTime) {
  const usersRes = await db.collection('user_settings').where({
    'reminder.enabled': true,
    'reminder.time': targetTime
  }).get()

  const users = usersRes.data
  console.log(`[Scheduler] 找到 ${users.length} 个需要提醒的用户（时间：${targetTime}）`)

  if (users.length === 0) {
    return { success: true, message: '没有需要提醒的用户', count: 0 }
  }

  const notifyList = []

  for (const user of users) {
    const openid = user._openid
    if (!openid) continue

    // ★ 检查消息配额
    const quota = user.reminder?.subscriptionQuota || 0
    if (quota <= 0) {
      console.log(`[Scheduler] ${openid} 配额已用完，跳过`)
      continue
    }

    const today = formatDate(new Date())
    const todosRes = await db.collection('todos').where({
      _openid: openid,
      date: today,
      done: false
    }).get()

    const unfinishedTodos = todosRes.data

    if (unfinishedTodos.length > 0) {
      notifyList.push({
        openid,
        todoCount: unfinishedTodos.length,
        todos: unfinishedTodos.slice(0, 5).map(t => t.text),
        reminderTime: user.reminder.time
      })
    }
  }

  console.log(`[Scheduler] 有 ${notifyList.length} 个用户待发送提醒`)

  if (notifyList.length > 0) {
    const sendResult = await sendReminders(notifyList)

    for (const item of notifyList) {
      await logPush(item.openid, item.todoCount, sendResult[item.openid])

      // ★ 发送成功后扣减配额
      if (sendResult[item.openid] === 'sent') {
        await decrementQuota(item.openid)
      }
    }

    return {
      success: true,
      message: `已处理 ${notifyList.length} 个用户的提醒`,
      count: notifyList.length,
      sendResult
    }
  }

  return { success: true, message: '没有未完成的待办', count: 0 }
}

/**
 * 向用户发送订阅消息
 * 需要用户之前已授权该模板 ID，否则会静默失败
 */
async function sendReminders(notifyList) {
  const results = {}

  for (const item of notifyList) {
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: item.openid,
        templateId: TEMPLATE_ID,
        page: 'pages/todo/todo',
        data: {
          thing26: { value: item.todos.join(' | ') },
          phrase25: { value: `共 ${item.todoCount} 项待办` },
          phrase9: { value: item.todoCount > 3 ? '紧急' : '一般' },
          time10: { value: formatDateCN(new Date()) },
          thing17: { value: '今日任务' }
        }
      })

      results[item.openid] = 'sent'
      console.log(`[Scheduler] 提醒发送成功 → ${item.openid}`)
    } catch (err) {
      results[item.openid] = 'failed'
      console.warn(`[Scheduler] 提醒发送失败 → ${item.openid}`, err.errCode, err.message)
    }
  }

  return results
}

/**
 * 记录推送日志
 */
async function logPush(openid, todoCount, status) {
  try {
    await db.collection('push_logs').add({
      data: {
        _openid: openid,
        todoCount,
        status,
        pushTime: new Date(),
        createdAt: new Date()
      }
    })
  } catch (err) {
    console.error('[Scheduler] 记录日志失败', err)
  }
}

/**
 * ★ 扣减消息配额
 */
async function decrementQuota(openid) {
  try {
    const _ = db.command
    await db.collection('user_settings').where({ _openid: openid }).update({
      data: {
        'reminder.subscriptionQuota': _.inc(-1),
        'reminder.updatedAt': new Date().toISOString()
      }
    })
    console.log(`[Scheduler] 配额扣减成功 → ${openid}`)
  } catch (err) {
    console.error(`[Scheduler] 配额扣减失败 → ${openid}`, err)
  }
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateCN(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

function formatNow() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatLocalTime(date) {
  if (!date) return '-'
  const d = new Date(date)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
