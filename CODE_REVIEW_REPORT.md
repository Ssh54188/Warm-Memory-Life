# 🔍 暖记生活 v1.0.3 — 代码审查报告

> **审查日期**: 2026-06-09  
> **项目路径**: `E:\AI\Claude Code\开发\shouzhaungApp(1)\shouzhaungApp`  
> **审查范围**: 全部 30+ 源文件（JS/WXML/WXSS）  
> **备份位置**: `E:\AI\Claude Code\开发\shouzhaungApp(1)\shouzhaungApp_backup_20260609_131129`

---

## 一、问题总览

| 优先级 | 数量 | 说明 |
|--------|------|------|
| 🔴 **致命** | 3 | 运行时崩溃 / 数据丢失 / 合规违规 |
| 🟠 **高危** | 5 | 安全缺陷 / 核心功能缺失 / 性能风险 |
| 🟡 **中危** | 6 | 代码质量 / 可维护性 / 边界条件 |
| 🔵 **低危** | 8 | 命名规范 / 冗余代码 / 优化建议 |

---

## 二、致命问题 🔴

### 🔴 #1 — nav-bar 组件运行时崩溃

| 项目 | 内容 |
|------|------|
| **文件** | `components/nav-bar/nav-bar.js` |
| **行号** | 第 4 行 |
| **严重度** | 🔴 致命 — 引用即崩溃 |
| **问题描述** | 组件 `require` 了 `data.js` 中不存在的导出项 `DAYS` 和 `DAY_LABELS` |

```javascript
// nav-bar.js:4 — 错误代码
const { DAYS, DAY_LABELS, fmtDate, getCurrentWeekStart } = require('../../utils/data')
```

`data.js` 实际只导出了 `WEEKDAY_LABELS`（格式为 `['周日','周一',...]`），不导出 `DAYS` 或 `DAY_LABELS`。该组件一旦被任何页面引用，在 `attached()` 生命周期（第 25 行）执行时就会因 `DAYS is not defined` 而白屏崩溃。

**修改方案**：
```javascript
// 修复后
const { fmtDate, WEEKDAY_LABELS } = require('../../utils/data')
const WEEK_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

// 在 _buildDays 方法中：
const days = WEEK_KEYS.map((key, i) => {
  const date = new Date(monday)
  date.setDate(monday.getDate() + i)
  const dateStr = fmtDate(date)
  return {
    key,
    label: WEEKDAY_LABELS[(i + 1) % 7],  // 周一~周日
    date: `${date.getMonth() + 1}/${date.getDate()}`,
    fullDate: dateStr,
    isToday: dateStr === today
  }
})
```

---

### 🔴 #2 — 账号注销清空全部用户数据（不可恢复）

| 项目 | 内容 |
|------|------|
| **文件** | `pages/profile/profile.js` |
| **行号** | 第 168 行 |
| **严重度** | 🔴 致命 — 数据永久丢失 |

**问题描述**：`onDeleteAccount()` 调用 `storage.clear()`，该方法（`utils/storage.js` 第 58-68 行）会遍历并删除所有以 `wps_` 为前缀的存储键。这不仅删除了用户登录信息，还会**清空所有待办、习惯打卡、笔记、四象限数据**。

```javascript
// profile.js:168 — 危险操作
onDeleteAccount() {
  wx.showModal({
    success: (res) => {
      if (res.confirm) {
        storage.clear()  // ← 清空全部数据！不可恢复！
        // ...
      }
    }
  })
}
```

用户的"注销账号"预期是清除登录态和个人信息，而不是丢失多年积累的手账数据。目前无任何二次确认或备份机制。

