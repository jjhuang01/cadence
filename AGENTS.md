# Tips 项目协作说明

## 项目架构

**Tips 是 Tauri 2 桌面应用**：React + TypeScript 前端 + 精简 Rust 后端。

```
React 前端（frontend/src/）  ←→  精简 Rust 后端（src-tauri/src/）
  - HTML5 Audio 播放                - 文件系统扫描 (walkdir)
  - @aws-sdk/client-s3 云存储        - stream:// 自定义协议（本地文件→音频URL）
  - 全部 UI + 状态管理               - R2 凭证读取 (dotenvy)
```

> ⚠️ `src/` 目录是废弃的 eframe 历史遗留，**不参与编译**。
> `src-tauri/src/player.rs`、`cloud.rs`、`cloud_stream.rs` 已删除。

## 如何运行

### 前置依赖（首次）

```bash
# 1. 安装 Node 依赖（frontend/）
cd frontend && pnpm install && cd ..

# 2. 配置 R2 凭证（云端功能需要）
cp src-tauri/.env.example src-tauri/.env
# 编辑 src-tauri/.env，填写 R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET
```

### 开发模式（最常用）

```bash
pnpm tauri dev
# Rust 首次编译 ~40秒（精简后），增量 1-2秒
# 前端热更新秒级
```

### 仅编译 Rust（快速验证）

```bash
cargo check --bin tips   # ~5秒
cargo build --bin tips    # ~40秒首次，增量1-2秒
```

### 生产构建

```bash
pnpm tauri build
# 产物：
#   - src-tauri/target/release/bundle/macos/Tips.app
#   - src-tauri/target/release/bundle/dmg/Tips_0.1.0_aarch64.dmg
```

## 项目目标

本地 + 云端 MP3 播放器。核心原则：

- 极简、轻量、可用、单窗口、mac 风格气质

## 核心边界

### MVP 闭环

1. 导入本地文件夹或拖拽文件 / 文件夹
2. 扫描 MP3 → 展示播放列表
3. 播放 / 暂停 / 切歌 / 音量 / 进度条 Seek

### 云端能力

- ✅ Cloudflare R2，命名空间 `tips-music/`
- ✅ 前端 JS SDK 列举 → 预签名 URL → HTML5 Audio 直接播放
- ❌ 账户体系 / 多用户

### 明确不做

登录、歌词、EQ、数据库媒体库、插件

## 工程约束

- 拖拽导入与"选择文件夹"进入同一条 `scan_paths` 流程
- R2 凭证从 `src-tauri/.env` 读取，前端通过 `get_cloud_config` 命令获取
- 本地文件通过 `stream://` 自定义协议提供给 HTML5 Audio
- 异常优先转成用户可见提示，不 panic

## 代码风格

- 前端：React + TypeScript，hooks 管理状态
- 后端：精简 Rust，模块职责单一
- 不引入不必要依赖，不过度设计

## 验证要求

```bash
# 前端类型检查（必须零错误）
cd frontend && pnpm tsc --noEmit

# Rust 检查
cargo clippy --bin tips -- -D warnings
cargo test
cargo build --bin tips
```

## 📚 经验学习规则（重要）

**写完代码后必须执行**：

1. **阅读相关经验** - 查阅 `memories/2_Areas/experiences/` 目录下的相关经验文档
2. **Code Review** - 对自己写的代码进行审查，检查：
   - 是否遵循项目代码风格
   - 是否引入新的技术债务
   - 是否有更简洁的实现方式
   - 是否需要补充经验文档

### 经验文档位置

```
memories/2_Areas/experiences/
├── fix-tauri-crash-mutex-panic.md  # Tauri 崩溃修复经验
└── ... (其他经验文档)
```

### Code Review 清单

- [ ] 代码是否遵循项目风格（React hooks、Rust 模块化）
- [ ] 是否有 `.unwrap()` 等危险操作（Rust）
- [ ] 是否有内存泄漏风险（前端 useRef 缓存、后端资源管理）
- [ ] 是否需要添加测试用例
- [ ] 是否需要更新经验文档

## 模块职责速查

### Rust 后端（`src-tauri/src/`）— 仅文件扫描 + 配置

| 模块                       | 职责                                               |
| -------------------------- | -------------------------------------------------- |
| `src-tauri/src/main.rs`    | 二进制入口                                         |
| `src-tauri/src/lib.rs`     | Tauri 命令 + `stream://` 协议 + `get_cloud_config` |
| `src-tauri/src/model.rs`   | `Track`（`from_path`）、`ScanSummary`              |
| `src-tauri/src/scanner.rs` | 本地目录递归扫描，去重，排序                       |

### React 前端（`frontend/src/`）— 全部业务逻辑

| 文件                                    | 职责                                                                 |
| --------------------------------------- | -------------------------------------------------------------------- |
| `frontend/src/App.tsx`                  | 主界面：侧边栏、播放列表、播放栏、右键菜单、选择/删除逻辑            |
| `frontend/src/App.css`                  | 全部样式（Apple Design 风格，track-row 使用 flex+col-info 堆叠布局） |
| `frontend/src/hooks/useAudio.ts`        | HTML5 Audio 播放引擎，含 `stop()` 清空播放状态                       |
| `frontend/src/hooks/useCloudStorage.ts` | R2 云端：列举 + 预签名 URL                                           |
| `frontend/src/types.ts`                 | TypeScript 类型定义                                                  |
| `frontend/src/main.tsx`                 | React 应用挂载                                                       |

## 关键架构约定

### 布局结构

- `playback-bar` 是 `.main-content` 的最后一个 flex 子元素（column 方向），不是 `app-container` 的子元素
- `stream://` 协议支持 HTTP Range 请求（`bytes=start-end`），seek 功能依赖此特性
- `urldecode()` 使用 `from_utf8_lossy` 确保中文路径正确解码

### 曲目列表状态（重要）

- **Backend（Rust）** 只维护**本地**曲目列表；云端曲目不在 backend 状态中
- **Frontend（React）** `tracks` state = `[...localTracks, ...cloudTracks]`
- 删除本地曲目：先将前端索引映射到 backend 索引（`tracks.slice(0, fi).filter(!is_cloud).length`），再调 `remove_tracks`，最后合并 backend 返回值 + 剩余云端曲目
- 删除云端曲目：只更新 React state，不调 backend

### 选择逻辑

- `lastSelectedVisualIndex`：shift+click 范围选择基于 **filteredTracks 的视觉位置**，不是 originalIndex
- 搜索变化时重置 `lastSelectedVisualIndex`（防止跨 filter 状态污染）
- 全选按钮切换：已全选 → 取消全选；否则 → 全选

### 工具 crate

当前无独立 crate（`r2_music_test/` 为历史遗留，不参与 workspace 构建）。
