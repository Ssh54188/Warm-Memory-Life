/**
 * 数据模型 & 核心 API — v1.0.2
 * 基于需求文档：date_YYYY-MM-DD 扁平键 + _habits(激活/停用) + _quadrants
 */
const storage = require('./storage')

const STORAGE_KEY = 'weekly-planner-data'
const DEFAULT_HABITS = [
  { name: '运动', active: true, emoji: '🏃', createdAt: '' },
  { name: '阅读', active: true, emoji: '📖', createdAt: '' },
  { name: '冥想', active: true, emoji: '🧘', createdAt: '' }
]

// ============================================================
//  工具函数
// ============================================================

/** 日期格式化 YYYY-MM-DD */
function fmtDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 生成唯一 ID */
function genId() {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

/** 获取某周的周一日期 */
function getMonday(date) {
  const d = date ? new Date(date) : new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return fmtDate(d)
}

/** 获取当前周的周一 */
function getCurrentWeekStart() {
  return getMonday(new Date())
}

/** 获取周偏移量的周一（offset: 0=本周, -1=上周, 1=下周） */
function getWeekByOffset(offset) {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1) + offset * 7)
  return fmtDate(monday)
}

/** 获取一周的所有日期 */
function getWeekDates(mondayStr) {
  const [y, m, d] = mondayStr.split('-').map(Number)
  const monday = new Date(y, m - 1, d)
  const dates = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    dates.push(fmtDate(date))
  }
  return dates
}

/** 获取年中的周数 */
function getWeekNumber(dateStr) {
  const d = new Date(dateStr)
  const start = new Date(d.getFullYear(), 0, 1)
  const diff = (d - start + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60000) / 86400000
  return Math.ceil((diff + start.getDay() + 1) / 7)
}

/** 星期标签 */
const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

// ============================================================
//  数据读写
// ============================================================

/** 加载全量数据 */
function loadAllData() {
  return storage.get(STORAGE_KEY, {})
}

/** 保存全量数据 */
function saveAllData(data) {
  return storage.set(STORAGE_KEY, data)
}

/** 获取某天的数据（无则返回 null） */
function getDateData(dateStr) {
  const all = loadAllData()
  return all[dateStr] || null
}

/** 确保某天数据存在并返回 */
function ensureDateData(dateStr) {
  const all = loadAllData()
  if (!all[dateStr]) {
    all[dateStr] = { todos: [], note: '' }
    saveAllData(all)
  }
  return all[dateStr]
}

/** 获取所有有数据的日期 */
function getAllDates() {
  const all = loadAllData()
  return Object.keys(all).filter(k => !k.startsWith('_'))
}

// ============================================================
//  待办事项 API
// ============================================================

/** 添加待办 */
function addTodo(dateStr, text, priority, quadrantTaskId) {
  const all = loadAllData()
  if (!all[dateStr]) all[dateStr] = { todos: [], note: '' }

  const todo = {
    id: genId(),
    text,
    done: false,
    priority: priority || 'low',
    quadrantTaskId: quadrantTaskId || null,
    createdAt: new Date().toISOString()
  }
  all[dateStr].todos.push(todo)
  saveAllData(all)
  return todo
}

/** 切换待办完成状态 */
function toggleTodo(dateStr, todoId) {
  const all = loadAllData()
  const dayData = all[dateStr]
  if (!dayData) return false

  const todo = dayData.todos.find(t => t.id === todoId)
  if (!todo) return false

  todo.done = !todo.done
  saveAllData(all)
  return todo.done
}

/** 删除待办 */
function deleteTodo(dateStr, todoId) {
  const all = loadAllData()
  const dayData = all[dateStr]
  if (!dayData) return false

  const idx = dayData.todos.findIndex(t => t.id === todoId)
  if (idx === -1) return false

  dayData.todos.splice(idx, 1)
  saveAllData(all)
  return true
}