**修改方案**：
```javascript
onDeleteAccount() {
  wx.showModal({
    title: '账号注销',
    content: '注销后所有登录信息将被清除，但您的本地数据（待办、习惯、笔记）将被保留。',
    confirmText: '确定注销',
    confirmColor: '#d4756b',
    success: (res) => {
      if (res.confirm) {
        // 只清除登录相关数据，保留业务数据
        storage.remove('token')
        storage.remove('weekly-planner-user')
        storage.remove('weekly-planner-user-id')
        storage.set('account_deleted', true)
        app.globalData.isLoggedIn = false
        app.globalData.userInfo = null
        wx.showToast({ title: '账号已注销', icon: 'success' })
        setTimeout(() => wx.reLaunch({ url: '/pages/mine/mine' }), 800)
      }
    }
  })
}
```

---

### 🔴 #3 — 隐私政策 & 用户协议页面为空壳

| 项目 | 内容 |
|------|------|
| **文件** | `pages/privacy/privacy.js` + `pages/agreement/agreement.js` |
| **行号** | 各第 1 行 |
| **严重度** | 🔴 致命 — 审核必然拒绝 |

**问题描述**：两个页面均为 `Page({})`，没有任何内容。微信小程序审核强制要求：
1. 必须在首次打开时展示隐私政策并获得用户同意（`wx.getPrivacySetting` / `wx.requirePrivacyAuthorize`）
2. 必须提供可访问的隐私政策页面
3. 必须提供可访问的用户协议页面

当前代码不满足任何一项要求，提交审核 100% 被拒。

**修改方案**：
```javascript
// privacy.js — 最低要求
Page({
  data: { content: '' },
  onLoad() {
    // 加载隐私政策内容（至少 400 字）
    this.setData({
      content: '【暖记生活 隐私政策】\n\n更新日期：2026年6月9日\n\n' +
        '一、我们收集的信息\n...\n二、信息的使用\n...\n三、信息的存储\n...\n' +
        '四、您的权利\n...\n五、联系我们\n...'
    })
  }
})
```

同时在 `app.js` 启动时调用 `wx.requirePrivacyAuthorize()` 完成隐私授权弹窗。

---

## 三、高危问题 🟠

### 🟠 #4 — 登录系统完全为模拟（无真实后端认证）

| 项目 | 内容 |
|------|------|
| **文件** | `pages/login/login.js` |
| **行号** | 第 193-226 行、第 232-249 行、第 264-289 行 |
| **严重度** | 🟠 高危 — 安全空洞 |

**问题描述**：三种登录方式（微信/手机/邮箱）全部生成模拟 token：

