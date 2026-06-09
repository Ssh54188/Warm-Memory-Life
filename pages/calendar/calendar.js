/**
 * 日程页 — v1.0.3：大日历 + 每日四象限 + 待办联动 + 共享支持
 * 四象限任务会自动同步为当天的待办项
 * 拖拽逻辑由 quadrant-drag-behavior 提供
 */
const {
  loadAllData, saveAllData, getDateData, getQuadrantsByDate,
  addQuadrantTaskForDate, toggleQuadrantTaskForDate,
  deleteQuadrantTaskForDate,
  getQuadrantStatsByDate,
  toggleTodoByQuadrantTaskId, deleteTodoByQuadrantTaskId,
  QUADRANT_KEYS, QUADRANT_LABELS, QUADRANT_COLORS,
  addTodo, fmtDate, WEEKDAY_LABELS
} = require('../../utils/data')
const dragBehavior = require('../../utils/quadrant-drag-behavior')
const app = getApp()
const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

Page({
  behaviors: [dragBehavior],

  data: {
    year: 2026, month: 6, isCurrentMonth: true,
    weekLabels: WEEK_LABELS, cells: [],
    activeDate: '', activeDateLabel: '',
    activeTodoStats: { total: 0, done: 0 },
    activeQuadTotal: 0,
    quadrants: [], quadrantInputs: {},

    // 共享
    sharePartner: null,
    sharedEvents: []
  },

  // ===================================================
  //  生命周期
  // ===================================================

  onLoad() {
    const today = fmtDate(new Date())
    const ui = QUADRANT_KEYS.map(key => ({
      key, label: QUADRANT_LABELS[key], color: QUADRANT_COLORS[key],
      tasks: [], linkedTodos: []
    }))
    const now = new Date()
    this.setData({ quadrants: ui, activeDate: today })
    this._renderCalendar(now.getFullYear(), now.getMonth() + 1)
    setTimeout(() => this._loadDayDetail(), 150)
    this._loadSharedData()
  },

  onShow() {
    if (this._needsRefresh()) {
      this._renderCalendar(this.data.year, this.data.month)
      this._loadDayDetail()
      this._loadSharedData()
    }
  },

  /** 加载共享日程 */
  async _loadSharedData() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getSharedData',
        data: { type: 'calendar' }
      })
      if (res.result.code === 0) {
        const { partnerExists, partnerOpenid, partnerItems } = res.result.data
        this.setData({
          sharePartner: partnerExists ? partnerOpenid : null,
          sharedEvents: partnerExists ? (partnerItems || []) : []
        })
      }
    } catch (e) {
      console.warn('[Calendar] 共享数据加载失败（可忽略）', e.message || e)
    }
  },

  // ===================================================
  //  日历渲染
  // ===================================================

  /** 检查是否有新的数据变更需要刷新 */
  _needsRefresh() {
    if (app.globalData.dataVersion !== (this._seenVersion || 0)) {
      this._seenVersion = app.globalData.dataVersion
      return true
    }
    return true // 始终刷新（共享数据可能变更）
  },

  onGoShare() {
    wx.navigateTo({ url: '/pages/share/share' })
  },

  _renderCalendar(year, month) {
    try {
      const today = fmtDate(new Date())
      const nowY = new Date().getFullYear()
      const nowM = new Date().getMonth() + 1
      const allData = loadAllData()

      const newHash = this._calcDataHash(allData, year, month)
      if (newHash === this._lastRenderHash && this.data.cells && this.data.cells.length > 0) {
        this._updateCellSelection()
        this.setData({ year, month, isCurrentMonth: year === nowY && month === nowM })
        return
      }
      this._lastRenderHash = newHash

      const cells = []
      const firstDay = new Date(year, month - 1, 1)
      const daysInMonth = new Date(year, month, 0).getDate()
      const startWeekDay = firstDay.getDay()
      const prevLast = new Date(year, month - 1, 0).getDate()

      for (let i = startWeekDay - 1; i >= 0; i--) {
        cells.push(this._buildCell(prevLast - i, fmtDate(new Date(year, month - 2, prevLast - i)), today, true, allData))
      }
      for (let d = 1; d <= daysInMonth; d++) {
        cells.push(this._buildCell(d, fmtDate(new Date(year, month - 1, d)), today, false, allData))
      }
      const rem = 7 - (cells.length % 7)
      if (rem < 7) {
        for (let d = 1; d <= rem; d++) {
          cells.push(this._buildCell(d, fmtDate(new Date(year, month, d)), today, true, allData))
        }
      }

      if (cells.length === 0) {
        console.error('[Calendar] 日历格构建失败，cells 为空')
        return
      }

      this.setData({ year, month, cells, isCurrentMonth: year === nowY && month === nowM })
    } catch (e) {
      console.error('[Calendar] _renderCalendar 异常', e)
    }
  },

  _calcDataHash(allData, year, month) {
    try {
      const firstDay = new Date(year, month - 1, 1)
      const daysInMonth = new Date(year, month, 0).getDate()
      const startWeekDay = firstDay.getDay()

      let hash = `${year}-${month}:`
      const prevLast = new Date(year, month - 1, 0).getDate()
      const tp = (dateStr) => {
        const dd = allData[dateStr]
        if (!dd) return '0'
        const todos = dd.todos || []
        const qd = (allData._quadrantsByDate && allData._quadrantsByDate[dateStr]) || null
        const qCount = qd ? QUADRANT_KEYS.reduce((s, k) => s + (qd[k] || []).length, 0) : 0
        return `${todos.length}_${todos.filter(t => t.done).length}_${dd.note ? '1' : '0'}_q${qCount}`
      }

      const prevMonth = month - 2 < 0 ? 11 : month - 2
      for (let i = startWeekDay - 1; i >= 0; i--) {
        hash += tp(fmtDate(new Date(year, prevMonth, prevLast - i))) + '|'
      }
      for (let d = 1; d <= daysInMonth; d++) {
        hash += tp(fmtDate(new Date(year, month - 1, d))) + '|'
      }
      const totalCells = startWeekDay + daysInMonth
      const rem = 7 - (totalCells % 7)
      if (rem < 7) {
        for (let d = 1; d <= rem; d++) {
          hash += tp(fmtDate(new Date(year, month, d))) + '|'
        }
      }
      return hash
    } catch (e) {
      console.error('[Calendar] _calcDataHash 异常，强制重建', e)
      return `error_force_rebuild_${Date.now()}`
    }
  },

  _updateCellSelection() {
    const activeDate = this.data.activeDate
    if (!activeDate) return
    const currentCells = this.data.cells
    if (!currentCells || currentCells.length === 0) {
      console.warn('[Calendar] cells 为空，跳过选中更新（需完整重建）')
      return
    }
    const updated = currentCells.map(c => ({ ...c, isSelected: c.fullDate === activeDate }))
    this.setData({ cells: updated })
  },

  _buildCell(day, fullDate, today, isOtherMonth, allData) {
    try {
      const d = new Date(fullDate)
      const dOfWeek = d.getDay()
      let hasNote = false, todoTotal = 0, todoDone = 0, hasQuadrant = false
      let todoPreviews = []

      if (allData[fullDate]) {
        hasNote = !!(allData[fullDate].note && allData[fullDate].note.trim())
        const todos = allData[fullDate].todos || []
        todoTotal = todos.length; todoDone = todos.filter(t => t.done).length
        todoPreviews = todos.filter(t => !t.done).slice(0, 2).map(t => t.text.length > 6 ? t.text.substring(0, 6) + '…' : t.text)
      }
      if (allData._quadrantsByDate && allData._quadrantsByDate[fullDate]) {
        const q = allData._quadrantsByDate[fullDate]
        hasQuadrant = QUADRANT_KEYS.some(k => (q[k] || []).length > 0)
      }

      return {
        day, fullDate, isOtherMonth,
        isToday: fullDate === today,
        isWeekend: dOfWeek === 0 || dOfWeek === 6,
        isSelected: fullDate === this.data.activeDate,
        hasNote, todoTotal, todoDone, hasQuadrant, todoPreviews,
        isEmpty: !hasNote && todoTotal === 0 && !hasQuadrant
      }
    } catch (e) {
      console.error('[Calendar] _buildCell 异常', { day, fullDate, error: e.message })
      return { day: day || 0, fullDate: fullDate || '', isOtherMonth, isToday: false,
        isWeekend: false, isSelected: false, hasNote: false, todoTotal: 0,
        todoDone: 0, hasQuadrant: false, todoPreviews: [], isEmpty: true }
    }
  },

  // ===================================================
  //  日期选择
  // ===================================================

  onCellTap(e) {
    const { index } = e.currentTarget.dataset
    const cell = this.data.cells[index]
    if (!cell || cell.isOtherMonth) return

    const cells = this.data.cells.map((c, i) => ({ ...c, isSelected: i === index }))
    const d = new Date(cell.fullDate)
    this.setData({
      cells, activeDate: cell.fullDate,
      activeDateLabel: `${d.getMonth() + 1}月${d.getDate()}日 ${WEEK_LABELS[d.getDay()]}`
    })
    this._loadDayDetail()
  },

  // ===================================================
  //  每日详情（象限 + 待办联动）
  // ===================================================

  _loadDayDetail() {
    try {
      const dateStr = this.data.activeDate
      const allData = loadAllData()

      const dd = allData[dateStr]
      const todos = (dd && dd.todos) ? dd.todos : []
      const todoStats = {
        total: todos.length,
        done: todos.filter(t => t.done).length
      }

      const quadrantData = getQuadrantsByDate(dateStr)
      let quadTotal = 0
      const quadrants = this.data.quadrants.map(q => {
        const tasks = quadrantData[q.key] || []
        quadTotal += tasks.length
        const linkedTodos = todos.filter(t => {
          const tag = t.quadrantTag || t.priority || ''
          return tag === q.key && t.quadrantTaskId
        })
        return { ...q, tasks, linkedTodos }
      })

      this.setData({
        quadrants, activeTodoStats: todoStats, activeQuadTotal: quadTotal,
        quadrantInputs: {}
      })
    } catch (e) {
      console.error('[Calendar] _loadDayDetail 异常', e)
    }
  },

  // ===================================================
  //  象限操作（自动同步待办）
  // ===================================================

  onQInput(e) {
    const { key } = e.currentTarget.dataset
    this.setData({ [`quadrantInputs.${key}`]: e.detail.value })
  },

  onQAdd(e) {
    const { key } = e.currentTarget.dataset
    const text = (this.data.quadrantInputs[key] || '').trim()
    if (!text) return

    // 同步创建象限任务 + 待办，保持数据一致性
    const quadrantTask = addQuadrantTaskForDate(this.data.activeDate, key, text)
    addTodo(this.data.activeDate, text, key, quadrantTask ? quadrantTask.id : null)

    const quadrantInputs = { ...this.data.quadrantInputs, [key]: '' }
    this.setData({ quadrantInputs })
    app.refreshData()
    app.notifyDataChanged()
    this._renderCalendar(this.data.year, this.data.month)
    this._loadDayDetail()
  },

  onQToggle(e) {
    const { key, id } = e.currentTarget.dataset
    toggleQuadrantTaskForDate(this.data.activeDate, key, id)
    toggleTodoByQuadrantTaskId(this.data.activeDate, id)
    app.notifyDataChanged()
    this._loadDayDetail()
  },

  onQDelete(e) {
    const { key, id } = e.currentTarget.dataset
    wx.showModal({
      title: '删除', content: '确定删除？', confirmColor: '#d4756b',
      success: (res) => {
        if (res.confirm) {
          deleteQuadrantTaskForDate(this.data.activeDate, key, id)
          deleteTodoByQuadrantTaskId(this.data.activeDate, id)
          app.notifyDataChanged()
          this._renderCalendar(this.data.year, this.data.month)
          this._loadDayDetail()
        }
      }
    })
  },

  // ===================================================
  //  月份 / 手势
  // ===================================================

  onPrevMonth() {
    let { year, month } = this.data; month--
    if (month === 0) { month = 12; year-- }
    this._renderCalendar(year, month)
  },
  onNextMonth() {
    let { year, month } = this.data; month++
    if (month === 13) { month = 1; year++ }
    this._renderCalendar(year, month)
  },
  onToday() {
    const now = new Date(); const today = fmtDate(now)
    this._renderCalendar(now.getFullYear(), now.getMonth() + 1)
    this.setData({ activeDate: today })
    this._loadDayDetail()
  },
  onSwipeStart(e) { this._sx = e.touches[0].clientX; this._sy = e.touches[0].clientY },
  onSwipeEnd(e) {
    const dx = e.changedTouches[0].clientX - this._sx
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.changedTouches[0].clientY - this._sy)) {
      dx > 0 ? this.onPrevMonth() : this.onNextMonth()
    }
  },

  // ===================================================
  //  拖拽跨象限迁移（由 quadrant-drag-behavior 提供）
  // ===================================================

  _dragHeaderOffset: 200,

  _doMoveQuadrantTask(fromKey, toKey, taskId) {
    const { moveQuadrantTaskForDate } = require('../../utils/data')
    moveQuadrantTaskForDate(this.data.activeDate, fromKey, toKey, taskId)
  },

  _onDragComplete() {
    app.notifyDataChanged()
    this._renderCalendar(this.data.year, this.data.month)
    this._loadDayDetail()
  }
})
