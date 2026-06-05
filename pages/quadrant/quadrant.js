/**
 * 四象限优先级管理 — v1.0.2
 * 艾森豪威尔矩阵 + 拖拽跨象限迁移 + 任务 CRUD
 */
const {
  QUADRANT_KEYS, QUADRANT_LABELS, QUADRANT_COLORS,
  getQuadrants, addQuadrantTask, toggleQuadrantTask,
  deleteQuadrantTask, editQuadrantTask, moveQuadrantTask,
  getQuadrantStats, fmtDate, getDateData,
  addTodo, toggleTodo, deleteTodo,
  loadAllData, saveAllData
} = require('../../utils/data')

Page({
  data: {
    quadrants: [],
    quadrantData: {},
    quadrantInputs: {},

    // 拖拽状态
    dragging: false,
    dragTask: null,
    dragFromKey: '',
    dragX: 0,
    dragY: 0,
    dragTargetKey: '',

    // 编辑状态
    editingId: '',
    editingText: '',

    // 统计
    stats: {}
  },

  // ====================================================
  //  生命周期
  // ====================================================

  onLoad() {
    // 构建象限 UI 数据
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
    const data = getQuadrants()
    const stats = {}
    const quadrants = this.data.quadrants.map(q => {
      const tasks = data[q.key] || []
      stats[q.key] = tasks.length
      return { ...q, tasks }
    })
    this.setData({ quadrantData: data, quadrants, stats })
  },

  // ====================================================
  //  输入
  // ====================================================

  onInput(e) {
    const { key } = e.currentTarget.dataset
    // 使用对象展开避免 setData 路径解析连字符键名的问题
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

    const task = addQuadrantTask(key, text)
    this._syncTodo('add', key, text, task ? task.id : null)
    const quadrantInputs = { ...this.data.quadrantInputs, [key]: '' }
    this.setData({ quadrantInputs })
    this._loadData()
    wx.showToast({ title: '已添加', icon: 'success', duration: 800 })
  },

  onToggle(e) {
    const { key, id } = e.currentTarget.dataset
    const quad = this.data.quadrants.find(q => q.key === key)
    const task = (quad ? quad.tasks : []).find(t => t.id === id)
    toggleQuadrantTask(key, id)
    if (task) this._syncTodo('toggle', key, task.text, task.id)
    this._loadData()
  },

  onDelete(e) {
    const { key, id } = e.currentTarget.dataset
    const quad = this.data.quadrants.find(q => q.key === key)
    const task = (quad ? quad.tasks : []).find(t => t.id === id)
    wx.showModal({
      title: '删除任务',
      content: `确定删除「${task ? task.text : '该任务'}」吗？`,
      confirmColor: '#d4756b',
      success: (res) => {
        if (res.confirm) {
          deleteQuadrantTask(key, id)
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
    const newText = this.data.editingText.trim()
    if (!newText) {
      this.setData({ editingId: '', editingText: '' })
      return
    }
    editQuadrantTask(key, this.data.editingId, newText)
    this._syncTodo('edit', key, newText, this.data.editingId)
    this.setData({ editingId: '', editingText: '' })
    this._loadData()
  },

  onEditCancel() {
    this.setData({ editingId: '', editingText: '' })
  },

  // ====================================================
  //  拖拽跨象限迁移（使用 longpress 启动，不干扰正常点击和滚动）
  // ====================================================

  onLongPress(e) {
    const { key, id } = e.currentTarget.dataset
    const touch = e.touches[0]
    this.setData({
      dragging: true,
      dragFromKey: key,
      dragTask: id,
      dragX: touch.clientX - 50,
      dragY: touch.clientY - 25
    })
    try { wx.vibrateShort({ type: 'medium' }) } catch (e) { wx.vibrateShort() }
  },

  onTouchMove(e) {
    // 非拖拽状态直接忽略，不阻塞滚动
    if (!this.data.dragging) return

    const touch = e.touches[0]
    this.setData({
      dragX: touch.clientX - 50,
      dragY: touch.clientY - 25
    })
    this._checkDropZone(touch.clientX, touch.clientY)
  },

  onTouchEnd() {
    if (!this.data.dragging) return

    const { dragFromKey, dragTask, dragTargetKey } = this.data

    if (dragTargetKey && dragTargetKey !== dragFromKey) {
      const quad = this.data.quadrants.find(q => q.key === dragFromKey)
      const task = (quad ? quad.tasks : []).find(t => t.id === dragTask)
      moveQuadrantTask(dragFromKey, dragTargetKey, dragTask)
      if (task) this._syncTodo('move', dragTargetKey, task.text, task.id)
      this._loadData()
      wx.showToast({ title: '已移动', icon: 'success', duration: 800 })
    }

    this.setData({
      dragging: false,
      dragTask: null,
      dragFromKey: '',
      dragX: 0,
      dragY: 0,
      dragTargetKey: ''
    })
  },

  /** 根据坐标判断落在哪个象限 */
  _checkDropZone(clientX, clientY) {
    // 简单两分法：将屏幕分为四区
    const winInfo = (wx.getWindowInfo && wx.getWindowInfo()) || wx.getSystemInfoSync()
    const w = winInfo.windowWidth
    const h = winInfo.windowHeight
    const headerH = 100  // 顶部标题栏高度
    const statsH = 80    // 底部统计高度

    const midX = w / 2
    const midY = headerH + (h - headerH - statsH) / 2

    let targetKey = ''
    const x = clientX
    const y = clientY

    if (y < headerH || y > h - statsH) {
      targetKey = ''
    } else if (x < midX && y < midY) {
      targetKey = 'urgent-important'       // Q1 左上
    } else if (x >= midX && y < midY) {
      targetKey = 'not-urgent-important'   // Q2 右上
    } else if (x < midX && y >= midY) {
      targetKey = 'urgent-not-important'   // Q3 左下
    } else {
      targetKey = 'not-urgent-not-important' // Q4 右下
    }

    if (targetKey !== this.data.dragTargetKey) {
      this.setData({ dragTargetKey: targetKey })
    }
  },

  // ====================================================
  //  同步到待办列表
  // ====================================================

  _syncTodo(action, quadrantKey, text, quadrantTaskId) {
    const dateStr = fmtDate(new Date())
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
