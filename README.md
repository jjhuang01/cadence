# Cadence — Minimal MP3 Player

**Cadence**（律动）是一个用 **Tauri 2 + React 18 + TypeScript + Rust** 构建的 macOS 桌面音乐播放器。目标：**轻量、极简、好看、单窗口、Mac 风格气质**。

支持本地 MP3 库、Cloudflare R2 云端同步、在线目录搜索播放（lx-music 音源兼容）。

---

## 快速开始

### 前置依赖

- [Rust](https://rustup.rs/) stable toolchain
- [Node.js](https://nodejs.org/) ≥ 18 + [pnpm](https://pnpm.io/)
- macOS（当前仅支持 macOS）

### 首次设置

```bash
# 安装前端依赖
cd frontend && pnpm install && cd ..

# （可选）配置 Cloudflare R2 凭证以启用云端功能
cp src-tauri/.env.example src-tauri/.env
# 编辑 src-tauri/.env，填入：
#   R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET
```

### 开发

```bash
pnpm tauri dev
# 首次 Rust 编译约 40 秒，后续增量 1-2 秒
# 前端热更新（Vite HMR）即时生效

RUST_LOG=debug pnpm tauri dev  # 带详细日志
```

### 生产构建

```bash
pnpm tauri build
# 产物：
#   src-tauri/target/release/bundle/macos/Tips.app
#   src-tauri/target/release/bundle/dmg/Tips_0.1.0_aarch64.dmg
```

---

## 功能

| 功能           | 说明                                                                                    |
| -------------- | --------------------------------------------------------------------------------------- |
| **本地音乐库** | 拖拽或「添加文件夹」，递归扫描 `.mp3`，自动读取 ID3 标签（标题/艺术家/时长）            |
| **播放控制**   | 双击/点击播放按钮；底部播放栏：上一首/暂停/下一首/音量/进度 Seek                        |
| **全屏播放器** | 黑胶唱片旋转动画 + 唱臂效果 + 歌词同步滚动 + 进度拖拽                                   |
| **歌词**       | 自动从 [lrclib.net](https://lrclib.net) 获取 LRC 同步歌词，支持时间轴偏移调整、繁简切换 |
| **曲目管理**   | 单击选中、⌘ 多选、Shift 范围选、⌘A 全选、Delete/Backspace 删除、方向键导航              |
| **搜索**       | 实时按标题/艺术家过滤，显示匹配数                                                       |
| **云端音乐**   | Cloudflare R2 串流播放（无本地缓存）、上传本地曲目到云端、云端删除                      |
| **在线目录**   | 集成 lx-music 兼容音源，支持酷我/网易/酷狗等平台搜索与播放，收藏管理                    |
| **右键菜单**   | 播放、删除、在 Finder 中显示、上传到云端                                                |
| **设置**       | 删除行为、云端存储管理、在线音源管理、运行日志诊断                                      |
| **键盘快捷键** | 空格暂停/播放、Enter 播放选中、Delete 删除选中、⌘A 全选、↑↓ 导航、Esc 取消              |

---

## 技术栈

| 层次         | 技术                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------- |
| 桌面框架     | [Tauri 2](https://tauri.app/)                                                               |
| 前端         | React 18 + TypeScript + Vite                                                                |
| 样式         | 纯 CSS（Apple Design 风格，无 CSS 框架）                                                    |
| 图标         | [Lucide React](https://lucide.dev/)                                                         |
| 音频引擎     | HTML5 Audio API                                                                             |
| 云存储       | `@aws-sdk/client-s3`（前端直调 R2，CORS 操作通过 Rust 代理）                                |
| 本地文件协议 | Tauri 自定义 `stream://` scheme（支持 HTTP Range，Seek 依赖）                               |
| 文件扫描     | Rust + [walkdir](https://crates.io/crates/walkdir)，async spawn_blocking                    |
| 元数据读取   | [id3](https://crates.io/crates/id3) + [mp3-duration](https://crates.io/crates/mp3-duration) |
| 日志         | tracing + tracing-subscriber，panic hook 写入 runtime.log                                   |
| 凭证管理     | dotenvy（`src-tauri/.env`，不入 git）                                                       |

---

## 项目结构

```
cadence/
├── frontend/src/
│   ├── App.tsx                       # 主界面：侧边栏、视图路由、键盘快捷键
│   ├── App.css                       # 全部样式（Apple Design 风格）
│   ├── types.ts                      # Track、UploadHistoryEntry、CloudConfig
│   ├── hooks/
│   │   ├── useAudio.ts               # HTML5 Audio 播放引擎（presigned URL LRU 缓存）
│   │   ├── useCloudStorage.ts        # R2 列举、上传、删除（CORS 敏感操作走 Rust）
│   │   └── useLyrics.ts              # lrclib.net 歌词获取 + 解析
│   ├── components/
│   │   ├── PlaybackBar.tsx           # 底部播放控制栏
│   │   ├── FullPlayer.tsx            # 全屏播放器（黑胶动画 + 歌词）
│   │   ├── LyricsPanel.tsx           # 侧边歌词面板
│   │   ├── SettingsView.tsx          # 设置页（通用/云端/在线音乐/诊断）
│   │   ├── ContextMenu.tsx           # 右键菜单
│   │   ├── OnlineSourcePanel.tsx     # 在线目录搜索结果面板
│   │   └── SplashScreen.tsx          # 启动加载屏
│   └── online/
│       ├── catalog.ts                # 在线搜索目录聚合
│       ├── lxSourceEngine.ts         # lx-music 音源脚本引擎
│       ├── musicSearch.ts            # 酷我搜索 API
│       ├── favorites.ts              # 收藏持久化
│       └── sourceConfig.ts           # 音源配置读写
├── src-tauri/src/
│   ├── lib.rs                        # Tauri 命令注册 + stream:// 协议 + AppState
│   ├── model.rs                      # Track 结构体 + ID3/路径解析
│   ├── scanner.rs                    # 递归 MP3 扫描（去重、排序）
│   ├── downloader.rs                 # 下载路径工具
│   ├── online_store.rs               # 收藏/历史本地 JSON 持久化
│   └── source_config_store.rs        # 音源配置 JSON 持久化
├── src-tauri/.env.example            # R2 凭证模板（.env 不入 git）
├── AGENTS.md                         # AI 协作规范
└── r2_music_test/                    # R2 上传测试工具（独立 crate）
```

---

## 开发命令速查

```bash
pnpm tauri dev                          # 开发模式
cd frontend && pnpm tsc --noEmit        # 前端类型检查（必须零错误）
cargo check --bin tips                  # Rust 语法检查（~5 秒）
cargo clippy --bin tips -- -D warnings  # Rust Lint
cargo test                              # Rust 单元测试
pnpm tauri build                        # 生产构建
```

---

## 架构说明

### 音频播放流程

```
本地文件  →  stream://localhost/<encoded-path>
             └─ Rust stream:// handler（支持 HTTP Range / Seek）
             └─ HTML5 Audio

云端文件  →  R2 ListObjectsV2  →  presigned GET URL（惰性生成，按需获取）
             └─ HTML5 Audio 直接串流（无下载）

在线音乐  →  lx-music 音源脚本  →  解析流媒体 URL
             └─ HTML5 Audio 直接播放
```

### CORS 处理策略

| 操作                       | 执行方                          | 原因              |
| -------------------------- | ------------------------------- | ----------------- |
| R2 列举 (ListObjectsV2)    | 前端 JS SDK                     | R2 允许 GET       |
| R2 下载 (presigned URL)    | 前端 Audio                      | R2 允许 GET       |
| R2 上传 (PUT presigned)    | Rust `upload_via_presigned_url` | 绕过 WebView CORS |
| R2 删除 (DELETE presigned) | Rust `delete_via_presigned_url` | 绕过 WebView CORS |

### 状态边界

- **Rust AppState** 只维护本地曲目 `Vec<Track>`（云端/在线曲目不入 Rust 状态）
- **React `tracks`** = `[...localTracks, ...cloudTracks]`（`onlineTracks` 单独管理）
- 删除本地：前端索引 → 后端索引映射 → `remove_tracks` → 合并剩余云端
- 删除云端：生成 presigned DELETE URL → Rust 执行 → 更新前端 state

---

## 明确不做

登录 / 账户体系、EQ 均衡器、数据库媒体库、插件系统、多平台（当前仅 macOS）