/** 获取某天待办统计 */
function getDateTodoStats(dateStr) {
  const dayData = getDateData(dateStr)
  if (!dayData || !dayData.todos) return { total: 0, done: 0, rate: 0 }
  const total = dayData.todos.length
  const done = dayData.todos.filter(t => t.done).length
  return { total, done, rate: total > 0 ? Math.round((done / total) * 100) : 0 }
}

/** 清理某天已完成待办 */
function clearDoneTodos(dateStr) {
  const all = loadAllData()
  const dayData = all[dateStr]
  if (!dayData) return 0

  const before = dayData.todos.length
  dayData.todos = dayData.todos.filter(t => !t.done)
  const removed = before - dayData.todos.length
  saveAllData(all)
  return removed
}

/** 获取某周所有待办的完成率 */
function getWeekTodoStats(mondayStr) {
  const dates = getWeekDates(mondayStr)
  let total = 0, done = 0
  dates.forEach(d => {
    const s = getDateTodoStats(d)
    total += s.total
    done += s.done
  })
  return { total, done, rate: total > 0 ? Math.round((done / total) * 100) : 0 }
}

// ============================================================
//  习惯 API（v1.0.2 支持激活/停用）
// ============================================================

/** 获取习惯列表 */
function getHabits() {
  const all = loadAllData()
  if (!all._habits || !Array.isArray(all._habits) || all._habits.length === 0) {
    all._habits = DEFAULT_HABITS.map(h => ({ ...h, createdAt: new Date().toISOString() }))
    saveAllData(all)
  }
  return all._habits
}

/** 获取激活的习惯名称列表 */
function getActiveHabits() {
  return getHabits().filter(h => h.active !== false).map(h => h.name)
}

/** 添加习惯 */
function addHabit(name, emoji) {
  const all = loadAllData()
  if (!all._habits) all._habits = []

  if (all._habits.some(h => h.name === name)) return false

  all._habits.push({
    name,
    active: true,
    emoji: emoji || '⭐',
    createdAt: new Date().toISOString()
  })
  saveAllData(all)
  return true
}

/** 切换习惯激活状态 */
function toggleHabitActive(name) {
  const all = loadAllData()
  const habit = (all._habits || []).find(h => h.name === name)
  if (!habit) return false

  habit.active = !habit.active
  saveAllData(all)
  return habit.active
}

/** 删除习惯（保留历史打卡数据） */
function deleteHabit(name) {
  const all = loadAllData()
  const idx = (all._habits || []).findIndex(h => h.name === name)
  if (idx === -1) return false

  all._habits.splice(idx, 1)
  saveAllData(all)
  return true
}

/** 获取习惯打卡状态（读取，不写入） */
function getHabitChecks(dateStr) {
  const all = loadAllData()
  if (!all._habitChecks) return {}
  return all._habitChecks[dateStr] || {}
}

/** 切换打卡（支持 duration 参数，分钟数） */
function toggleHabitCheck(dateStr, habitName, duration) {
  const all = loadAllData()
  if (!all._habitChecks) all._habitChecks = {}
  if (!all._habitChecks[dateStr]) all._habitChecks[dateStr] = {}

  const current = all._habitChecks[dateStr][habitName]

  // 如果已打卡，取消打卡
  if (current) {
    delete all._habitChecks[dateStr][habitName]
    saveAllData(all)
    return null
  }

  // 新打卡，存储 { checked: true, duration }
  all._habitChecks[dateStr][habitName] = {
    checked: true,
    duration: duration || 0
  }
  saveAllData(all)
  return all._habitChecks[dateStr][habitName]
}

/** 获取习惯周统计 */
function getHabitWeekStats(mondayStr) {
  const dates = getWeekDates(mondayStr)
  const activeHabits = getActiveHabits()
  const all = loadAllData()

  let todayDone = 0, weekDone = 0
  const totalPossible = activeHabits.length * 7
  const todayStr = fmtDate(new Date())

  dates.forEach(d => {
    const checks = (all._habitChecks && all._habitChecks[d]) || {}
    activeHabits.forEach(h => {
      if (checks[h]) {
        weekDone++
        if (d === todayStr) todayDone++
      }
    })
  })

  return {
    todayDone,
    weekDone,
    totalPossible,
    rate: totalPossible > 0 ? Math.round((weekDone / totalPossible) * 100) : 0
  }
}

