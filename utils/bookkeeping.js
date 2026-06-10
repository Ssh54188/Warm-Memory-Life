/**
 * 记账数据工具
 * 本地存储 + 云端同步，分类枚举，月度统计
 */
const storage = require('./storage')

const STORAGE_KEY = 'bookkeeping'

/** 支出分类 */
const EXPENSE_CATS = [
  { key: 'dining', label: '餐饮',   emoji: '🍽️' },
  { key: 'transport', label: '交通', emoji: '🚗' },
  { key: 'shopping', label: '购物',  emoji: '🛍️' },
  { key: 'housing', label: '住房',   emoji: '🏠' },
  { key: 'entertain', label: '娱乐', emoji: '🎮' },
  { key: 'medical', label: '医疗',   emoji: '💊' },
  { key: 'education', label: '教育', emoji: '📚' },
  { key: 'daily', label: '日用',     emoji: '🧴' },
  { key: 'social', label: '社交',    emoji: '🎁' },
  { key: 'other_expense', label: '其他', emoji: '💸' }
]

/** 收入分类 */
const INCOME_CATS = [
  { key: 'salary', label: '工资',     emoji: '💼' },
  { key: 'bonus', label: '奖金',      emoji: '🧧' },
  { key: 'parttime', label: '兼职',   emoji: '🔧' },
  { key: 'invest', label: '投资收益', emoji: '📈' },
  { key: 'redpacket', label: '红包',  emoji: '🧨' },
  { key: 'other_income', label: '其他', emoji: '💰' }
]

/** 生成唯一 ID */
function genId() {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

/** 今天日期 YYYY-MM-DD */
function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ============================================================
//  CRUD
// ============================================================

/** 读取全部记录 */
function getAll() {
  return storage.get(STORAGE_KEY, [])
}

/** 保存全部记录 */
function saveAll(list) {
  storage.set(STORAGE_KEY, list)
}

/** 添加一条记录 */
function add(txn) {
  const item = {
    id: genId(),
    type: txn.type,           // 'income' | 'expense'
    amount: txn.amount,       // 单位：分
    category: txn.category,
    date: txn.date || today(),
    note: txn.note || '',
    createdAt: Date.now()
  }
  const list = getAll()
  list.unshift(item)
  saveAll(list)

  // 异步同步到云端
  syncToCloud('add', item)
  return item
}

/** 删除一条记录 */
function remove(id) {
  let list = getAll()
  const idx = list.findIndex(t => t.id === id)
  if (idx === -1) return false
  const removed = list.splice(idx, 1)[0]
  saveAll(list)
  syncToCloud('remove', { id })
  return true
}

/** 更新一条记录 */
function update(id, patch) {
  const list = getAll()
  const idx = list.findIndex(t => t.id === id)
  if (idx === -1) return false
  list[idx] = { ...list[idx], ...patch, id }
  saveAll(list)
  syncToCloud('update', list[idx])
  return true
}

// ============================================================
//  统计
// ============================================================

/** 获取某月所有记录 */
function getByMonth(year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return getAll().filter(t => t.date && t.date.startsWith(prefix))
}

/** 获取某日所有记录 */
function getByDate(date) {
  return getAll().filter(t => t.date === date)
}

/** 月度统计 */
function monthlyStats(year, month) {
  const records = getByMonth(year, month)
  let totalIncome = 0
  let totalExpense = 0
  const byCategory = {}

  records.forEach(t => {
    if (t.type === 'income') {
      totalIncome += t.amount
    } else {
      totalExpense += t.amount
    }
    const cat = t.category || 'other_expense'
    if (!byCategory[cat]) byCategory[cat] = { income: 0, expense: 0 }
    if (t.type === 'income') {
      byCategory[cat].income += t.amount
    } else {
      byCategory[cat].expense += t.amount
    }
  })

  // 补充分类 label / emoji
  Object.keys(byCategory).forEach(key => {
    const info = getCategoryInfo(key, byCategory[key].expense > 0 ? 'expense' : 'income')
    byCategory[key].label = info.label
    byCategory[key].emoji = info.emoji
  })

  return {
    month: `${year}-${String(month).padStart(2, '0')}`,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    count: records.length,
    byCategory
  }
}

/** 今日统计 */
function todayStats() {
  const date = today()
  const records = getByDate(date)
  let income = 0
  let expense = 0
  records.forEach(t => {
    if (t.type === 'income') income += t.amount
    else expense += t.amount
  })
  return { date, income, expense, count: records.length }
}

// ============================================================
//  云端同步
// ============================================================

function syncToCloud(action, data) {
  if (!wx.cloud) return
  wx.cloud.callFunction({
    name: 'syncBookkeeping',
    data: { action, data }
  }).then(res => {
    console.log('[Bookkeeping] 云端同步成功', res.result)
  }).catch(err => {
    console.error('[Bookkeeping] 云端同步失败', err)
  })
}

/** 从云端全量拉取并合并 */
async function pullFromCloud() {
  if (!wx.cloud) return
  try {
    const res = await wx.cloud.callFunction({
      name: 'syncBookkeeping',
      data: { action: 'load' }
    })
    if (res.result && res.result.success && res.result.list) {
      const localList = getAll()
      const cloudIds = new Set(res.result.list.map(t => t.id))
      // 合并：云端有本地没有的 → 追加
      const merged = res.result.list.slice()
      localList.forEach(t => {
        if (!cloudIds.has(t.id)) merged.push(t)
      })
      // 按时间倒序
      merged.sort((a, b) => b.createdAt - a.createdAt)
      saveAll(merged)
      return merged.length - localList.length
    }
  } catch (err) {
    console.error('[Bookkeeping] 云端拉取失败', err)
  }
}

// ============================================================
//  格式化
// ============================================================

/** 金额 分 → 元字符串 */
function formatAmount(fen) {
  return (fen / 100).toFixed(2)
}

/** 金额 分 → 带正负号的显示 */
function formatSigned(fen, type) {
  const sign = type === 'income' ? '+' : '-'
  return `${sign}${formatAmount(fen)}`
}

/** 根据分类 key 获取分类信息 */
function getCategoryInfo(key, type) {
  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS
  return cats.find(c => c.key === key) || { key, label: key, emoji: '📌' }
}

module.exports = {
  EXPENSE_CATS,
  INCOME_CATS,
  getAll,
  saveAll,
  add,
  remove,
  update,
  getByMonth,
  getByDate,
  monthlyStats,
  todayStats,
  pullFromCloud,
  formatAmount,
  formatSigned,
  getCategoryInfo
}
