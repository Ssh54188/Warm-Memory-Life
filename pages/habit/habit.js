/**
 * 习惯打卡 — v1.0.3
 * 支持：周导航 + 习惯库管理 + 激活/停用 + 整周打卡视图
 */
const {
  addHabit, toggleHabitActive, deleteHabit, toggleHabitCheck,
  loadAllData, fmtDate
} = require('../../utils/data')
const app = getApp()

/** 根据习惯名称自动匹配 emoji */
function matchEmoji(name) {
  const lower = name.toLowerCase()
  const rules = [
    { emoji: '🍽️', keywords: ['吃', '饭', '餐', '早餐', '午餐', '晚餐', '宵夜', '做饭', '下厨', '外卖', '食堂', '餐厅', '美食', '零食'] },
    { emoji: '🛒', keywords: ['购物', '买', '采购', '逛街', '淘宝', '京东', '拼多多', '消费', '购物车', '下单', '支付'] },
    { emoji: '🏃', keywords: ['跑', '运动', '锻炼', '健身', '晨练', '跑步', '跳绳', '有氧', '打球', '篮球', '足球', '羽毛球', '游泳'] },
    { emoji: '📖', keywords: ['读', '书', '学习', '阅读', '看书', '读书', '学习', '复习', '背单词', '上课', '听课', '网课', '自学'] },
    { emoji: '🧘', keywords: ['冥想', '静坐', '禅', '瑜伽', '放松', '呼吸', '正念', '打坐', '冥想'] },
    { emoji: '😴', keywords: ['睡', '早睡', '早起', '睡眠', '休息', '午休', '小睡', '熬夜', '睡觉', '起床'] },
    { emoji: '💧', keywords: ['水', '喝水', '饮水', '补水', '多喝水', '饮水提醒', '喝水'] },
    { emoji: '✍️', keywords: ['写', '日记', '写作', '记录', '笔记', '手账', '练字', '作文', '文章', '博客', '周报'] },
    { emoji: '💪', keywords: ['力量', '举铁', '俯卧撑', '深蹲', '增肌', '训练', '哑铃', '器械', '健身房'] },
    { emoji: '🍎', keywords: ['水果', '苹果', '健康', '饮食', '蔬菜', '吃水果', '营养', '维生素', '健康餐'] },
    { emoji: '🎯', keywords: ['目标', '计划', '专注', '完成', '达成', '任务', '里程碑', '规划', '目标设定'] },
    { emoji: '🌟', keywords: ['坚持', '打卡', '连续', '成就', '优秀', '进步', '养成', '自律', '坚持'] },
    { emoji: '🎵', keywords: ['音乐', '听歌', '练琴', '唱歌', '乐器', '放松音乐', '钢琴', '吉他', '唱歌'] },
    { emoji: '💡', keywords: ['创意', '思考', '想法', '灵感', '脑力', '学习', '新知识', '创新', '点子'] },
    { emoji: '📱', keywords: ['手机', '屏幕', '使用时间', '少玩手机', '戒手机', '刷视频', '玩游戏', '社交软件'] },
    { emoji: '☕', keywords: ['咖啡', '茶', '饮料', '提神', '早餐', '饮品', '奶茶', '拿铁', '美式'] },
    { emoji: '🚶', keywords: ['走', '散步', '步行', '走路', '户外', '遛狗', '遛弯', '散步'] },
    { emoji: '🚫', keywords: ['戒', '不', '少', '减少', '避免', '停止', '戒掉', '戒除', '戒烟', '戒酒'] },
    { emoji: '💰', keywords: ['钱', '理财', '记账', '储蓄', '投资', '消费', '预算', '省钱', '花钱'] },
    { emoji: '📝', keywords: ['计划', '清单', '待办', '任务', '日程', '安排', '时间管理'] },
    { emoji: '🧹', keywords: ['打扫', '清洁', '整理', '收拾', '家务', '拖地', '擦桌子', '洗衣服'] },
    { emoji: '🚿', keywords: ['洗澡', '洗漱', '洗脸', '刷牙', '沐浴', '个人卫生'] },
    { emoji: '👨‍💻', keywords: ['工作', '上班', '加班', '编程', '代码', '项目', '会议', '汇报'] },
    { emoji: '👨‍👩‍👧‍👦', keywords: ['家庭', '家人', '父母', '孩子', '陪伴', '亲子', '家庭时间'] },
    { emoji: '📞', keywords: ['电话', '联系', '沟通', '聊天', '社交', '朋友', '聚会'] },
    { emoji: '🎬', keywords: ['电影', '电视', '追剧', '看剧', '视频', '娱乐', '放松'] },
    { emoji: '🎮', keywords: ['游戏', '打游戏', '电竞', '娱乐', '放松', '手游', '主机游戏'] },
    { emoji: '🌿', keywords: ['植物', '养花', '绿植', '园艺', '种植', '浇水', '盆栽'] },
    { emoji: '🐶', keywords: ['宠物', '狗', '猫', '喂食', '遛狗', '宠物护理', '铲屎'] },
    { emoji: '🚗', keywords: ['开车', '驾驶', '通勤', '出行', '地铁', '公交', '交通'] },
    { emoji: '📚', keywords: ['图书馆', '借书', '还书', '学习资料', '教材', '参考书'] },
    { emoji: '🛌', keywords: ['床', '睡眠', '休息', '午睡', '小憩', '打盹'] },
    { emoji: '🧴', keywords: ['护肤', '面膜', '保养', '美容', '化妆品', '护肤品'] },
    { emoji: '🧠', keywords: ['记忆', '背诵', '学习', '思考', '脑力训练', '智力'] },
    { emoji: '🎨', keywords: ['画画', '艺术', '创作', '手工', '设计', '绘画', '涂鸦'] }
  ]
  
  for (const rule of rules) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return rule.emoji
    }
  }
  return '⭐' // 默认
}

