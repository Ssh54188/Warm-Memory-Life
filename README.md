# 暖记生活 (Warm Memory Life)

> 一个温暖贴心的微信小程序，帮助您记录生活中的每一个美好瞬间

## 📱 项目简介

**暖记生活** 是一款基于微信小程序的全生命周期个人管理工具，集成了待办事项、日程管理、习惯养成、笔记记录等功能，旨在为用户打造一个温暖、便捷的生活助手。

### 🎯 核心理念

- **温暖设计**：柔和的视觉设计，带给用户温暖的使用体验
- **全面管理**：覆盖生活方方面面，从待办到习惯，一站式解决
- **智能同步**：云端数据同步，多设备无缝切换
- **隐私优先**：所有数据本地存储，保护用户隐私

## ✨ 主要功能

### 1. 📋 待办事项 (Todo)
- **智能四象限管理**：基于艾森豪威尔矩阵，将待办分为紧急重要、重要不紧急、紧急不重要、不紧急不重要四个维度
- **日期管理**：支持按日期查看和管理待办
- **优先级标记**：快速标记任务优先级
- **完成状态追踪**：实时统计任务完成情况

### 2. 📅 日程管理 (Calendar)
- **月视图**：直观查看整月安排
- **日详情**：点击日期查看当日详情
- **四象限集成**：在日程中直接管理四象限任务
- **待办同步**：待办与日程双向同步

### 3. 📝 笔记记录 (Note)
- **快速记录**：随时随地记录灵感
- **日期归档**：按日期自动归档笔记
- **历史回顾**：轻松查看历史笔记

### 4. 💪 习惯养成 (Habit)
- **习惯打卡**：每日习惯打卡记录
- **时长统计**：记录每个习惯的投入时间
- **周统计**：查看本周习惯完成情况
- **习惯管理**：添加、编辑、删除习惯

### 5. 📊 概览面板 (Overview)
- **数据统计**：待办、习惯、笔记等数据一目了然
- **本周概览**：快速查看本周情况
- **最新笔记**：展示最新一条笔记

### 6. 👤 个人中心 (Mine/Profile)
- **用户信息**：查看和编辑个人信息
- **数据管理**：导出、导入、清空数据
- **关于应用**：版本信息、隐私政策等

### 7. 🤝 共享功能 (Share)
- **邀请码生成**：生成共享邀请码
- **接受邀请**：通过邀请码与他人共享数据
- **数据共享**：与家人、朋友共享待办和日程

## 🛠️ 技术架构

### 前端技术栈
- **框架**：微信小程序原生开发
- **UI设计**：自定义组件 + WXSS 样式
- **状态管理**：全局数据管理 (app.globalData)
- **本地存储**：wx.setStorageSync / wx.getStorageSync

### 后端技术栈（可选）
- **云开发**：微信云开发 (CloudBase)
  - 云函数：处理复杂业务逻辑
  - 云数据库：存储共享数据
  - 云存储：存储用户文件

### 核心文件结构
```
shouzhaungApp/
├── app.js                 # 应用入口，全局逻辑
├── app.json               # 应用配置
├── app.wxss               # 全局样式
├── project.config.json    # 项目配置
├── utils/
│   ├── data.js           # 核心数据模型和方法
│   ├── storage.js        # 本地存储封装
│   └── quadrant-drag-behavior.js  # 四象限拖拽行为
├── pages/
│   ├── overview/         # 概览页面
│   ├── todo/             # 待办页面
│   ├── calendar/         # 日程页面
│   ├── note/             # 笔记页面
│   ├── habit/            # 习惯页面
│   ├── mine/             # 个人中心
│   ├── profile/          # 用户资料
│   ├── quadrant/         # 四象限页面
│   ├── timeline/         # 时间线页面
│   ├── share/            # 共享页面
│   ├── login/            # 登录页面
│   ├── privacy/          # 隐私政策
│   └── agreement/        # 用户协议
└── cloudfunctions/       # 云函数
    ├── acceptInvitation/  # 接受邀请
    ├── getSharedData/     # 获取共享数据
    └── syncData/         # 同步数据
```

## 📦 安装部署

### 环境要求
- 微信开发者工具 1.0+
- 微信基础库 2.0+
- Node.js 10+ (可选，用于云函数开发)

### 本地开发
1. **克隆项目**
   ```bash
   git clone https://github.com/Ssh54188/Warm-Memory-Life.git
   cd Warm-Memory-Life
   ```

2. **导入项目**
   - 打开微信开发者工具
   - 选择"导入项目"
   - 选择项目目录
   - 填写 AppID (测试号或正式 AppID)

