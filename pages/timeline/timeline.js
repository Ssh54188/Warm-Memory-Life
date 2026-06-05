/**
 * 时间线视图 — v1.0.2
 * 左侧纵向时间轴 + 右侧每日内容卡片（待办/笔记/四象限汇总）
 */
const { loadAllData, fmtDate, WEEKDAY_LABELS, QUADRANT_KEYS } = require('../../utils/data')
const app = getApp()

Page({
  data: {
    timelineItems: [],
    stats: { totalDays: 0, totalTodos: 0, totalNotes: 0 }
  },

  onLoad() {
    this._load()
  },

  onShow() {
    this._load()
  },

  _load() {
    const allData = loadAllData()
    const todayStr = fmtDate(new Date())
    const items = []

    // 收集所有有数据的日期
    const dates = Object.keys(allData).filter(k => !k.startsWith('_'))
    dates.sort().reverse() // 最新在前

    let totalTodos = 0, totalNotes = 0

    dates.forEach(dateStr => {
      const dayData = allData[dateStr]
      const d = new Date(dateStr)
      const todos = (dayData && dayData.todos) ? dayData.todos : []
      const done = todos.filter(t => t.done).length
      const total = todos.length
      const note = (dayData && dayData.note) ? dayData.note.trim() : ''

      // 四象限汇总
      let quadrantTotal = 0, quadrantDone = 0
      if (allData._quadrantsByDate && allData._quadrantsByDate[dateStr]) {
        const q = allData._quadrantsByDate[dateStr]
        QUADRANT_KEYS.forEach(k => {
          const tasks = q[k] || []
          quadrantTotal += tasks.length
          quadrantDone += tasks.filter(t => t.done).length
        })
      }

      // 跳过完全空白的日期
      if (total === 0 && !note && quadrantTotal === 0) return

      totalTodos += total
      if (note) totalNotes++

      items.push({
        date: dateStr,
        dateLabel: `${d.getMonth() + 1}/${d.getDate()}`,
        weekday: WEEKDAY_LABELS[d.getDay()],
        isToday: dateStr === todayStr,
        todos: { total, done, rate: total > 0 ? Math.round((done / total) * 100) : 0 },
        hasNote: !!note,
        notePreview: note ? note.substring(0, 40) : '',
        quadrant: { total: quadrantTotal, done: quadrantDone },
        isEmpty: total === 0 && !note && quadrantTotal === 0
      })
    })

    this.setData({
      timelineItems: items,
      stats: { totalDays: items.length, totalTodos, totalNotes }
    })
  },

  // ====================================================
  //  跳转
  // ====================================================

  onTapDate(e) {
    const { date } = e.currentTarget.dataset
    app.globalData._activeDate = date
    wx.switchTab({ url: '/pages/todo/todo' })
  }
})