/** 获取周打卡矩阵（用于表格展示） */
function getHabitWeekMatrix(mondayStr) {
  const dates = getWeekDates(mondayStr)
  const activeHabits = getActiveHabits()
  const all = loadAllData()

  return activeHabits.map(h => ({
    name: h,
    checks: dates.map(d => {
      const checks = (all._habitChecks && all._habitChecks[d]) || {}
      return !!checks[h]
    })
  }))
}

// ============================================================
//  笔记 API
// ============================================================

/** 保存笔记 */
function saveNote(dateStr, content) {
  const all = loadAllData()
  if (!all[dateStr]) all[dateStr] = { todos: [], note: '' }
  all[dateStr].note = content
  saveAllData(all)
  return true
}

/** 获取笔记 */
function getNote(dateStr) {
  const dayData = getDateData(dateStr)
  return dayData ? (dayData.note || '') : ''
}

/** 获取所有有笔记的日期列表（倒序） */
function getNoteDates() {
  const all = loadAllData()
  return Object.keys(all)
    .filter(k => !k.startsWith('_') && all[k].note && all[k].note.trim().length > 0)
    .sort()
    .reverse()
}

/** 获取最近一条笔记 */
function getLatestNote() {
  const all = loadAllData()
  const dates = Object.keys(all)
    .filter(k => !k.startsWith('_') && all[k].note && all[k].note.trim().length > 0)
    .sort()
    .reverse()
  if (dates.length === 0) return null

  const d = new Date(dates[0])
  return {
    date: `${d.getMonth() + 1}月${d.getDate()}日`,
    content: all[dates[0]].note,
    preview: all[dates[0]].note.substring(0, 50)
  }
}

// ============================================================
//  四象限 API
// ============================================================

const QUADRANT_KEYS = ['urgent-important', 'not-urgent-important', 'urgent-not-important', 'not-urgent-not-important']
const QUADRANT_LABELS = {
  'urgent-important': '重要且紧急',
  'not-urgent-important': '重要不紧急',
  'urgent-not-important': '紧急不重要',
  'not-urgent-not-important': '不重要不紧急'
}
const QUADRANT_COLORS = {
  'urgent-important': '#e74c3c',
  'not-urgent-important': '#27ae60',
  'urgent-not-important': '#f39c12',
  'not-urgent-not-important': '#95a5a6'
}
const EMPTY_QUADRANTS = {
  'urgent-important': [],
  'not-urgent-important': [],
  'urgent-not-important': [],
  'not-urgent-not-important': []
}

/** 确保 _quadrantsByDate 初始化 */
function _ensureQuadrantsByDate(all) {
  if (!all._quadrantsByDate) all._quadrantsByDate = {}
}

/** 获取指定日期的四象限数据 */
function getQuadrantsByDate(dateStr) {
  const all = loadAllData()
  _ensureQuadrantsByDate(all)
  if (!all._quadrantsByDate[dateStr]) {
    all._quadrantsByDate[dateStr] = JSON.parse(JSON.stringify(EMPTY_QUADRANTS))
  }
  return all._quadrantsByDate[dateStr]
}

// ---- 兼容旧 API：操作全局四象限（默认今天） ----

/** 获取四象限数据（兼容旧版，返回今天的） */
function getQuadrants() {
  return getQuadrantsByDate(fmtDate(new Date()))
}

