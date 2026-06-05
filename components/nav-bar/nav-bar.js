/**
 * 星期切换导航栏组件
 */
const { DAYS, DAY_LABELS, fmtDate, getCurrentWeekStart } = require('../../utils/data')

Component({
  properties: {
    /** 当前展示的周起始日期 */
    weekStart: {
      type: String,
      value: ''
    },
    /** 当前选中的天 */
    activeDay: {
      type: String,
      value: 'mon'
    }
  },

  data: {
    days: []
  },

  lifetimes: {
    attached() {
      this._buildDays(this.properties.weekStart)
    }
  },

  observers: {
    'weekStart'(weekStart) {
      this._buildDays(weekStart)
    }
  },

  methods: {
    /** 根据周起始日期计算 7 天数据 */
    _buildDays(weekStart) {
      if (!weekStart) {
        weekStart = getCurrentWeekStart()
      }

      const [y, m, d] = weekStart.split('-').map(Number)
      const monday = new Date(y, m - 1, d)
      const today = fmtDate(new Date())

      const days = DAYS.map((key, i) => {
        const date = new Date(monday)
        date.setDate(monday.getDate() + i)
        const dateStr = fmtDate(date)
        return {
          key,
          label: DAY_LABELS[i],
          date: `${date.getMonth() + 1}/${date.getDate()}`,
          fullDate: dateStr,
          isToday: dateStr === today
        }
      })

      this.setData({ days })
    },

    /** 点击某天 */
    onDayTap(e) {
      const day = e.currentTarget.dataset.day
      this.triggerEvent('daychange', { day })
    }
  }
})
