/**
 * 习惯库管理 — v1.0.2 子页面
 * 管理所有习惯的激活/停用/删除/排序
 */
const {
  getHabits, addHabit, toggleHabitActive, deleteHabit
} = require('../../utils/data')

Page({
  data: {
    habits: [],
    showAdd: false,
    newName: '',
    newEmoji: '⭐',
    emojiPresets: ['🏃', '📖', '🧘', '😴', '💧', '✍️', '💪', '🍎', '🎯', '🌟', '🎵', '💡', '🧹', '🍳', '🌱']
  },

  onShow() {
    this._load()
  },

  _load() {
    const habits = getHabits()
    this.setData({ habits })
  },

  // ====================================================
  //  操作
  // ====================================================

  onToggle(e) {
    const { name } = e.currentTarget.dataset
    const result = toggleHabitActive(name)
    this._load()
    wx.showToast({ title: result ? '已激活' : '已停用', icon: 'success', duration: 800 })
  },

  onDelete(e) {
    const { name } = e.currentTarget.dataset
    wx.showModal({
      title: '删除习惯',
      content: `确定删除「${name}」吗？\n历史打卡数据将保留。`,
      confirmColor: '#d4756b',
      success: (res) => {
        if (res.confirm) {
          deleteHabit(name)
          this._load()
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  },

  // ====================================================
  //  添加
  // ====================================================

  onShowAdd() {
    this.setData({ showAdd: true, newName: '', newEmoji: '⭐' })
  },

  onHideAdd() {
    this.setData({ showAdd: false })
  },

  onNameInput(e) {
    this.setData({ newName: e.detail.value })
  },

  onSelectEmoji(e) {
    this.setData({ newEmoji: e.currentTarget.dataset.emoji })
  },

  onConfirmAdd() {
    const name = this.data.newName.trim()
    if (!name) return

    if (!addHabit(name, this.data.newEmoji)) {
      wx.showToast({ title: '习惯名称已存在', icon: 'none' })
      return
    }

    this.setData({ showAdd: false })
    this._load()
    wx.showToast({ title: '已添加', icon: 'success' })
  }
})
