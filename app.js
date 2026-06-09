/**
 * 暖记生活 v1.0.3 — 小程序入口
 * 新增：登录态管理、v1→v2 数据迁移、云端同步预留
 * v1.0.3 改动：概览页瘦身、日历格文字标签、习惯页周导航
 */
const {
  loadAllData, initDefaultData, migrateV1Data, _migrateQuadrantsIfNeeded,
  getCurrentWeekStart, getHabits, getActiveHabits, fmtDate
} = require('./utils/data')
const storage = require('./utils/storage')

// 必须在 App() 注册之前初始化云环境，否则页面 onLoad 时云 API 尚未就绪
if (wx.cloud) {
  wx.cloud.init({
    env: 'cloud1-d4go8n0ph6464342d'
  })
}

App({
  globalData: {
    weekOffset: 0,            // 周偏移（0=本周）
    weekStart: '',            // 当前展示周的周一日期
    weekDates: [],            // 当前周的 7 天日期数组
    dataReady: false,
    dataVersion: 0,           // 数据版本号（每次写入递增，用于跨页同步）
    isLoggedIn: false,
    userInfo: null
  },

  onLaunch() {
    // 0. 初始化云开发环境（必须在其他云 API 之前调用）
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-d4go8n0ph6464342d'
      })
    }

    // 1. 检查登录态（同步读取缓存，不阻塞）
    this._checkLogin()

    // 2. 初始化数据（轻量操作，但用 setTimeout 避免阻塞启动）
    setTimeout(() => {
      initDefaultData()
      this._setWeek(0)

      // 3. 延迟执行迁移（避免启动超时）
      setTimeout(() => {
        migrateV1Data()
        _migrateQuadrantsIfNeeded()
      }, 200)
    }, 0)

    // 4. 异步日志（不阻塞启动流程）
    setTimeout(() => {
      const data = loadAllData()
      console.log('[暖记生活 v1.0.3] 启动', {
        weekStart: this.globalData.weekStart,
        habits: getActiveHabits().length,
        dates: Object.keys(data).filter(k => !k.startsWith('_')).length
      })
    }, 500)
  },

  /** 检查登录态 */
  _checkLogin() {
    const token = storage.get('token', '')
    const userInfo = storage.get('weekly-planner-user', null)
    if (token && userInfo) {
      this.globalData.isLoggedIn = true
      this.globalData.userInfo = userInfo
    }
  },

  /** 设置当前展示的周（通过偏移量） */
  setWeekOffset(offset) {
    this._setWeek(offset)
  },

  /** 内部：根据偏移量计算周一起始 */
  _setWeek(offset) {
    const now = new Date()
    const day = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1) + offset * 7)

    const weekStart = fmtDate(monday)
    const weekDates = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      weekDates.push(fmtDate(d))
    }

    this.globalData.weekOffset = offset
    this.globalData.weekStart = weekStart
    this.globalData.weekDates = weekDates
    this.globalData.dataReady = true
  },

  /** 刷新全局数据 */
  refreshData() {
    this._setWeek(this.globalData.weekOffset)
  },

  /** 通知所有页面：数据已变更（递增版本号） */
  notifyDataChanged() {
    this.globalData.dataVersion++
  }
})
