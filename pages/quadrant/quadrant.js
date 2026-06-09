/**
 * 四象限优先级管理 — v1.0.2
 * 艾森豪威尔矩阵 + 拖拽跨象限迁移 + 任务 CRUD
 * 拖拽逻辑由 quadrant-drag-behavior 提供
 */
const {
  QUADRANT_KEYS, QUADRANT_LABELS, QUADRANT_COLORS,
  getQuadrantsByDate, addQuadrantTaskForDate,
  toggleQuadrantTaskForDate, deleteQuadrantTaskForDate,
  editQuadrantTaskForDate, moveQuadrantTaskForDate,
  getQuadrantStatsByDate, fmtDate, getDateData,
  addTodo, toggleTodo, deleteTodo, loadAllData, saveAllData,
  WEEKDAY_LABELS
} = require('../../utils/data')
const dragBehavior = require('../../utils/quadrant-drag-behavior')

Page({
  behaviors: [dragBehavior],

  data: {
    activeDate: '',
    activeDateLabel: '',
    quadrants: [],
    quadrantData: {},
    quadrantInputs: {},

    // 编辑状态
    editingId: '',
    editingText: '',

    // 统计
    stats: {}
  },

  onLoad(options) {
    const dateStr = options.date || fmtDate(new Date())
    const d = new Date(dateStr)
    const activeDateLabel = `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAY_LABELS[d.getDay()]}`
    this.setData({ activeDate: dateStr, activeDateLabel })

    const ui = QUADRANT_KEYS.map(key => ({
      key,
      label: QUADRANT_LABELS[key],
      color: QUADRANT_COLORS[key],
      tasks: []
    }))
    this.setData({ quadrants: ui })
    this._loadData()
  },

  onShow() {
    this._loadData()
  },

  // ====================================================
  //  数据加载
  // ====================================================

  _loadData() {
    const dateStr = this.data.activeDate || fmtDate(new Date())
    const data = getQuadrantsByDate(dateStr)
    const stats = getQuadrantStatsByDate(dateStr)
    const quadrants = this.data.quadrants.map(q => {
      const tasks = data[q.key] || []
      return { ...q, tasks }
    })
    const activeDate = this.data.activeDate
    const d = new Date(activeDate)
    const activeDateLabel = `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAY_LABELS[d.getDay()]}`
    this.setData({ quadrantData: data, quadrants, stats, activeDateLabel })
  },

  // ====================================================
  //  输入
  // ====================================================

  onInput(e) {
    const { key } = e.currentTarget.dataset
    const quadrantInputs = { ...this.data.quadrantInputs, [key]: e.detail.value }
    this.setData({ quadrantInputs })
  },

  // ====================================================
  //  任务操作
  // ====================================================

  onAdd(e) {
    const { key } = e.currentTarget.dataset
    const text = (this.data.quadrantInputs[key] || '').trim()
    if (!text) {
      wx.showToast({ title: '请输入任务内容', icon: 'none', duration: 1000 })
      return
    }
    const dateStr = this.data.activeDate || fmtDate(new Date())
    const task = addQuadrantTaskForDate(dateStr, key, text)
    this._syncTodo('add', key, text, task ? task.id : null)
    const quadrantInputs = { ...this.data.quadrantInputs, [key]: '' }
    this.setData({ quadrantInputs })
    this._loadData()
    wx.showToast({ title: '已添加', icon: 'success', duration: 800 })
  },

  onToggle(e) {
    const { key, id } = e.currentTarget.dataset
    const dateStr = this.data.activeDate || fmtDate(new Date())
    toggleQuadrantTaskForDate(dateStr, key, id)
    const quad = this.data.quadrants.find(q => q.key === key)
    const task = (quad ? quad.tasks : []).find(t => t.id === id)
    if (task) this._syncTodo('toggle', key, task.text, task.id)
    this._loadData()
  },

  onDelete(e) {
    const { key, id } = e.currentTarget.dataset
    const dateStr = this.data.activeDate || fmtDate(new Date())
    const quad = this.data.quadrants.find(q => q.key === key)
    const task = (quad ? quad.tasks : []).find(t => t.id === id)
    wx.showModal({
      title: '删除任务',
      content: `确定删除「${task ? task.text : '该任务'}」吗？`,
      confirmColor: '#d4756b',
      success: (res) => {
        if (res.confirm) {
          deleteQuadrantTaskForDate(dateStr, key, id)
          if (task) this._syncTodo('delete', key, task.text, task.id)
          this._loadData()
        }
      }
    })
  },

  // ====================================================
  //  双击编辑
  // ====================================================

  onDoubleTap(e) {
    const { key, id } = e.currentTarget.dataset
    const quad = this.data.quadrants.find(q => q.key === key)
    const task = (quad ? quad.tasks : []).find(t => t.id === id)
    if (!task) return

    this.setData({ editingId: id, editingText: task.text })
  },

  onEditInput(e) {
    this.setData({ editingText: e.detail.value })
  },

  onEditConfirm(e) {
    const { key } = e.currentTarget.dataset
    const dateStr = this.data.activeDate || fmtDate(new Date())
    const newText = this.data.editingText.trim()
    if (!newText) {
      this.setData({ editingId: '', editingText: '' })
      return
    }
    editQuadrantTaskForDate(dateStr, key, this.data.editingId, newText)
    this._syncTodo('edit', key, newText, this.data.editingId)
    this.setData({ editingId: '', editingText: '' })
    this._loadData()
  },

  onEditCancel() {
    this.setData({ editingId: '', editingText: '' })
  },

  // ====================================================
  //  拖拽跨象限迁移（由 quadrant-drag-behavior 提供）
  // ====================================================

  _dragHeaderOffset: 100,
  _dragFooterOffset: 80,

  /** 页面实现：执行象限内任务移动 */
  _doMoveQuadrantTask(fromKey, toKey, taskId) {
    const dateStr = this.data.activeDate || fmtDate(new Date())
    moveQuadrantTaskForDate(dateStr, fromKey, toKey, taskId)
  },

  /** 拖拽完成回调 — 同步到待办列表 */
  _onDragComplete(fromKey, toKey, taskId, task) {
    if (task) this._syncTodo('move', toKey, task.text, task.id)
    this._loadData()
    wx.showToast({ title: '已移动', icon: 'success', duration: 800 })
  },

  // ====================================================
  //  同步到待办列表
  // ====================================================

  _syncTodo(action, quadrantKey, text, quadrantTaskId) {
    const dateStr = this.data.activeDate || fmtDate(new Date())
    if (action === 'add') {
      addTodo(dateStr, text, quadrantKey, quadrantTaskId)
      return
    }
    if (action === 'edit') {
      const all = loadAllData()
      const dayData = all[dateStr]
      if (!dayData || !dayData.todos) return
      const todo = dayData.todos.find(t => t.quadrantTaskId === quadrantTaskId)
      if (!todo) return
      todo.text = text
      saveAllData(all)
      return
    }
    if (action === 'move') {
      const all = loadAllData()
      const dayData = all[dateStr]
      if (!dayData || !dayData.todos) return
      const todo = dayData.todos.find(t => t.quadrantTaskId === quadrantTaskId)
      if (!todo) return
      todo.priority = quadrantKey
      saveAllData(all)
      return
    }
    const dayData = getDateData(dateStr)
    if (!dayData || !dayData.todos) return
    const todo = dayData.todos.find(t => t.quadrantTaskId === quadrantTaskId)
    if (!todo) return
    if (action === 'toggle') {
      toggleTodo(dateStr, todo.id)
    } else if (action === 'delete') {
      deleteTodo(dateStr, todo.id)
    }
  }
})