```javascript
// login.js:199 — 模拟 token
const mockToken = `token_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
```

`wx.login()` 返回的 `code` 理应发送到后端换取 `openid` 和 `session_key`，但当前完全丢弃了这个 code。任何知道 `wps_token` 存储格式的人都可以伪造 token 登入任意账号。这不满足微信小程序的基本安全要求。

**修改方案**：建立真实的后端登录接口：
```javascript
// 修复后的 _doWechatLogin
_doWechatLogin(avatarUrl) {
  this.setData({ loading: true })
  wx.login({
    success: async (loginRes) => {
      try {
        const { data } = await request({
          url: '/auth/wechat-login',
          method: 'POST',
          data: {
            code: loginRes.code,
            nickName: this.data.nickName.trim(),
            avatarUrl
          }
        })
        this._onLoginSuccess(data.token, data.userInfo)
      } catch (e) {
        wx.showToast({ title: '登录失败，请重试', icon: 'none' })
        this.setData({ loading: false })
      }
    },
    fail: () => {
      wx.showToast({ title: '微信登录失败', icon: 'none' })
      this.setData({ loading: false })
    }
  })
}
```

---

### 🟠 #5 — 云端同步为虚假功能

| 项目 | 内容 |
|------|------|
| **文件** | `pages/mine/mine.js` |
| **行号** | 第 131-137 行 |
| **严重度** | 🟠 高危 — 误导用户 |

**问题描述**：`onSync()` 方法只显示 "数据已同步" toast，没有任何实际的数据上传或下载操作。用户点击后会产生"数据已在云端备份"的错觉，设备丢失后无法恢复。

```javascript
// mine.js:131-137 — 虚假同步
onSync() {
  if (!this.data.isLoggedIn) {
    wx.showToast({ title: '请先登录', icon: 'none' })
    return
  }
  wx.showToast({ title: '数据已同步', icon: 'success' })  // ← 什么都没做
}
```

**修改方案**：
```javascript
onSync() {
  if (!this.data.isLoggedIn) {
    wx.showToast({ title: '请先登录', icon: 'none' })
    return
  }
  this.setData({ syncing: true })
  wx.showLoading({ title: '同步中...' })
  
  // 上传本地数据到云端
  uploadData().then(() => {
    wx.hideLoading()
    wx.showToast({ title: '同步完成', icon: 'success' })
  }).catch(err => {
    wx.hideLoading()
    wx.showToast({ title: '同步失败: ' + err.message, icon: 'none' })
  }).finally(() => {
    this.setData({ syncing: false })
  })
}
```

如果短期内不实现真正的云端同步，应将按钮文案改为"数据导出备份"并通过 `wx.setClipboardData` 等方式让用户手动备份。

---

### 🟠 #6 — overview 页面 onShow 全量重算导致性能浪费

| 项目 | 内容 |
|------|------|
| **文件** | `pages/overview/overview.js` |
| **行号** | 第 51-54 行（onShow）、第 60-201 行（_loadAll） |
| **严重度** | 🟠 高危 — 每次切回都重算 |

**问题描述**：`onShow` 每次都调用 `_loadAll()`，该方法执行约 140 行代码，包括遍历所有日期的全量数据、计算问候语、构建四象限卡片等。`app.refreshData()` 第 52 行也会触发 `_setWeek` 重新计算周日期。Tab 切换时产生不必要的双重重算。

**修改方案**：引入脏标记（dirty flag），仅在数据变更后才重算：
```javascript
onShow() {
  if (app.globalData._dataDirty) {
    app.globalData._dataDirty = false
    app.refreshData()
    this._loadAll()
  }
}
```

---

### 🟠 #7 — 存储操作无异常处理

| 项目 | 内容 |
|------|------|
| **文件** | `utils/data.js` |
| **行号** | 全部 `loadAllData()` / `saveAllData()` 调用 |
| **严重度** | 🟠 高危 — 静默失败 |

**问题描述**：`data.js` 中所有数据的读写操作均未包裹 try-catch。虽然底层的 `storage.js` 封装层做了异常处理（`get` 返回默认值、`set` 返回 boolean），但业务层的数十个函数（`addTodo`、`toggleTodo`、`addHabit`、`toggleHabitCheck` 等）在存储写入失败时不会通知调用方，导致用户界面与实际数据不一致。

**修改方案**：在关键业务函数中添加失败检测和用户提示：
```javascript
function addTodo(dateStr, text, priority, quadrantTaskId) {
  const all = loadAllData()
  if (!all[dateStr]) all[dateStr] = { todos: [], note: '' }
  const todo = { id: genId(), text, done: false, ... }
  all[dateStr].todos.push(todo)
  
  const success = saveAllData(all)
  if (!success) {
    console.error('[addTodo] 保存失败，存储空间可能不足')
    // 返回带错误信息的对象供 UI 层判断
    return { error: true, message: '存储空间不足，请清理数据', todo: null }
  }
  return { error: false, message: '', todo }
}
```

---

### 🟠 #8 — storage.clear() 函数命名歧义

| 项目 | 内容 |
|------|------|
| **文件** | `utils/storage.js` |
| **行号** | 第 58-68 行 |
| **严重度** | 🟠 高危 — 易误用 |

**问题描述**：`clearAll()` 清空的是所有以 `wps_` 为前缀的键（即整个应用的数据），而不是"清空某个存储项"。函数名 `clearAll` 可能被误解为只是清空登录缓存。`profile.js` 第 168 行已因此误用（见致命问题 #2）。

**修改方案**：重命名为更明确的名称，并添加 JSDoc 警告：
```javascript
/**
 * ⚠️ 清空本应用的所有本地数据（包括待办、习惯、笔记等）
 * 仅用于「数据管理-清空全部数据」功能
 * @deprecated 请勿在注销/退出登录等场景调用
 */