/** 添加四象限任务 */
function addQuadrantTask(quadrantKey, text) {
  const all = loadAllData()
  _ensureQuadrantsByDate(all)
  const dateStr = fmtDate(new Date())
  if (!all._quadrantsByDate[dateStr]) {
    all._quadrantsByDate[dateStr] = JSON.parse(JSON.stringify(EMPTY_QUADRANTS))
  }
  if (!all._quadrantsByDate[dateStr][quadrantKey]) return null
  const task = { id: genId(), text, done: false, createdAt: new Date().toISOString() }
  all._quadrantsByDate[dateStr][quadrantKey].push(task)
  saveAllData(all)
  return task
}

/** 添加四象限任务（指定日期） */
function addQuadrantTaskForDate(dateStr, quadrantKey, text) {
  const all = loadAllData()
  _ensureQuadrantsByDate(all)
  if (!all._quadrantsByDate[dateStr]) {
    all._quadrantsByDate[dateStr] = JSON.parse(JSON.stringify(EMPTY_QUADRANTS))
  }
  if (!all._quadrantsByDate[dateStr][quadrantKey]) return null
  const task = { id: genId(), text, done: false, createdAt: new Date().toISOString() }
  all._quadrantsByDate[dateStr][quadrantKey].push(task)
  saveAllData(all)
  return task
}

/** 切换四象限任务完成 */
function toggleQuadrantTask(quadrantKey, taskId) {
  const all = loadAllData()
  _ensureQuadrantsByDate(all)
  const dateStr = fmtDate(new Date())
  if (!all._quadrantsByDate[dateStr]) return false
  const task = (all._quadrantsByDate[dateStr][quadrantKey] || []).find(t => t.id === taskId)
  if (!task) return false
  task.done = !task.done
  saveAllData(all)
  return task.done
}

/** 切换四象限任务完成（指定日期） */
function toggleQuadrantTaskForDate(dateStr, quadrantKey, taskId) {
  const all = loadAllData()
  _ensureQuadrantsByDate(all)
  if (!all._quadrantsByDate || !all._quadrantsByDate[dateStr]) return false
  const task = (all._quadrantsByDate[dateStr][quadrantKey] || []).find(t => t.id === taskId)
  if (!task) return false
  task.done = !task.done
  saveAllData(all)
  return task.done
}

/** 删除四象限任务 */
function deleteQuadrantTask(quadrantKey, taskId) {
  const all = loadAllData()
  const dateStr = fmtDate(new Date())
  if (!all._quadrantsByDate || !all._quadrantsByDate[dateStr]) return false
  const idx = (all._quadrantsByDate[dateStr][quadrantKey] || []).findIndex(t => t.id === taskId)
  if (idx === -1) return false
  all._quadrantsByDate[dateStr][quadrantKey].splice(idx, 1)
  saveAllData(all)
  return true
}

/** 删除四象限任务（指定日期） */
function deleteQuadrantTaskForDate(dateStr, quadrantKey, taskId) {
  const all = loadAllData()
  if (!all._quadrantsByDate || !all._quadrantsByDate[dateStr]) return false
  const idx = (all._quadrantsByDate[dateStr][quadrantKey] || []).findIndex(t => t.id === taskId)
  if (idx === -1) return false
  all._quadrantsByDate[dateStr][quadrantKey].splice(idx, 1)
  saveAllData(all)
  return true
}

/** 编辑四象限任务文本 */
function editQuadrantTask(quadrantKey, taskId, newText) {
  const all = loadAllData()
  const dateStr = fmtDate(new Date())
  if (!all._quadrantsByDate || !all._quadrantsByDate[dateStr]) return false
  const task = (all._quadrantsByDate[dateStr][quadrantKey] || []).find(t => t.id === taskId)
  if (!task) return false
  task.text = newText
  saveAllData(all)
  return true
}

/** 移动四象限任务到另一个象限 */
function moveQuadrantTask(fromKey, toKey, taskId) {
  const all = loadAllData()
  const dateStr = fmtDate(new Date())
  if (!all._quadrantsByDate || !all._quadrantsByDate[dateStr]) return false
  const fromList = all._quadrantsByDate[dateStr][fromKey] || []
  const idx = fromList.findIndex(t => t.id === taskId)
  if (idx === -1) return false
  const task = fromList.splice(idx, 1)[0]
  all._quadrantsByDate[dateStr][toKey].push(task)
  saveAllData(all)
  return true
}

