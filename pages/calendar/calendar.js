/**
 * 日程页 — v1.0.2：大日历 + 每日四象限 + 待办联动
 * 四象限任务会自动同步为当天的待办项
 */
const {
  loadAllData, saveAllData, getDateData, getQuadrantsByDate,
  addQuadrantTaskForDate, toggleQuadrantTaskForDate,
  deleteQuadrantTaskForDate, moveQuadrantTask, getQuadrantStatsByDate,
  QUADRANT_KEYS, QUADRANT_LABELS, QUADRANT_COLORS,
  addTodo, fmtDate, WEEKDAY_LABELS
} = require('../../utils/data')
const app = getApp()
const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

Page({
  data: {
    year: 2026, month: 6, isCurrentMonth: true,
    weekLabels: WEEK_LABELS, cells: [],
    activeDate: '', activeDateLabel: '',
    activeTodoStats: { total: 0, done: 0 },
    activeQuadTotal: 0,
    quadrants: [], quadrantInputs: {},
    dragging: false, dragTask: null, dragFromKey: '',
    dragX: 0, dragY: 0, dragTargetKey: ''
  },

  onLoad() {
    const today = fmtDate(new Date())
    const ui = QUADRANT_KEYS.map(key => ({
      key, label: QUADRANT_LABELS[key], color: QUADRANT_COLORS[key],
      tasks: [], linkedTodos: []
    }))
    const now = new Date()
    this.setData({ quadrants: ui, activeDate: today })
    this._renderCalendar(now.getFullYear(), now.getMonth() + 1)
    // 延迟加载详情避免首帧超时
    setTimeout(() => this._loadDayDetail(), 150)
  },

  onShow() {
    this._renderCalendar(this.data.year, this.data.month)
    this._loadDayDetail()
  },

  // ==================== 日历渲染 ====================

  _renderCalendar(year, month) {
    const today = fmtDate(new Date())
    const nowY = new Date().getFullYear()
    const nowM = new Date().getMonth() + 1
    const allData = loadAllData()
    const cells = []

    const firstDay = new Date(year, month - 1, 1)
    const daysInMonth = new Date(year, month, 0).getDate()
    const startWeekDay = firstDay.getDay()

    // 上月填充
    const prevLast = new Date(year, month - 1, 0).getDate()
    for (let i = startWeekDay - 1; i >= 0; i--) {
      cells.push(this._buildCell(prevLast - i, fmtDate(new Date(year, month - 2, prevLast - i)), today, true, allData))
    }
    // 当月
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(this._buildCell(d, fmtDate(new Date(year, month - 1, d)), today, false, allData))
    }
    // 下月填充
    const rem = 7 - (cells.length % 7)
    if (rem < 7) {
      for (let d = 1; d <= rem; d++) {
        cells.push(this._buildCell(d, fmtDate(new Date(year, month, d)), today, true, allData))
      }
    }

    this.setData({ year, month, cells, isCurrentMonth: year === nowY && month === nowM })
  },

  _buildCell(day, fullDate, today, isOtherMonth, allData) {
    const dd = allData[fullDate]
    const dOfWeek = new Date(fullDate).getDay()
    let hasNote = false, todoTotal = 0, todoDone = 0, hasQuadrant = false
    let todoPreviews = []

    if (dd) {
      hasNote = !!(dd.note && dd.note.trim())
      const todos = dd.todos || []
      todoTotal = todos.length; todoDone = todos.filter(t => t.done).length
      // 取前 2 条未完成待办的文字预览
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
  },

  // ==================== 日期选择 ====================

  onCellTap(e) {
    const { index } = e.currentTarget.dataset
    const cell = this.data.cells[index]
    if (!cell || cell.isOtherMonth) return

    const cells = this.data.cells.map((c, i) => ({ ...c, isSelected: i === index }))
    const d = new Date(cell.fullDate)
    this.setData({
      cells, activeDate: cell.fullDate,
      activeDateLabel: `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAY_LABELS[d.getDay()]}`
    })
    this._loadDayDetail()
  },

  // ==================== 每日详情（象限 + 待办联动） ====================

  _loadDayDetail() {
    const dateStr = this.data.activeDate
    const allData = loadAllData()

    // 待办统计
    const dd = allData[dateStr]
    const todos = (dd && dd.todos) ? dd.todos : []
    const todoStats = {
      total: todos.length,
      done: todos.filter(t => t.done).length
    }

    // 待办按象限关键词分类
    const quadrantData = getQuadrantsByDate(dateStr)
    let quadTotal = 0
    const quadrants = this.data.quadrants.map(q => {
      const tasks = quadrantData[q.key] || []
      quadTotal += tasks.length
      // 将当天的待办按象限关键词匹配
      const linkedTodos = todos.filter(t => {
        const tag = t.quadrantTag || ''
        return tag === q.key
      })
      return { ...q, tasks, linkedTodos }
    })

    this.setData({
      quadrants, activeTodoStats: todoStats, activeQuadTotal: quadTotal,
      quadrantInputs: {} // 清空输入
    })
  },

  // ==================== 象限操作（自动同步待办） ====================

  onQInput(e) {
    const { key } = e.currentTarget.dataset
    this.setData({ [`quadrantInputs.${key}`]: e.detail.value })
  },

  onQAdd(e) {
    const { key } = e.currentTarget.dataset
    const text = (this.data.quadrantInputs[key] || '').trim()
    if (!text) return

    // 添加四象限任务
    addQuadrantTaskForDate(this.data.activeDate, key, text)
    // 同步到待办列表（带象限标签）
    addTodo(this.data.activeDate, text, 'low')
    // 给待办打象限标签（通过 note 字段暂存）
    const allData = loadAllData()
    const dayData = allData[this.data.activeDate]
    if (dayData && dayData.todos) {
      const last = dayData.todos[dayData.todos.length - 1]
      if (last) last.quadrantTag = key
      saveAllData(allData)
    }

    const quadrantInputs = { ...this.data.quadrantInputs, [key]: '' }
    this.setData({ quadrantInputs })
    this._renderCalendar(this.data.year, this.data.month)
    this._loadDayDetail()
  },

  onQToggle(e) {
    const { key, id } = e.currentTarget.dataset
    toggleQuadrantTaskForDate(this.data.activeDate, key, id)
    this._loadDayDetail()
  },

  onQDelete(e) {
    const { key, id } = e.currentTarget.dataset
    wx.showModal({
      title: '删除', content: '确定删除？', confirmColor: '#d4756b',
      success: (res) => {
        if (res.confirm) {
          deleteQuadrantTaskForDate(this.data.activeDate, key, id)
          this._renderCalendar(this.data.year, this.data.month)
          this._loadDayDetail()
        }
      }
    })
  },

  // ==================== 月份 / 手势 ====================

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

  // ==================== 拖拽 ====================

  onLongPress(e) {
    const { key, id } = e.currentTarget.dataset
    const t = e.touches[0]
    this.setData({ dragging: true, dragFromKey: key, dragTask: id, dragX: t.clientX - 50, dragY: t.clientY - 25 })
    try { wx.vibrateShort({ type: 'medium' }) } catch (e) {}
  },
  onTouchMove(e) {
    if (!this.data.dragging) return
    const t = e.touches[0]
    this.setData({ dragX: t.clientX - 50, dragY: t.clientY - 25 })
    this._checkDrop(t.clientX, t.clientY)
  },
  onTouchEnd() {
    if (!this.data.dragging) return
    const { dragFromKey, dragTask, dragTargetKey } = this.data
    if (dragTargetKey && dragTargetKey !== dragFromKey) {
      moveQuadrantTask(dragFromKey, dragTargetKey, dragTask)
      this._loadDayDetail()
    }
    this.setData({ dragging: false, dragTask: null, dragFromKey: '', dragX: 0, dragY: 0, dragTargetKey: '' })
  },
  _checkDrop(cx, cy) {
    const info = (wx.getWindowInfo && wx.getWindowInfo()) || wx.getSystemInfoSync()
    const midX = info.windowWidth / 2, midY = info.windowHeight * 0.55
    let k = '';
    if (cx < midX && cy < midY) k = 'urgent-important'
    else if (cx >= midX && cy < midY) k = 'not-urgent-important'
    else if (cx < midX && cy >= midY) k = 'urgent-not-important'
    else k = 'not-urgent-not-important'
    if (k !== this.data.dragTargetKey) this.setData({ dragTargetKey: k })
  }
})