function clearAllAppData() { ... }
```

---

## 四、中危问题 🟡

### 🟡 #9 — 大量代码重复：象限拖拽 / 统计计算 / 周范围计算

| 项目 | 内容 |
|------|------|
| **涉及文件** | `calendar.js` + `quadrant.js`；`overview.js` + `habit.js` + `todo.js` |
| **严重度** | 🟡 中危 — 维护成本高 |

**重复 1 — 拖拽逻辑**：`calendar.js` 第 234-265 行与 `quadrant.js` 第 167-247 行几乎完全相同（`onLongPress`、`onTouchMove`、`onTouchEnd`、`_checkDropZone`），仅 `_checkDropZone` 的坐标计算略有差异。未来修改拖拽行为需要同时改两个文件。

**重复 2 — 统计计算**：`overview.js` 自己实现习惯周统计（第 100-113 行）和待办周统计（第 77-96 行），而不调用 `data.js` 中已导出的 `getHabitWeekStats()` 和 `getWeekTodoStats()`。

**重复 3 — 周范围文本**：`overview.js` 第 67-73 行、`habit.js` 第 107-111 行都需要手动计算 `weekRange` 字符串。应在 `data.js` 中提供 `formatWeekRange(weekStart)` 公共函数。

**修改方案**：
1. 提取 `utils/quadrant-drag.js` 作为混入（mixin）共用拖拽逻辑
2. overview 直接调用 `getHabitWeekStats(weekStart)` 和 `getWeekTodoStats(weekStart)`
3. 在 data.js 添加 `formatWeekRange(mondayStr)` 工具函数

---

### 🟡 #10 — app.js onLaunch 同步初始化阻塞启动

| 项目 | 内容 |
|------|------|
| **文件** | `app.js` |
| **行号** | 第 27 行 |
| **严重度** | 🟡 中危 — 可能触及 5 秒启动超时 |

```javascript
// app.js:27 — 同步读取全量存储
const data = initDefaultData()
this._setWeek(0)
```

`initDefaultData()` 读写了 `Storage` 全量数据，虽然后续 `migrateV1Data()` 用了 `setTimeout(200ms)` 延迟，但 `initDefaultData` 本身在数据量大时仍可能阻塞。微信对小程序冷启动有 5 秒超时限制。

**修改方案**：将数据初始化移到 `setTimeout` 中，首屏渲染更快：
```javascript
onLaunch() {
  this._checkLogin()
  this._setWeek(0)
  // 延迟初始化，不阻塞首帧
  setTimeout(() => {
    initDefaultData()
    migrateV1Data()
    _migrateQuadrantsIfNeeded()
  }, 100)
}
```

---

### 🟡 #11 — demo 页面残留于生产环境

| 项目 | 内容 |
|------|------|
| **文件** | `pages/demo/demo.js` |
| **行号** | 整个文件 + `app.json` 第 16 行 |
| **严重度** | 🟡 中危 |

**问题描述**：demo 页面包含硬编码的演示数据，且在 `app.json` 中注册。虽然 TabBar 中不可见，但可以通过 URL 直接访问。审核时可能被判定为无关页面。建议从 `app.json` 中移除。

---

### 🟡 #12 — 空目录残留

| 项目 | 内容 |
|------|------|
| **文件** | `pages/dewatermark/` |
| **严重度** | 🟡 中危 |

**问题描述**：`pages/dewatermark/` 目录存在但没有任何文件，也不在 `app.json` 中注册。可能是遗留的功能目录，建议清理。

---

### 🟡 #13 — todo 页面象限同步的竞态条件

| 项目 | 内容 |
|------|------|
| **文件** | `pages/todo/todo.js` |
| **行号** | 第 154-158 行 |
| **严重度** | 🟡 中危 |

```javascript
onAdd() {
  // ...
  const quadrantTask = addQuadrantTaskForDate(this.data.activeDate, priority, text)
  addTodo(this.data.activeDate, text, priority, quadrantTask ? quadrantTask.id : null)
  // ...
}
```

`addQuadrantTaskForDate` 和 `addTodo` 各自独立执行 `loadAllData()` → 修改 → `saveAllData()`，存在竞态条件：如果 `addTodo` 的 `loadAllData()` 在 `addQuadrantTaskForDate` 的 `saveAllData()` 之前执行，四象限任务会丢失。

**修改方案**：合并为原子操作：
```javascript
function addTodoWithQuadrant(dateStr, text, priority) {
  const all = loadAllData()
  // 确保数据存在
  if (!all[dateStr]) all[dateStr] = { todos: [], note: '' }
  _ensureQuadrantsByDate(all)
  if (!all._quadrantsByDate[dateStr]) { /* init */ }
  
  // 创建四象限任务
  const quadrantTask = { id: genId(), text, done: false, ... }
  if (all._quadrantsByDate[dateStr][priority]) {
    all._quadrantsByDate[dateStr][priority].push(quadrantTask)
  }
  // 创建待办
  const todo = { id: genId(), text, done: false, priority, quadrantTaskId: quadrantTask.id, ... }
  all[dateStr].todos.push(todo)
  // 一次性保存
  saveAllData(all)
  return { todo, quadrantTask }
}
```

---

### 🟡 #14 — calendar.js _buildCell 读取 this.data.activeDate

| 项目 | 内容 |
|------|------|
| **文件** | `pages/calendar/calendar.js` |
| **行号** | 第 100 行 |
| **严重度** | 🟡 中危 |

```javascript
// calendar.js:100
isSelected: fullDate === this.data.activeDate,
```

`_buildCell` 在 `_renderCalendar` 的 for 循环中被调用（~42 次），每次循环内都读取 `this.data.activeDate`。虽然在小程序中 `this.data` 的读取是同步的，但这意味着 `_renderCalendar` 执行期间如果 `activeDate` 被其他异步操作修改（如 `onCellTap` 中的异步 setData），会产生短暂的数据不一致。

**修改方案**：将 `activeDate` 作为参数传入：
```javascript
_renderCalendar(year, month, activeDate) {
  // ...
  cells.push(this._buildCell(..., activeDate))
}
```

---

## 五、低危问题 🔵

### 🔵 #15 — 命名不一致：存储键前缀

| 文件 | 行号 | 问题 |
|------|------|------|
| `storage.js` | 第 5 行 | 前缀为 `wps_` |
| `data.js` | 第 7 行 | 存储键为 `weekly-planner-data` |
| `data.js` | 第 588 行 | 备份键为 `_v2_backup` |
| `app.js` | 第 46 行 | 登录数据键为 `weekly-planner-user` |

这些键有的有 `wps_` 前缀（由 storage.js 自动添加），有的则是完整键名导致 storage.js 实际存储为 `wps_weekly-planner-data`。虽然功能正确，但命名逻辑不直观。

---

### 🔵 #16 — 魔法数字

| 文件 | 行号 | 数值 | 含义 |
|------|------|------|------|
| `overview.js` | 第 130 行 | `30` | 笔记预览截取长度 |
| `calendar.js` | 第 37 行 | `150` | 延迟加载毫秒数 |
| `habit.js` | 第 164 行 | `1` | 避免除零的最小值 |
| `todo.js` | 第 75 行 | `30` | 历史记录最大条数 |

建议提取为命名常量。

---

### 🔵 #17 — 未使用的导出

`data.js` 导出了以下可能未被使用的函数：
- `getWeekByOffset` — app.js 自己实现了相同逻辑
- `getWeekNumber` — overview.js 中自己计算（第 73 行）
- `DEFAULT_HABITS` — 仅内部使用
- `QUADRANT_COLORS` — 各页面直接定义了内联颜色
- `EMPTY_QUADRANTS` — 仅内部使用
- `getWeekTodoStats` — overview 自己实现了
- `getHabitWeekStats` — overview 和 habit 自己实现了

---

### 🔵 #18 — WXSS grid 布局兼容性风险

| 文件 | 行号 | 问题 |
|------|------|------|
| `overview.wxss` | 第 441 行 | `display: grid` 在部分旧版微信 WebView 中不支持 |

根据项目 `findings.md` 中的记录，已明确目标 2.0+ 基础库兼容。`display:grid` 在较旧安卓 WebView 中可能不生效，建议降级为 flexbox + 计算宽度，或添加 `@supports` 检测。

---

### 🔵 #19 — page 选择器上定义 CSS 变量可能有作用域问题

| 文件 | 行号 | 问题 |
|------|------|------|
| `app.wxss` | 第 10 行 | CSS 变量定义在 `page` 选择器上 |

在某些情况下，子组件（custom component）可能无法继承 page 上的 CSS 变量。如果组件需要使用这些变量，建议也定义在 `:root` 上或组件自身的样式文件中。

---

### 🔵 #20 — note 页面 textarea 性能问题

| 文件 | 行号 | 问题 |
|------|------|------|
| `note.wxml` | 第 30-41 行 | `auto-height="{{false}}"` 禁用了 textarea 的自动高度 |

当 `auto-height` 关闭时，textarea 需要手动设置高度。当前没有显式高度，可能导致输入体验不佳。

---

### 🔵 #21 — habit.js matchEmoji 函数过长

| 文件 | 行号 | 问题 |
|------|------|------|
| `habit.js` | 第 12-58 行 | 47 行的 emoji 匹配规则内嵌在页面文件中 |

建议提取到 `utils/habit-emoji.js` 成为独立模块，便于维护和测试。

---

### 🔵 #22 — sitemap.json 内容过简

| 文件 | 行号 | 问题 |
|------|------|------|
| `sitemap.json` | 全文 | 仅 62 字节 |

当前 sitemap 没有配置任何索引规则，意味着所有页面都不会被微信搜索收录。如果希望用户能通过微信搜索找到该小程序，需要配置 `rules`。

---

## 六、修改优先级建议

### 立即修复（影响审核 & 稳定性）
1. 🔴 #1 — nav-bar 组件修复
2. 🔴 #2 — 账号注销逻辑
3. 🔴 #3 — 隐私政策/用户协议内容

### 本周修复（影响功能完整性）
4. 🟠 #4 — 登录系统对接真实后端
5. 🟠 #5 — 同步功能实现或替代方案
6. 🟠 #7 — 存储异常处理
7. 🟡 #13 — todo 象限同步竞态

### 迭代优化（代码质量）
8. 🟡 #9 — 代码去重
9. 🟡 #11 — 清理 demo 页面
10. 🟡 #12 — 清理空目录
11. 🔵 #15-#22 — 命名规范、魔法数字等

---

## 七、项目亮点

尽管发现上述问题，项目也有许多做得好的地方：

- ✅ **设计令牌系统**：`app.wxss` 中的 CSS 变量体系（颜色、间距、字号、圆角、阴影）设计优秀，全局统一
- ✅ **存储封装层**：`storage.js` 提供了带前缀隔离和异常处理的统一存储接口
- ✅ **数据模型清晰**：`data.js` 的 API 层次分明（工具函数 → 数据读写 → 业务 API），函数职责单一
- ✅ **PITFALL 追踪文档**：`findings.md` 记录了平台兼容性踩坑，是团队协作的好习惯
- ✅ **用户交互细节**：习惯打卡的振动反馈、时长弹窗、象限拖拽等交互打磨到位
- ✅ **懒加载策略**：`lazyCodeLoading: "requiredComponents"` 已配置
- ✅ **代码注释**：各文件都有清晰的版本号和功能说明注释