/** 获取四象限统计（按日期） */
function getQuadrantStatsByDate(dateStr) {
  const all = loadAllData()
  _ensureQuadrantsByDate(all)
  const quadrants = all._quadrantsByDate[dateStr] || EMPTY_QUADRANTS
  const stats = {}
  QUADRANT_KEYS.forEach(key => {
    stats[key] = (quadrants[key] || []).length
  })
  return stats
}

/** 获取四象限统计（今天，兼容旧版） */
function getQuadrantStats() {
  return getQuadrantStatsByDate(fmtDate(new Date()))
}

/** 获取所有有四象限数据的日期 */
function getQuadrantDates() {
  const all = loadAllData()
  if (!all._quadrantsByDate) return []
  return Object.keys(all._quadrantsByDate).filter(d => {
    const q = all._quadrantsByDate[d]
    return q && QUADRANT_KEYS.some(k => (q[k] || []).length > 0)
  }).sort().reverse()
}

/** 迁移旧版全局四象限 -> 新版按日期存储 */
function _migrateQuadrantsIfNeeded() {
  const all = loadAllData()
  if (all._quadrants && !all._quadrantsMigrated) {
    const today = fmtDate(new Date())
    if (!all._quadrantsByDate) all._quadrantsByDate = {}
    // 仅在今天没有数据时才迁移旧数据
    if (!all._quadrantsByDate[today] || QUADRANT_KEYS.every(k => (all._quadrantsByDate[today][k] || []).length === 0)) {
      all._quadrantsByDate[today] = all._quadrants
    }
    all._quadrantsMigrated = true
    saveAllData(all)
  }
}

// ============================================================
//  数据管理 API
// ============================================================

/** 导出 JSON */
function exportJSON() {
  const all = loadAllData()
  return JSON.stringify({
    version: 2,
    exportedAt: new Date().toISOString(),
    data: all
  }, null, 2)
}

/** 导入 JSON */
function importJSON(jsonStr) {
  try {
    const obj = JSON.parse(jsonStr)
    if (!obj.version || !obj.data) return { success: false, message: '数据格式无效' }

    // 备份
    const old = loadAllData()
    storage.set('_v2_backup', JSON.stringify({ version: 2, data: old }))

    saveAllData(obj.data)
    return { success: true, message: '导入成功' }
  } catch (e) {
    return { success: false, message: `解析失败: ${e.message}` }
  }
}

/** 清空全部数据 */
function clearAllData() {
  const backup = exportJSON()
  storage.set('_v2_backup', backup)
  storage.remove(STORAGE_KEY)
  return true
}

/** 聚合统计 */
function getAggregateStats() {
  const all = loadAllData()
  let totalTodos = 0, doneTodos = 0
  let totalNotes = 0
  const dates = new Set()

  Object.keys(all).forEach(k => {
    if (!k.startsWith('_')) {
      dates.add(k)
      const dayData = all[k]
      if (dayData.todos) {
        totalTodos += dayData.todos.length
        doneTodos += dayData.todos.filter(t => t.done).length
      }
      if (dayData.note && dayData.note.trim()) totalNotes++
    }
  })

  return {
    totalTodos,
    doneTodos,
    todoRate: totalTodos > 0 ? Math.round((doneTodos / totalTodos) * 100) : 0,
    totalNotes,
    dateCount: dates.size
  }
}

