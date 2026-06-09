/**
 * 四象限拖拽行为 — 共享 Behavior
 * 用于 calendar 和 quadrant 页面，消除 ~70 行重复代码
 *
 * 使用方式：
 *   const dragBehavior = require('../../utils/quadrant-drag-behavior')
 *   Page({ behaviors: [dragBehavior], ... })
 *
 * 页面需提供:
 *   - data.quadrants (含 key 字段)
 *   - moveQuadrantTask(from, to, id) 方法
 *   - 可选 dragComplete 回调
 */
const { moveQuadrantTask } = require('./data')

module.exports = Behavior({
  data: {
    dragging: false,
    dragTask: null,
    dragFromKey: '',
    dragX: 0,
    dragY: 0,
    dragTargetKey: ''
  },

  methods: {
    /** 长按启动拖拽 */
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
      try { wx.vibrateShort({ type: 'medium' }) } catch (_) {}
    },

    /** 手指移动 */
    onTouchMove(e) {
      if (!this.data.dragging) return
      const touch = e.touches[0]
      this.setData({
        dragX: touch.clientX - 50,
        dragY: touch.clientY - 25
      })
      this._checkDropZone(touch.clientX, touch.clientY)
    },

    /** 手指抬起 */
    onTouchEnd() {
      if (!this.data.dragging) return
      const { dragFromKey, dragTask, dragTargetKey } = this.data

      if (dragTargetKey && dragTargetKey !== dragFromKey) {
        // 由页面实现 _doMoveQuadrantTask(from, to, id)
        if (typeof this._doMoveQuadrantTask === 'function') {
          this._doMoveQuadrantTask(dragFromKey, dragTargetKey, dragTask)
        }
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

    /** 根据屏幕坐标计算目标象限 */
    _checkDropZone(clientX, clientY) {
      const winInfo = wx.getWindowInfo
        ? wx.getWindowInfo()
        : wx.getSystemInfoSync()
      const w = winInfo.windowWidth
      const h = winInfo.windowHeight

      // 允许页面自定义偏移（用于日历页面的不同布局）
      const headerH = this._dragHeaderOffset || 100
      const footerH = this._dragFooterOffset || 0

      const midX = w / 2
      const midY = headerH + (h - headerH - footerH) / 2

      let targetKey = ''
      if (clientY >= headerH && clientY <= h - footerH) {
        if (clientX < midX && clientY < midY) {
          targetKey = 'urgent-important'
        } else if (clientX >= midX && clientY < midY) {
          targetKey = 'not-urgent-important'
        } else if (clientX < midX) {
          targetKey = 'urgent-not-important'
        } else {
          targetKey = 'not-urgent-not-important'
        }
      }

      if (targetKey !== this.data.dragTargetKey) {
        this.setData({ dragTargetKey: targetKey })
      }
    }
  }
})
