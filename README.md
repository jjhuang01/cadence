# Tips — Minimal MP3 Player

Tips 是一个用 **Tauri 2 + React 18 + TypeScript + Rust** 构建的桌面 MP3 播放器，目标是：**轻量、极简、好看、单窗口、Mac 风格**。

## 快速开始

### 前置依赖

- [Rust](https://rustup.rs/) (stable toolchain)
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

### 开发模式

```bash
pnpm tauri dev
# 首次 Rust 编译约 40 秒，后续增量 1-2 秒
# 前端热更新（Vite HMR）即时生效
```

带详细日志：

```bash
RUST_LOG=debug pnpm tauri dev
```

### 生产构建

```bash
pnpm tauri build
# 产物：
#   - src-tauri/target/release/bundle/macos/Tips.app
#   - src-tauri/target/release/bundle/dmg/Tips_0.1.0_aarch64.dmg
```

---

## 核心功能

| 功能         | 说明                                                               |
| ------------ | ------------------------------------------------------------------ |
| **本地导入** | 点击「添加文件夹」或拖拽文件 / 文件夹，自动递归扫描 `.mp3`         |
| **播放控制** | 双击播放；底部播放栏：上一首 / 播放暂停 / 下一首 / 音量 / 进度拖拽 |
| **曲目管理** | 单击选中、⌘ 多选、Shift 范围选、⌘A 全选、Delete 删除               |
| **搜索**     | 实时按标题 / 来源过滤，显示匹配数                                  |
| **云端音乐** | 列举 Cloudflare R2 文件，预签名 URL 直接串流，无本地缓存           |
| **右键菜单** | 播放、删除、在 Finder 中显示（本地文件）                           |
| **歌词**     | 自动从 lrclib.net 获取 LRC 同步歌词，支持时间轴偏移调整            |

---

## 技术栈

| 层次         | 技术                                                   |
| ------------ | ------------------------------------------------------ |
| 桌面框架     | [Tauri 2](https://tauri.app/)                          |
| 前端框架     | React 18 + TypeScript + Vite                           |
| 样式         | 纯 CSS（Apple Design 风格）                            |
| 图标         | [Lucide React](https://lucide.dev/)                    |
| 音频引擎     | HTML5 Audio API（TypeScript）                          |
| 云存储客户端 | `@aws-sdk/client-s3`（前端直接调用 R2）                |
| 文件扫描     | Rust / walkdir                                         |
| 本地音频协议 | Tauri 自定义 `stream://` URI scheme（支持 HTTP Range） |
| 凭证管理     | dotenvy（`src-tauri/.env`）                            |
| 日志         | tracing + tracing-subscriber                           |

---

## 项目结构

```text
tips/
├── frontend/                    # React + TypeScript 前端
│   ├── src/
│   │   ├── App.tsx              # 主界面（播放列表、工具栏、播放栏、右键菜单）
│   │   ├── App.css              # 全部样式（Apple Design 风格）
│   │   ├── types.ts             # Track、CloudConfig 类型
│   │   ├── main.tsx             # React 挂载入口
│   │   └── hooks/
│   │       ├── useAudio.ts      # HTML5 Audio 播放引擎
│   │       └── useCloudStorage.ts  # R2 列举 + 预签名 URL
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── src-tauri/                   # Rust / Tauri 后端
│   ├── src/
│   │   ├── lib.rs               # Tauri 命令 + stream:// 协议 + AppState
│   │   ├── main.rs              # 二进制入口（调用 lib::run()）
│   │   ├── model.rs             # Track 结构体 + path 解析工具函数
│   │   └── scanner.rs           # 递归 MP3 扫描（walkdir）
│   ├── .env                     # R2 凭证（已加入 .gitignore）
│   ├── .env.example             # 凭证模板
│   ├── Cargo.toml
│   └── tauri.conf.json
├── AGENTS.md                    # AI 协作规范
├── Cargo.toml                   # Workspace 根
└── package.json                 # 根级 pnpm 脚本（tauri dev/build）
```

---

## 开发命令速查

```bash
# 开发（最常用）
pnpm tauri dev

# 前端类型检查（必须零错误）
cd frontend && pnpm tsc --noEmit && cd ..

# Rust 快速语法检查（~5 秒）
cargo check --bin tips

# Rust Lint（必须零 warning）
cargo clippy --bin tips -- -D warnings

# Rust 测试
cargo test

# 生产构建
pnpm tauri build
```

---

## 架构说明

### 音频播放流程

```
本地文件  →  stream://localhost/<encoded-path>  →  Rust stream:// handler
                                                    （支持 Range 请求）
                                                →  HTML5 Audio（useAudio.ts）

云端文件  →  R2 ListObjectsV2  →  presigned URL（1h 有效）
                               →  HTML5 Audio 直接串流
```

### 状态边界

- **Rust AppState** 仅维护本地曲目列表（`Vec<Track>`）
- **React state** = `[...localTracks, ...cloudTracks]`
- 删除本地曲目：前端索引 → 后端索引映射 → `remove_tracks` → 合并云端曲目
- 删除云端曲目：纯前端 state 更新，不调 Rust

---

## 明确不做（MVP 边界）

登录 / 账户、EQ 均衡器、数据库媒体库、插件系统、多平台（当前仅 macOS）
