/**
 * 空状态占位组件
 */
Component({
  properties: {
    icon: {
      type: String,
      value: '📝'
    },
    text: {
      type: String,
      value: '还没有内容'
    },
    showBtn: {
      type: Boolean,
      value: false
    },
    btnText: {
      type: String,
      value: '添加'
    }
  },

  methods: {
    onAction() {
      this.triggerEvent('action')
    }
  }
})