/** 旧数据迁移（v1 周模型 → v2 日期模型） */
function migrateV1Data() {
  // 直接读取旧版存储
  let old = null
  try {
    old = wx.getStorageSync('wps_weekData')
  } catch (e) {
    return false
  }
  if (!old) return false

  try {
    const newData = loadAllData()

    // 检查是否已有迁移标记
    if (newData._migrated) return false

    Object.keys(old).forEach(weekStart => {
      const week = old[weekStart]
      // 迁移习惯
      if (week._habits && Array.isArray(week._habits)) {
        if (!newData._habits) {
          newData._habits = week._habits.map(h => ({
            name: typeof h === 'string' ? h : h.name || h,
            active: true,
            emoji: '⭐',
            createdAt: new Date().toISOString()
          }))
        }
      }

      // 迁移每天数据
      const monday = new Date(weekStart)
      const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
      DAYS.forEach((dayKey, i) => {
        if (!week[dayKey]) return
        const date = new Date(monday)
        date.setDate(monday.getDate() + i)
        const dateStr = fmtDate(date)

        if (!newData[dateStr]) newData[dateStr] = { todos: [], note: '' }
        newData[dateStr].todos = week[dayKey].todos || []
        newData[dateStr].note = week[dayKey].note || ''

        // 迁移习惯打卡
        if (week[dayKey].habitChecks) {
          if (!newData._habitChecks) newData._habitChecks = {}
          newData._habitChecks[dateStr] = week[dayKey].habitChecks
        }
      })
    })

    newData._migrated = true
    newData._migratedAt = new Date().toISOString()
    saveAllData(newData)

    // 保留旧数据作为备份
    storage.set('_v1_backup', JSON.stringify(old))
    console.log('[v1→v2] 数据迁移完成')
    return true
  } catch (e) {
    console.error('[v1→v2] 迁移失败', e)
    return false
  }
}

/** 初始化数据（首次使用） */
function initDefaultData() {
  const all = loadAllData()
  if (Object.keys(all).length > 0) return all

  const now = new Date()
  all._habits = DEFAULT_HABITS.map(h => ({ ...h, createdAt: now.toISOString() }))
  all._habitChecks = {}
  const today = fmtDate(now)
  all._quadrantsByDate = {}
  all._quadrantsByDate[today] = {
    'urgent-important': [],
    'not-urgent-important': [],
    'urgent-not-important': [],
    'not-urgent-not-important': []
  }

  // 初始化本周数据
  all[today] = { todos: [], note: '' }

  saveAllData(all)
  return all
}

module.exports = {
  // 常量
  STORAGE_KEY,
  WEEKDAY_LABELS,
  QUADRANT_KEYS,
  QUADRANT_LABELS,
  QUADRANT_COLORS,
  DEFAULT_HABITS,

  // 工具
  fmtDate,
  genId,
  getMonday,
  getCurrentWeekStart,
  getWeekByOffset,
  getWeekDates,
  getWeekNumber,

  // 数据读写
  loadAllData,
  saveAllData,
  getDateData,
  ensureDateData,
  getAllDates,

  // 待办
  addTodo,
  toggleTodo,
  deleteTodo,
  getDateTodoStats,
  clearDoneTodos,
  getWeekTodoStats,

  // 习惯
  getHabits,
  getActiveHabits,
  addHabit,
  toggleHabitActive,
  deleteHabit,
  getHabitChecks,
  toggleHabitCheck,
  getHabitWeekStats,
  getHabitWeekMatrix,

  // 笔记
  saveNote,
  getNote,
  getNoteDates,
  getLatestNote,

  // 四象限（通用）
  getQuadrants,
  addQuadrantTask,
  toggleQuadrantTask,
  deleteQuadrantTask,
  editQuadrantTask,
  moveQuadrantTask,
  getQuadrantStats,

  // 四象限（按日期）
  getQuadrantsByDate,
  addQuadrantTaskForDate,
  toggleQuadrantTaskForDate,
  deleteQuadrantTaskForDate,
  getQuadrantStatsByDate,
  getQuadrantDates,
  _migrateQuadrantsIfNeeded,
  EMPTY_QUADRANTS,

  // 数据管理
  exportJSON,
  importJSON,
  clearAllData,
  getAggregateStats,
  migrateV1Data,
  initDefaultData
}
