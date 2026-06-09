/**
 * 待办事项 — v1.0.3
 * 按日期管理待办 + 历史记录侧边栏 + 周导航 + 共享支持
 */
const {
  getWeekDates, addTodo, toggleTodo, deleteTodo, clearDoneTodos,
  getDateTodoStats, fmtDate, WEEKDAY_LABELS, getAllDates, getDateData,
  addQuadrantTaskForDate, getQuadrantsByDate,
  toggleQuadrantTaskForDate, deleteQuadrantTaskForDate,
  addTodoAtomic
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
    historyDates: [],

    // 共享
    sharePartner: null,
    sharedTodos: [],
    showShared: false
  },

  // ===================================================
  //  生命周期
  // ===================================================

  onLoad() {
    const activeDate = app.globalData._activeDate || fmtDate(new Date())
    app.globalData._activeDate = null
    this.setData({ activeDate })
    this._loadData()
    this._loadSharedData()
  },

  onShow() {
    app.refreshData()
    this._loadData()
    this._loadSharedData()
  },

  // ===================================================
  //  数据加载
  // ===================================================

  _loadData() {
    const { weekDates } = app.globalData
    const activeDate = this.data.activeDate

    const d = new Date(activeDate)
    const activeDateLabel = WEEKDAY_LABELS[d.getDay()]
    const activeDateNum = `${d.getMonth() + 1}月${d.getDate()}日`

    const dayData = getDateData(activeDate)
    const todos = dayData ? dayData.todos || [] : []
    const stats = getDateTodoStats(activeDate)

    const historyDates = getAllDates()
      .map(k => {
        const d = new Date(k)
        return { date: k, weekday: WEEKDAY_LABELS[d.getDay()] }
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30)

    const weekDays = weekDates.map(d => {
      const parts = d.split('-')
      return { date: d, label: `${parseInt(parts[1])}/${parseInt(parts[2])}` }
    })

    this.setData({
      weekDays, activeDate, activeDateLabel, activeDateNum,
      todos, stats, historyDates
    })
  },

  /** 加载共享数据 */
  async _loadSharedData() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getSharedData',
        data: { type: 'todo' }
      })
      if (res.result.code === 0) {
        const { partnerExists, partnerOpenid, partnerItems } = res.result.data
        this.setData({
          sharePartner: partnerExists ? partnerOpenid : null,
          sharedTodos: partnerExists ? (partnerItems || []) : []
        })
      }
    } catch (e) {
      console.warn('[Todo] 共享数据加载失败（可忽略）', e.message || e)
    }
  },

  /** 切换共享数据展示 */
  onToggleShared() {
    this.setData({ showShared: !this.data.showShared })
  },

  /** 跳转到四象限（携带当前日期） */
  onGoQuadrant() {
    wx.navigateTo({ url: `/pages/quadrant/quadrant?date=${this.data.activeDate}` })
  },

  /** 跳转到共享管理页 */
  onGoShare() {
    wx.navigateTo({ url: '/pages/share/share' })
  },

  /** 将本地数据变更同步到云端（供对方拉取） */
  async _syncToCloud(action, item) {
    if (!this.data.sharePartner) return
    try {
      await wx.cloud.callFunction({
        name: 'syncData',
        data: { type: 'todo', action, item }
      })
    } catch (e) {
      console.warn('[Todo] 云端同步失败（可忽略）', e.message || e)
    }
  },

  // ===================================================
  //  周/天导航
  // ===================================================

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
    this.setData({ activeDate: e.currentTarget.dataset.date })
    this._loadData()
  },

  // ===================================================
  //  历史侧边栏
  // ===================================================

  onToggleHistory() {
    this.setData({ showHistory: !this.data.showHistory })
  },

  onSelectHistory(e) {
    this.setData({ activeDate: e.currentTarget.dataset.date, showHistory: false })
    this._loadData()
  },

  // ===================================================
  //  待办操作
  // ===================================================

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  onSelectQuadrant(e) {
    this.setData({ priority: e.currentTarget.dataset.priority })
  },

  onAdd() {
    const text = (this.data.inputText || '').trim()
    if (!text) {
      wx.showToast({ title: '请输入内容', icon: 'none' })
      return
    }

    let finalText = text
    let priority = this.data.priority

    if (finalText.startsWith('! '))       { priority = 'urgent-important';         finalText = finalText.slice(2) }
    else if (finalText.startsWith('!! ')) { priority = 'urgent-not-important';     finalText = finalText.slice(3) }
    else if (finalText.startsWith('* '))  { priority = 'not-urgent-important';     finalText = finalText.slice(2) }
    if (!finalText) return

    try {
      const newTodo = addTodoAtomic(this.data.activeDate, finalText, priority)
      this.setData({ inputText: '', priority: 'not-urgent-not-important' })
      app.refreshData()
      app.notifyDataChanged()
      this._loadData()
      this._loadSharedData()
      // 同步到云端（使用本地 id 作为云端文档 _id）
      this._syncToCloud('add', { id: newTodo.id, text: finalText, priority, date: this.data.activeDate, done: false })
      wx.showToast({ title: '已添加', icon: 'success', duration: 800 })
    } catch (e) {
      console.error('[Todo] onAdd 异常:', e.message || e)
      wx.showToast({ title: '添加失败，请重试', icon: 'none', duration: 2000 })
    }
  },

  onToggle(e) {
    const { id } = e.currentTarget.dataset
    const todo = this.data.todos.find(t => t.id === id)
    toggleTodo(this.data.activeDate, id)
    if (todo) {
      this._syncQuadrant('toggle', todo)
      this._syncToCloud('update', { id: todo.id, text: todo.text, priority: todo.priority, date: this.data.activeDate, done: !todo.done })
    }
    app.refreshData()
    app.notifyDataChanged()
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
          if (todo) {
            this._syncQuadrant('delete', todo)
            this._syncToCloud('delete', { id: todo.id, date: this.data.activeDate })
          }
          app.refreshData()
          app.notifyDataChanged()
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
          done.forEach(todo => {
            this._syncQuadrant('delete', todo)
            this._syncToCloud('delete', { id: todo.id, date: this.data.activeDate })
          })
          clearDoneTodos(this.data.activeDate)
          app.refreshData()
          app.notifyDataChanged()
          this._loadData()
          wx.showToast({ title: '已清除', icon: 'success' })
        }
      }
    })
  },

  // ===================================================
  //  象限同步
  // ===================================================

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
