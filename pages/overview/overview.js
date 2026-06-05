/**
 * 本周概览 — v1.0.3 瘦身版
 * 环形进度 + 周导航 + 今日摘要 + 本周待办概览 + 快捷入口
 */
const {
  toggleHabitCheck, loadAllData, fmtDate, WEEKDAY_LABELS,
  exportJSON, importJSON, clearAllData, initDefaultData
} = require('../../utils/data')
const storage = require('../../utils/storage')
const app = getApp()

Page({
  data: {
    weekOffset: 0,
    weekStart: '',
    weekRange: '',
    weekNumber: 0,
    year: 2026,
    month: 6,

    // 进度环
    weekProgress: 0,

    // 今日摘要
    todayStats: {
      todoDone: 0, todoTotal: 0,
      habitDone: 0, habitTotal: 0,
      hasNote: false, notePreview: ''
    },
    todayCompletion: 0,

    // 7 天概览
    dayCards: [],

    dayLabels: ['一', '二', '三', '四', '五', '六', '日']
  },

  // ====================================================
  //  生命周期
  // ====================================================

  onLoad() {
    this._loadAll()
  },

  onShow() {
    app.refreshData()
    this._loadAll()
  },

  // ====================================================
  //  数据加载
  // ====================================================

  _loadAll() {
    const { weekOffset, weekStart, weekDates } = app.globalData
    const todayStr = fmtDate(new Date())

    // 一次性读取全量数据
    const allData = loadAllData()

    // 周范围文本
    const [y, m, d] = weekStart.split('-').map(Number)
    const monday = new Date(y, m - 1, d)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const monthNum = monday.getMonth() + 1
    const weekRange = `${monthNum}月${monday.getDate()}日 - ${sunday.getMonth() + 1}月${sunday.getDate()}日`
    const weekNumber = Math.ceil((monday.getDate() + ((monday.getDay() + 6) % 7)) / 7) || 1

    // ====== 7 天卡片 + 待办统计 ======
    let todoWeekTotal = 0, todoWeekDone = 0
    const dayCards = weekDates.map((dateStr, i) => {
      const d = new Date(dateStr)
      const dd = allData[dateStr]
      const todos = (dd && dd.todos) ? dd.todos : []
      const total = todos.length
      const done = todos.filter(t => t.done).length
      todoWeekTotal += total
      todoWeekDone += done

      return {
        date: dateStr,
        label: WEEKDAY_LABELS[d.getDay()],
        dateNum: `${d.getMonth() + 1}/${d.getDate()}`,
        isToday: dateStr === todayStr,
        todoTotal: total,
        todoDone: done,
        hasNote: !!(dd && dd.note && dd.note.trim())
      }
    })
    const todoRate = todoWeekTotal > 0 ? Math.round((todoWeekDone / todoWeekTotal) * 100) : 0

    // ====== 习惯统计 ======
    const habits = (allData._habits && Array.isArray(allData._habits)) ? allData._habits : []
    const activeHabitNames = habits.filter(h => h.active !== false).map(h => h.name)
    let habitWeekDone = 0
    const habitTotal = activeHabitNames.length * 7

    weekDates.forEach(ds => {
      const checks = (allData._habitChecks && allData._habitChecks[ds]) || {}
      activeHabitNames.forEach(name => {
        if (checks[name]) habitWeekDone++
      })
    })

    const habitRate = habitTotal > 0 ? Math.round((habitWeekDone / habitTotal) * 100) : 0
    const weekProgress = Math.round((todoRate + habitRate) / 2)

    // ====== 今日摘要 ======
    const todayData = allData[todayStr] || {}
    const todayTodos = todayData.todos || []
    const todayChecks = (allData._habitChecks && allData._habitChecks[todayStr]) || {}
    let todayHabitDone = 0
    activeHabitNames.forEach(name => {
      if (todayChecks[name]) todayHabitDone++
    })
    const todayNote = todayData.note && todayData.note.trim()
    const todayStats = {
      todoDone: todayTodos.filter(t => t.done).length,
      todoTotal: todayTodos.length,
      habitDone: todayHabitDone,
      habitTotal: activeHabitNames.length,
      hasNote: !!todayNote,
      notePreview: todayNote ? todayNote.substring(0, 30) : ''
    }

    const todayDone = todayStats.todoDone + todayStats.habitDone
    const todayAll = todayStats.todoTotal + todayStats.habitTotal
    const todayCompletion = todayAll > 0 ? Math.round((todayDone / todayAll) * 100) : 0

    this.setData({
      weekOffset, weekStart, weekRange, weekNumber,
      year: monday.getFullYear(), month: monthNum,
      weekProgress, dayCards, todayStats, todayCompletion
    })
  },

  // ====================================================
  //  周导航
  // ====================================================

  onPrevWeek() {
    app.setWeekOffset(app.globalData.weekOffset - 1)
    this._loadAll()
  },

  onNextWeek() {
    app.setWeekOffset(app.globalData.weekOffset + 1)
    this._loadAll()
  },

  onCurrentWeek() {
    app.setWeekOffset(0)
    this._loadAll()
  },

  // ====================================================
  //  导航
  // ====================================================

  goCalendar() {
    wx.switchTab({ url: '/pages/calendar/calendar' })
  },

  goTodo(e) {
    const { date } = e && e.currentTarget ? e.currentTarget.dataset : {}
    app.globalData._activeDate = date || fmtDate(new Date())
    wx.switchTab({ url: '/pages/todo/todo' })
  },

  goTodayDetail() {
    app.globalData._activeDate = fmtDate(new Date())
    wx.switchTab({ url: '/pages/todo/todo' })
  },

  goTimeline() {
    wx.navigateTo({ url: '/pages/timeline/timeline' })
  },

  goHabits() {
    wx.navigateTo({ url: '/pages/habit/habit' })
  },

  goNotes() {
    wx.navigateTo({ url: '/pages/note/note' })
  },

  goQuadrant() {
    wx.navigateTo({ url: '/pages/quadrant/quadrant' })
  }
})
