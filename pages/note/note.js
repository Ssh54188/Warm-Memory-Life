/**
 * 记事本 — v1.0.2
 * 按日期记录笔记 + 历史列表侧边栏 + 自动保存
 */
const { getNote, saveNote, getNoteDates, fmtDate, WEEKDAY_LABELS } = require('../../utils/data')
const storage = require('../../utils/storage')
const app = getApp()

const MOODS = [
  { emoji: '😊', label: '开心' },
  { emoji: '😄', label: '超棒' },
  { emoji: '😐', label: '一般' },
  { emoji: '😢', label: '难过' },
  { emoji: '😠', label: '生气' },
  { emoji: '😴', label: '疲惫' },
  { emoji: '💪', label: '充满力量' },
  { emoji: '🥰', label: '幸福' },
  { emoji: '🤔', label: '思考' },
  { emoji: '🙏', label: '感恩' }
]

const TEMPLATES = [
  { icon: '📝', name: '今日三件事', content: '📌 今天最重要的三件事：\n1. \n2. \n3. \n\n' },
  { icon: '🙏', name: '感恩日记', content: '💖 今天值得感恩的事：\n1. \n2. \n3. \n\n' },
  { icon: '🔄', name: '每日复盘', content: '✅ 完成：\n\n⚠️ 困难：\n\n💡 学到：\n' },
  { icon: '💭', name: '自由书写', content: '💭 ' }
]

Page({
  data: {
    activeDate: '',
    activeDateLabel: '',
    content: '',
    saved: true,

    // 统计
    chars: 0,
    lines: 0,

    // 心情
    moods: MOODS,

    // 模板
    showTemplates: false,
    templates: TEMPLATES,

    // 历史
    showHistory: false,
    historyDates: []
  },

  _saveTimer: null,

  onLoad() {
    const activeDate = app.globalData._activeDate || fmtDate(new Date())
    app.globalData._activeDate = null
    this.setData({ activeDate })
    this._loadData()
  },

  onShow() {
    app.refreshData()
    this._loadData()
  },

  onUnload() {
    if (this._saveTimer) clearTimeout(this._saveTimer)
    this._doSave()
  },

  _loadData() {
    const activeDate = this.data.activeDate
    const content = getNote(activeDate)
    const d = new Date(activeDate)
    const activeDateLabel = `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAY_LABELS[d.getDay()]}`

    const chars = content.length
    const lines = content ? content.split('\n').length : 0

    // 历史
    const historyDates = getNoteDates()

    this.setData({
      activeDateLabel, content, saved: true,
      chars, lines, historyDates
    })
  },

  // ====================================================
  //  日期选择
  // ====================================================

  onPrevDay() {
    const d = new Date(this.data.activeDate)
    d.setDate(d.getDate() - 1)
    if (this._saveTimer) clearTimeout(this._saveTimer)
    this._doSave()
    this.setData({ activeDate: fmtDate(d) })
    this._loadData()
  },

  onNextDay() {
    const d = new Date(this.data.activeDate)
    d.setDate(d.getDate() + 1)
    if (this._saveTimer) clearTimeout(this._saveTimer)
    this._doSave()
    this.setData({ activeDate: fmtDate(d) })
    this._loadData()
  },

  onToday() {
    if (this._saveTimer) clearTimeout(this._saveTimer)
    this._doSave()
    this.setData({ activeDate: fmtDate(new Date()) })
    this._loadData()
  },

  // ====================================================
  //  输入 & 保存
  // ====================================================

  onInput(e) {
    const content = e.detail.value
    const chars = content.length
    const lines = content ? content.split('\n').length : 0

    this.setData({ content, saved: false, chars, lines })

    if (this._saveTimer) clearTimeout(this._saveTimer)
    this._saveTimer = setTimeout(() => this._doSave(), 600)
  },

  _doSave() {
    const { activeDate, content } = this.data
    saveNote(activeDate, content)
    this.setData({ saved: true })
  },

  // ====================================================
  //  心情插入
  // ====================================================

  onInsertMood(e) {
    const { emoji, label } = e.currentTarget.dataset
    let content = this.data.content
    content = content.replace(/^([\u{1F300}-\u{1FAFF}].*\n?)/mu, '')
    const moodLine = `${emoji} 今日心情：${label}\n`
    content = moodLine + content

    this.setData({ content, saved: false })
    if (this._saveTimer) clearTimeout(this._saveTimer)
    this._doSave()
    this._loadData()
    wx.showToast({ title: '心情已标记', icon: 'success', duration: 800 })
  },

  // ====================================================
  //  模板
  // ====================================================

  onShowTemplates() { this.setData({ showTemplates: true }) },
  onHideTemplates() { this.setData({ showTemplates: false }) },

  onInsertTemplate(e) {
    const { template } = e.currentTarget.dataset
    const newContent = this.data.content ? this.data.content + '\n' + template : template
    this.setData({ content: newContent, showTemplates: false, saved: false })
    if (this._saveTimer) clearTimeout(this._saveTimer)
    this._doSave()
    this._loadData()
    wx.showToast({ title: '模板已插入', icon: 'success' })
  },

  // ====================================================
  //  历史侧边栏
  // ====================================================

  onToggleHistory() { this.setData({ showHistory: !this.data.showHistory }) },

  onSelectHistory(e) {
    const { date } = e.currentTarget.dataset
    this.setData({ activeDate: date, showHistory: false })
    this._loadData()
  },

  // ====================================================
  //  导出
  // ====================================================

  onExport() {
    const { content, activeDateLabel } = this.data
    if (!content.trim()) {
      wx.showToast({ title: '没有内容可导出', icon: 'none' })
      return
    }
    const exportText = `暖记生活 — ${activeDateLabel}\n${'─'.repeat(20)}\n\n${content}\n\n${'─'.repeat(20)}\n导出自：暖记生活小程序`
    wx.setClipboardData({ data: exportText, success: () => wx.showToast({ title: '已复制到剪贴板', icon: 'success' }) })
  }
})
