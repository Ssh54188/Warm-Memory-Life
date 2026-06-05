/**
 * 待办事项 — v1.0.2
 * 按日期管理待办 + 历史记录侧边栏 + 周导航
 */
const {
  getWeekDates, addTodo, toggleTodo, deleteTodo, clearDoneTodos,
  getDateTodoStats, fmtDate, WEEKDAY_LABELS, getAllDates, getDateData,
  addQuadrantTaskForDate, getQuadrantsByDate,
  toggleQuadrantTaskForDate, deleteQuadrantTaskForDate
} = require('../../utils/data')
const app = getApp()

Page({
  data: {
    weekDays: [],
    activeDate: '',
    activeDateLabel: '',
    activeDateNum: '',

    // 待办列表
    todos: [],
    stats: { total: 0, done: 0, rate: 0 },

    // 输入
    inputText: '',
    priority: 'not-urgent-not-important',

    // 历史侧边栏
    showHistory: false,
    historyDates: []
  },

  // ====================================================
  //  生命周期
  // ====================================================

  onLoad() {
    // 从 globalData 或默认今天
    const activeDate = app.globalData._activeDate || fmtDate(new Date())
    app.globalData._activeDate = null
    this.setData({ activeDate })
    this._loadData()
  },

  onShow() {
    app.refreshData()
    this._loadData()
  },

  // ====================================================
  //  数据加载
  // ====================================================

  _loadData() {
    const { weekDates, weekStart } = app.globalData
    const activeDate = this.data.activeDate

    // 日期信息
    const d = new Date(activeDate)
    const activeDateLabel = WEEKDAY_LABELS[d.getDay()]
    const activeDateNum = `${d.getMonth() + 1}月${d.getDate()}日`

    // 待办
    const dayData = getDateData(activeDate)
    const todos = dayData ? dayData.todos || [] : []
    const stats = getDateTodoStats(activeDate)

    // 历史日期（含星期标签）
    const historyDates = getAllDates()
      .map(k => {
        const d = new Date(k)
        return { date: k, weekday: WEEKDAY_LABELS[d.getDay()] }
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30)

    // 预处理日期标签（WXML 不支持 split）
    const weekDays = weekDates.map(d => {
      const parts = d.split('-')
      return { date: d, label: `${parseInt(parts[1])}/${parseInt(parts[2])}` }
    })

    this.setData({
      weekDays,
      activeDate,
      activeDateLabel,
      activeDateNum,
      todos,
      stats,
      historyDates
    })
  },

  // ====================================================
  //  周/天导航
  // ====================================================

  onPrevWeek() {
    app.setWeekOffset(app.globalData.weekOffset - 1)
    this.setData({ activeDate: app.globalData.weekDates[0] })
    this._loadData()
  },

  onNextWeek() {
    app.setWeekOffset(app.globalData.weekOffset + 1)
    this.setData({ activeDate: app.globalData.weekDates[0] })
    this._loadData()
  },

  onSelectDate(e) {
    const { date } = e.currentTarget.dataset
    this.setData({ activeDate: date })
    this._loadData()
  },

  // ====================================================
  //  历史侧边栏
  // ====================================================

  onToggleHistory() {
    this.setData({ showHistory: !this.data.showHistory })
  },

  onSelectHistory(e) {
    const { date } = e.currentTarget.dataset
    this.setData({ activeDate: date, showHistory: false })
    this._loadData()
  },

  // ====================================================
  //  待办操作
  // ====================================================

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  onSelectQuadrant(e) {
    const { priority } = e.currentTarget.dataset
    this.setData({ priority })
  },

  onAdd() {
    let text = this.data.inputText.trim()
    if (!text) return

    // 前缀 → 象限自动识别
    let priority = this.data.priority
    if (text.startsWith('! '))       { priority = 'urgent-important';         text = text.slice(2) }
    else if (text.startsWith('!! ')) { priority = 'urgent-not-important';     text = text.slice(3) }
    else if (text.startsWith('* '))  { priority = 'not-urgent-important';     text = text.slice(2) }
    if (!text) return

    const quadrantTask = addQuadrantTaskForDate(this.data.activeDate, priority, text)
    addTodo(this.data.activeDate, text, priority, quadrantTask ? quadrantTask.id : null)
    this.setData({ inputText: '', priority: 'not-urgent-not-important' })
    app.refreshData()
    this._loadData()
    wx.showToast({ title: '已添加', icon: 'success', duration: 800 })
  },

  onToggle(e) {
    const { id } = e.currentTarget.dataset
    const todo = this.data.todos.find(t => t.id === id)
    toggleTodo(this.data.activeDate, id)
    if (todo) this._syncQuadrant('toggle', todo)
    app.refreshData()
    this._loadData()
  },

  onDelete(e) {
    const { id } = e.currentTarget.dataset
    const todo = this.data.todos.find(t => t.id === id)
    wx.showModal({
      title: '删除待办',
      content: `确定删除「${todo ? todo.text : '该待办'}」吗？`,
      confirmColor: '#d4756b',
      success: (res) => {
        if (res.confirm) {
          deleteTodo(this.data.activeDate, id)
          if (todo) this._syncQuadrant('delete', todo)
          app.refreshData()
          this._loadData()
          wx.showToast({ title: '已删除', icon: 'success', duration: 800 })
        }
      }
    })
  },

  onClearDone() {
    const done = this.data.todos.filter(t => t.done)
    if (done.length === 0) {
      wx.showToast({ title: '没有已完成待办', icon: 'none' })
      return
    }
    wx.showModal({
      title: '清除已完成',
      content: `确定清除 ${done.length} 条已完成待办吗？`,
      confirmColor: '#c09880',
      success: (res) => {
        if (res.confirm) {
          done.forEach(todo => this._syncQuadrant('delete', todo))
          clearDoneTodos(this.data.activeDate)
          app.refreshData()
          this._loadData()
          wx.showToast({ title: '已清除', icon: 'success' })
        }
      }
    })
  },

  // ====================================================
  //  象限同步
  // ====================================================

  _syncQuadrant(action, todo) {
    if (!todo.priority || !todo.quadrantTaskId) return
    const dateStr = this.data.activeDate
    const qData = getQuadrantsByDate(dateStr)
    if (!qData || !qData[todo.priority]) return
    const target = qData[todo.priority].find(t => t.id === todo.quadrantTaskId)
    if (!target) return
    if (action === 'toggle') {
      toggleQuadrantTaskForDate(dateStr, todo.priority, target.id)
    } else if (action === 'delete') {
      deleteQuadrantTaskForDate(dateStr, todo.priority, target.id)
    }
  }
})