Page({
  data: {
    weekStart: '',
    weekRange: '',
    weekDates: [],
    activeHabits: [],          // 已激活的习惯
    inactiveHabits: [],        // 停用的习惯
    allHabits: [],             // 全部习惯

    // 打卡矩阵 { habitName: [bool x 7] }
    checkMatrix: {},
    todayStr: '',               // 今天日期，用于高亮可打卡列
    todayCol: -1,               // 今天在周中的列索引
    dayLabels: ['一', '二', '三', '四', '五', '六', '日'],

    // 统计
    stats: { todayDone: 0, weekDone: 0, rate: 0 },

    // 添加弹窗
    showAddModal: false,
    newHabitName: '',
    newHabitEmoji: '⭐'
  },

  onLoad() {
    this._loadData()
  },

  onShow() {
    this._loadData()
  },

  _loadData() {
    const { weekDates, weekStart } = app.globalData
    const todayStr = fmtDate(new Date())
    const todayCol = weekDates.indexOf(todayStr)
    const allData = loadAllData()

    // 周范围文本
    const [y, m, d] = weekStart.split('-').map(Number)
    const monday = new Date(y, m - 1, d)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const weekRange = `${monday.getMonth() + 1}/${monday.getDate()} - ${sunday.getMonth() + 1}/${sunday.getDate()}`

    // 习惯列表
    const allHabits = allData._habits && Array.isArray(allData._habits) ? allData._habits : []
    const activeHabits = allHabits.filter(h => h.active !== false)
    const inactiveHabits = allHabits.filter(h => h.active === false)

    // 统计
    let todayDone = 0, weekDone = 0
    const totalPossible = activeHabits.length * 7

    // 打卡矩阵（一次遍历同时做统计）
    const checkMatrix = {}
    activeHabits.forEach(h => {
      checkMatrix[h.name] = weekDates.map(d => {
        const checks = (allData._habitChecks && allData._habitChecks[d]) || {}
        const checked = !!checks[h.name]
        if (checked) {
          weekDone++
          if (d === todayStr) todayDone++
        }
        return checked
      })
    })

    const stats = {
      todayDone,
      weekDone,
      totalPossible,
      rate: totalPossible > 0 ? Math.round((weekDone / totalPossible) * 100) : 0
    }

    this.setData({
      weekStart, weekRange, weekDates, activeHabits, inactiveHabits, allHabits,
      checkMatrix, stats, todayStr, todayCol
    })
  },

  // ====================================================
  //  周导航
  // ====================================================

  onPrevWeek() {
    app.setWeekOffset(app.globalData.weekOffset - 1)
    this._loadData()
  },

  onNextWeek() {
    app.setWeekOffset(app.globalData.weekOffset + 1)
    this._loadData()
  },

  onCurrentWeek() {
    app.setWeekOffset(0)
    this._loadData()
  },

  onToggle(e) {
    const { habit, date } = e.currentTarget.dataset
    const todayStr = fmtDate(new Date())
    // 只允许打卡今天
    if (date !== todayStr) {
      wx.showToast({ title: '只能打卡今天哦', icon: 'none', duration: 1000 })
      return
    }
    toggleHabitCheck(date, habit)
    this._loadData()
    try { wx.vibrateShort({ type: 'light' }) } catch (e) { wx.vibrateShort() }
  },

  // ====================================================
  //  习惯管理
  // ====================================================

  onToggleActive(e) {
    const { habit } = e.currentTarget.dataset
    const nowActive = toggleHabitActive(habit)
    this._loadData()
    wx.showToast({
      title: nowActive ? '已激活' : '已停用',
      icon: 'success'
    })
  },

  onDeleteHabit(e) {
    const { habit } = e.currentTarget.dataset
    wx.showModal({
      title: '删除习惯',
      content: `确定删除「${habit}」吗？\n历史打卡数据将保留。`,
      confirmColor: '#d4756b',
      success: (res) => {
        if (res.confirm) {
          deleteHabit(habit)
          this._loadData()
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  },

  // ====================================================
  //  添加弹窗
  // ====================================================

  onShowAdd() {
    this.setData({ showAddModal: true, newHabitName: '', newHabitEmoji: '⭐' })
  },

  onHideAdd() {
    this.setData({ showAddModal: false })
  },

  onNameInput(e) {
    const name = e.detail.value
    this.setData({ newHabitName: name, newHabitEmoji: matchEmoji(name) })
  },

  onConfirmAdd() {
    const name = this.data.newHabitName.trim()
    if (!name) return

    if (!addHabit(name, this.data.newHabitEmoji)) {
      wx.showToast({ title: '习惯已存在', icon: 'none' })
      return
    }

    this.setData({ showAddModal: false })
    this._loadData()
    wx.showToast({ title: '已添加', icon: 'success' })
  },

  // ====================================================
  //  跳转管理页
  // ====================================================

  goManage() {
    wx.navigateTo({ url: '/pages/habit/manage' })
  }
})