3. **配置云开发（可选）**
   - 在微信开发者工具中开通云开发
   - 创建云环境
   - 修改 `app.js` 中的云环境 ID
   - 上传云函数

4. **编译运行**
   - 点击"编译"按钮
   - 在模拟器中预览
   - 或使用"真机调试"在手机上测试

### 云端部署
1. **上传代码**
   ```bash
   git add .
   git commit -m "更新: 功能优化和Bug修复"
   git push origin main
   ```

2. **提交审核**
   - 在微信公众平台提交审核
   - 填写版本信息和审核说明
   - 等待微信团队审核

3. **发布上线**
   - 审核通过后点击"发布"
   - 等待发布生效（通常几分钟）

## 🔧 配置说明

### app.js 配置
```javascript
// 云开发环境配置
wx.cloud.init({
  env: 'cloud1-d4go8n0ph6464342d'  // 替换为您的云环境 ID
})
```

### project.config.json 配置
```json
{
  "description": "项目配置文件",
  "packOptions": {
    "ignore": [
      {"value": "cloudfunctions", "type": "folder"},
      {"value": "cloudfunctionTemplate", "type": "folder"}
    ]
  },
  "setting": {
    "urlCheck": false,
    "es6": true,
    "enhance": true,
    "postcss": true,
    "preloadBackgroundData": false,
    "minified": true,
    "newFeature": true,
    "autoAudits": false,
    "checkInvalidKey": true,
    "checkSiteMap": true,
    "uploadWithSourceMap": true,
    "babelSetting": {
      "ignore": [],
      "disablePlugins": [],
      "outputPath": ""
    }
  },
  "compileType": "miniprogram",
  "libVersion": "2.19.4",
  "appid": "touristappid",  // 替换为您的 AppID
  "projectname": "shouzhaungApp",
  "condition": {}
}
```

## 📝 数据模型

### 本地存储结构
```javascript
{
  // 按日期存储的数据
  "2026-06-10": {
    "todos": [
      {
        "id": "1717980000000_abc123",
        "text": "完成项目报告",
        "done": false,
        "priority": "urgent-important",
        "quadrantTaskId": "1717980000000_def456",
        "createdAt": "2026-06-10T08:00:00.000Z"
      }
    ],
    "note": "今天要完成项目的初稿"
  },
  
  // 习惯数据
  "_habits": [
    {"name": "运动", "active": true, "emoji": "🏃", "createdAt": "..."},
    {"name": "阅读", "active": true, "emoji": "📖", "createdAt": "..."}
  ],
  
  // 习惯打卡记录
  "_habitChecks": {
    "2026-06-10": {
      "运动": {"checked": true, "duration": 30},
      "阅读": {"checked": true, "duration": 60}
    }
  },
  
  // 四象限数据（按日期）
  "_quadrantsByDate": {
    "2026-06-10": {
      "urgent-important": [
        {"id": "...", "text": "完成项目报告", "done": false, "createdAt": "..."}
      ],
      "not-urgent-important": [],
      "urgent-not-important": [],
      "not-urgent-not-important": []
    }
  }
}
```

## 🚀 最新更新 (v1.0.3)

### 新增功能
- ✅ 四象限与待办双向同步
- ✅ 跨日期象限管理
- ✅ 待办页面直接跳转象限
- ✅ 共享功能优化

### 修复问题
- 🐛 修复 wx.cloud.init 未初始化问题
- 🐛 修复云函数依赖缺失问题
- 🐛 修复主包超限问题
- 🐛 修复字段名不匹配问题
- 🐛 修复象限与待办同步问题

### 优化改进
- ⚡ 性能优化，提升加载速度
- 🎨 UI 细节优化
- 📝 代码注释完善

## 🤝 贡献指南

欢迎贡献代码、提出建议或报告问题！

### 贡献步骤
1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

### 报告问题
如果您发现任何问题，请：
1. 检查 [Issues](https://github.com/Ssh54188/Warm-Memory-Life/issues) 是否已存在
2. 创建新 Issue，详细描述问题
3. 提供复现步骤和截图

## 📄 开源协议

本项目采用 MIT 协议开源。

## 🙏 致谢

- 感谢微信团队提供优秀的小程序平台
- 感谢所有贡献者的付出
- 感谢用户的支持和反馈

## 📞 联系方式

- **作者**：Ssh54188
- **GitHub**：[@Ssh54188](https://github.com/Ssh54188)
- **邮箱**：[13937590983@163.com]

---

⭐ 如果这个项目对您有帮助，请给它一个星标！
