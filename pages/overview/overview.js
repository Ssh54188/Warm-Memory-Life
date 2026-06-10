/**
 * 本周概览 — v1.0.3 
 * 环形进度 + 周导航 + 今日摘要 + 本周待办概览 + 快捷入口
 */
const {
  toggleHabitCheck, loadAllData, fmtDate, WEEKDAY_LABELS,
  exportJSON, importJSON, clearAllData, initDefaultData,
  getQuadrantsByDate, QUADRANT_KEYS, QUADRANT_LABELS, QUADRANT_COLORS
} = require('../../utils/data')
const storage = require('../../utils/storage')
const bk = require('../../utils/bookkeeping')
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
      hasNote: false, notePreview: '',
      finIncome: 0, finExpense: 0
    },
    todayCompletion: 0,

    // 7 天概览
    dayCards: [],

    // 问候语 & 四象限卡片
    greeting: '',
    quadrantCards: [],

    dayLabels: ['一', '二', '三', '四', '五', '六', '日']
  },

  // ====================================================
  //  生命周期
  // ====================================================

  onLoad() {
    // 登录守卫：未登录 → 跳转登录页
    if (!app.globalData.isLoggedIn) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
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
      notePreview: todayNote ? todayNote.substring(0, 30) : '',
      finIncome: 0,
      finExpense: 0
    }

    // 记账今日统计
    try {
      const finStats = bk.todayStats()
      todayStats.finIncome = finStats.income
      todayStats.finExpense = finStats.expense
    } catch (e) {
      // 记账模块可能未初始化，忽略
    }

    const todayDone = todayStats.todoDone + todayStats.habitDone
    const todayAll = todayStats.todoTotal + todayStats.habitTotal
    const todayCompletion = todayAll > 0 ? Math.round((todayDone / todayAll) * 100) : 0

    // ====== 问候语（随机 + 按时间段） ======
    const hour = new Date().getHours()
    const greetings = {
      morning: [
        '早上好，今天也要好好照顾自己呀～',
        '新的一天开始啦，元气满满！',
        '早安，今天也要加油哦～',
        '早上好，记得吃早餐呀～'
      ],
      noon: [
        '中午好，别忘了休息一下呀～',
        '午安，记得吃午饭哦～',
        '中午好，放松一下眼睛吧～',
        '午休时间到，小憩一会儿吧～'
      ],
      afternoon: [
        '下午好，继续加油呀～',
        '下午好，来杯茶提提神吧～',
        '下午好，保持专注哦～',
        '下午好，离下班又近了一步～'
      ],
      evening: [
        '晚上好，今天辛苦啦～',
        '晚上好，好好休息一下吧～',
        '晚上好，今天过得怎么样？',
        '晚上好，准备放松休息啦～'
      ]
    }
    
    let timeKey = 'evening'
    if (hour >= 6 && hour < 12) timeKey = 'morning'
    else if (hour >= 12 && hour < 14) timeKey = 'noon'
    else if (hour >= 14 && hour < 18) timeKey = 'afternoon'
    
    const timeGreetings = greetings[timeKey]
    const greeting = timeGreetings[Math.floor(Math.random() * timeGreetings.length)]

    // ====== 四象限卡片 ======
    const quadrantData = getQuadrantsByDate(todayStr)
    const quadrantCardConfig = [
      { key: 'urgent-important', icon: '🔔', bgColor: '#fce4ec', labelColor: '#d4756b' },
      { key: 'not-urgent-important', icon: '⭐', bgColor: '#e8f5e9', labelColor: '#5a9e6f' },
      { key: 'urgent-not-important', icon: '📬', bgColor: '#e3f2fd', labelColor: '#5c8db5' },
      { key: 'not-urgent-not-important', icon: '🌿', bgColor: '#f3e5f5', labelColor: '#8e6d9e' }
    ]
    const quadrantCards = quadrantCardConfig.map(cfg => {
      const tasks = quadrantData[cfg.key] || []
      return {
        key: cfg.key,
        label: QUADRANT_LABELS[cfg.key],
        icon: cfg.icon,
        count: tasks.length,
        bgColor: cfg.bgColor,
        labelColor: cfg.labelColor,
        previews: tasks.slice(0, 2).map(t => t.text).join('、')
      }
    })

    this.setData({
      weekOffset, weekStart, weekRange, weekNumber,
      year: monday.getFullYear(), month: monthNum,
      weekProgress, dayCards, todayStats, todayCompletion,
      greeting, quadrantCards
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

  goBookkeeping() {
    wx.navigateTo({ url: '/pages/bookkeeping/bookkeeping' })
  },

  goQuadrant() {
    wx.navigateTo({ url: '/pages/quadrant/quadrant' })
  }
})
