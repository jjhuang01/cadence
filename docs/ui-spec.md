# UI Spec

## 视觉方向

- 风格：克制、紧凑、桌面工具型，本地播放器效率优先
- 关键词：playlist-first / compact / flat shell / classic utility / playback-focused

## 窗口结构

- 顶部工具栏：38px，单行标题 + 操作按钮，不保留营销式副标题
- 左侧 sidebar：160–170px，像经典播放器的导航抽屉，不做状态面板
- 中央主列表：主要可滚动区域
- 底部播放栏：78px，运输控制（transport）与进度条是视觉中心

## 颜色

- Window: `#F6F6F4`
- Sidebar: `#F0F0EC`
- Content: `#F9F9F7`
- Bottom bar: `#F1F1ED`
- Accent: `#4270CE`

## 字体层级

- Toolbar Title：15 / semibold
- Page Title：17 / semibold
- List Title：12.5–13 / medium
- Meta：11.5 / regular
- Time / Badge：10.5–11

## 密度与分隔

- 列表行高：34px 左右
- 列表项是连续列表，不是独立圆角卡片
- 使用 divider 和轻量背景差异表达 hover / selected / playing
- playing 优先使用 accent 与浅底，selected 保持中性高亮，避免混淆

## 交互状态

- Default
- Hover
- Selected
- Playing
- Empty
- Drag-hover
- Error

## 控件原则

- Import Folder 是唯一略强调按钮
- 顶部与底部都保持单层平面，不使用 dashboard 式信息块
- 列表项采用轻背景差 + 细分隔线区分状态
- 不使用重阴影、毛玻璃、渐变强调或网页仪表盘式修饰
- 空状态像实用程序提示，不像 onboarding 首屏
