/**
 * 记账主页 — 月度统计 + 分类扇形图 + 交易列表（左滑删除）+ 快捷添加
 */
const bk = require('../../utils/bookkeeping')
const app = getApp()

/** Donut 环形图配色（10色循环） */
const DONUT_COLORS = [
  '#e06c75', '#d19a66', '#e5c07b', '#98c379', '#56b6c2',
  '#61afef', '#c678dd', '#be5046', '#7ec8a4', '#e8a87c'
]

const SWIPE_THRESHOLD = 60   // 触发滑开的水平位移阈值(px)
const SWIPE_WIDTH    = 130   // 滑开后露出的删除按钮宽度(rpx)

/** 金额格式化：123456 → "1,234.56" */
function fmt(fen) {
  const yuan = Math.abs(fen) / 100
  const parts = yuan.toFixed(2).split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.join('.')
}

Page({
  data: {
    // 月份导航
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,

    // 月度统计（原始，计算用）
    stats: { totalIncome: 0, totalExpense: 0, balance: 0, count: 0 },
    // 月度统计（格式化，展示用）
    statsDisplay: { income: '0.00', expense: '0.00', balance: '0.00' },

    // 记录列表
    list: [],

    // 左滑删除
    swipedId: '',

    // 扇形图
    chartType: 'expense',
    chartData: [],
    chartTotal: 0,
    chartEmpty: true,

    // 添加弹层
    showAdd: false,
    addType: 'expense',
    addAmount: '',
    addCategory: '',
    addDate: '',
    addNote: '',

    // 分类选择
    expenseCats: bk.EXPENSE_CATS,
    incomeCats: bk.INCOME_CATS,
    activeCats: bk.EXPENSE_CATS
  },

  onLoad() {
    if (!app.globalData.isLoggedIn) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    this._refresh()
  },

  onShow() {
    this._refresh()
    bk.pullFromCloud().then(count => {
      if (count > 0) this._refresh()
    })
  },

  onReady() {
    setTimeout(() => this._drawChart(), 300)
  },

  // ====================================================
  //  数据刷新
  // ====================================================

  _refresh() {
    const { year, month } = this.data
    const stats = bk.monthlyStats(year, month)
    const list = bk.getByMonth(year, month).map(t => {
      const cat = bk.getCategoryInfo(t.category, t.type)
      return {
        ...t,
        catEmoji: cat.emoji,
        catLabel: cat.label,
        _sign: t.type === 'income' ? '+' : '-',
        _amountStr: fmt(t.amount)
      }
    })

    const statsDisplay = {
      income:  fmt(stats.totalIncome),
      expense: fmt(stats.totalExpense),
      balance: fmt(Math.abs(stats.balance))
    }

    this.setData({ stats, statsDisplay, list, swipedId: '' }, () => {
      this._computeChartData(true)
    })
  },

  /** 从 byCategory 计算图表数据 */
  _computeChartData(autoSwitch) {
    const { stats, chartType } = this.data
    const byCategory = stats.byCategory || {}
    const items = []
    let total = 0

    Object.keys(byCategory).forEach((key, idx) => {
      const cat = byCategory[key]
      const amount = chartType === 'expense' ? cat.expense : cat.income
      if (amount > 0) {
        items.push({
          key,
          label: cat.label || key,
          emoji: cat.emoji || '📌',
          amount,
          percent: 0,
          color: DONUT_COLORS[idx % DONUT_COLORS.length]
        })
        total += amount
      }
    })

    items.forEach(item => {
      item.percent = total > 0 ? Math.round((item.amount / total) * 100) : 0
    })
    items.sort((a, b) => b.amount - a.amount)

    const empty = items.length === 0
    if (autoSwitch && empty && chartType === 'expense') {
      const incomeItems = []
      let incTotal = 0
      Object.keys(byCategory).forEach((key, idx) => {
        const cat = byCategory[key]
        if (cat.income > 0) {
          incomeItems.push({
            key, label: cat.label || key, emoji: cat.emoji || '📌',
            amount: cat.income, percent: 0,
            color: DONUT_COLORS[idx % DONUT_COLORS.length]
          })
          incTotal += cat.income
        }
      })
      if (incomeItems.length > 0) {
        incomeItems.forEach(i => { i.percent = Math.round((i.amount / incTotal) * 100) })
        incomeItems.sort((a, b) => b.amount - a.amount)
        this.setData({ chartType: 'income', chartData: incomeItems, chartTotal: incTotal, chartEmpty: false }, () => {
          setTimeout(() => this._drawChart(), 200)
        })
        return
      }
    }

    this.setData({ chartData: items, chartTotal: total, chartEmpty: empty }, () => {
      setTimeout(() => this._drawChart(), 200)
    })
  },

  // ====================================================
  //  Canvas 绘制扇形图
  // ====================================================

  _drawChart() {
    const query = wx.createSelectorQuery().in(this)
    query.select('#donutCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio
        const w = res[0].width
        const h = res[0].height
        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, w, h)

        const { chartData, chartTotal, chartEmpty } = this.data
        const cx = w / 2
        const cy = h / 2
        const outerR = Math.min(w, h) / 2 - 8
        const innerR = outerR * 0.58

        if (chartEmpty || chartData.length === 0) {
          ctx.beginPath()
          ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
          ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true)
          ctx.fillStyle = '#f0ede8'
          ctx.fill()
          ctx.fillStyle = '#b5a99a'
          ctx.font = `${outerR * 0.28}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('暂无数据', cx, cy)
          return
        }

        // 画弧段
        let startAngle = -Math.PI / 2
        chartData.forEach(item => {
          const sweep = (item.amount / chartTotal) * Math.PI * 2
          const endAngle = startAngle + sweep

          ctx.beginPath()
          ctx.moveTo(cx + innerR * Math.cos(startAngle), cy + innerR * Math.sin(startAngle))
          ctx.arc(cx, cy, outerR, startAngle, endAngle)
          ctx.arc(cx, cy, innerR, endAngle, startAngle, true)
          ctx.closePath()
          ctx.fillStyle = item.color
          ctx.fill()

          // 段间缝隙
          ctx.beginPath()
          ctx.moveTo(cx + innerR * Math.cos(endAngle), cy + innerR * Math.sin(endAngle))
          ctx.arc(cx, cy, outerR + 1, endAngle, endAngle + 0.02)
          ctx.arc(cx, cy, innerR - 1, endAngle + 0.02, endAngle, true)
          ctx.closePath()
          ctx.fillStyle = '#faf8f5'
          ctx.fill()

          startAngle = endAngle + 0.02
        })

        // 中心文字
        const typeLabel = this.data.chartType === 'expense' ? '总支出' : '总收入'
        ctx.fillStyle = '#8c7b6e'
        ctx.font = `${outerR * 0.22}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillText(typeLabel, cx, cy - outerR * 0.1)

        ctx.fillStyle = '#4a3f35'
        ctx.font = `bold ${outerR * 0.32}px sans-serif`
        ctx.textBaseline = 'top'
        const txt = '¥' + fmt(chartTotal)
        ctx.fillText(txt, cx, cy + outerR * 0.05)
      })
  },

  onToggleChart() {
    const next = this.data.chartType === 'expense' ? 'income' : 'expense'
    this.setData({ chartType: next, swipedId: '' }, () => {
      this._computeChartData()
    })
  },

  // ====================================================
  //  月份导航
  // ====================================================

  onPrevMonth() {
    let { year, month } = this.data
    month--
    if (month < 1) { month = 12; year-- }
    this.setData({ year, month })
    this._refresh()
  },

  onNextMonth() {
    let { year, month } = this.data
    month++
    if (month > 12) { month = 1; year++ }
    this.setData({ year, month })
    this._refresh()
  },

  // ====================================================
  //  添加记录
  // ====================================================

  onOpenAdd() {
    const now = new Date()
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    this.setData({
      showAdd: true,
      addType: 'expense',
      addAmount: '',
      addCategory: '',
      addDate: date,
      addNote: '',
      activeCats: bk.EXPENSE_CATS
    })
  },

  onCloseAdd() {
    this.setData({ showAdd: false }, () => {
      // 弹层关闭后重绘图表（Canvas 曾被 hidden）
      setTimeout(() => this._drawChart(), 200)
    })
  },

  onSwitchType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({
      addType: type,
      addCategory: '',
      activeCats: type === 'income' ? bk.INCOME_CATS : bk.EXPENSE_CATS
    })
  },

  onAmountInput(e) {
    this.setData({ addAmount: e.detail.value })
  },

  onPickCategory(e) {
    this.setData({ addCategory: e.currentTarget.dataset.key })
  },

  onDateChange(e) {
    this.setData({ addDate: e.detail.value })
  },

  onNoteInput(e) {
    this.setData({ addNote: e.detail.value })
  },

  onConfirmAdd() {
    const { addType, addAmount, addCategory, addDate, addNote } = this.data
    const amountYuan = parseFloat(addAmount)
    if (!addAmount || isNaN(amountYuan) || amountYuan <= 0) {
      wx.showToast({ title: '请输入正确金额', icon: 'none' })
      return
    }
    if (!addCategory) {
      wx.showToast({ title: '请选择分类', icon: 'none' })
      return
    }

    bk.add({
      type: addType,
      amount: Math.round(amountYuan * 100),
      category: addCategory,
      date: addDate,
      note: addNote
    })

    this.setData({ showAdd: false })
    wx.showToast({ title: '已记录', icon: 'success', duration: 1200 })
    this._refresh()
  },

  // ====================================================
  //  左滑删除手势
  // ====================================================
  onTouchStart(e) {
    // 记录起始坐标
    this._touchData = {
      id: e.currentTarget.dataset.id,
      sx: e.touches[0].clientX,
      sy: e.touches[0].clientY,
      moved: false
    }
  },

  onTouchMove(e) {
    if (!this._touchData) return
    const dx = e.touches[0].clientX - this._touchData.sx
    const dy = e.touches[0].clientY - this._touchData.sy
    // 仅水平滑动（横向位移 > 纵向位移）
    if (!this._touchData.moved && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      this._touchData.moved = true
    }
  },

  onTouchEnd(e) {
    if (!this._touchData) return
    const { id, sx, moved } = this._touchData
    const dx = (e.changedTouches[0] || {}).clientX - sx || 0
    this._touchData = null

    if (!moved) return  // 纯点击 or 纵向滚动 — 不处理

    if (dx < -SWIPE_THRESHOLD) {
      // 左滑 → 展开删除
      this.setData({ swipedId: id })
    } else {
      // 右滑 or 未到阈值 → 收起
      if (this.data.swipedId) this.setData({ swipedId: '' })
    }
  },

  /** 点击已展开行之外 → 收起 */
  onTapRow(e) {
    if (this.data.swipedId) {
      const id = e.currentTarget.dataset.id
      if (id !== this.data.swipedId) {
        this.setData({ swipedId: '' })
      }
    }
  },

  // ====================================================
  //  删除记录
  // ====================================================

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条记录吗？',
      confirmColor: '#d4756b',
      success: (res) => {
        if (res.confirm) {
          bk.remove(id)
          this.setData({ swipedId: '' })
          wx.showToast({ title: '已删除', icon: 'success' })
          this._refresh()
        }
      }
    })
  },

  // ====================================================
  //  其他
  // ====================================================
  preventBubble() {}
})
