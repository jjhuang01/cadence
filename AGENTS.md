# Cadence 项目协作说明

## 项目概述

**Cadence（律动）** 是 Tauri 2 macOS 桌面音乐播放器：React + TypeScript 前端 + 精简 Rust 后端。

支持：本地 MP3 库 / Cloudflare R2 云端 / lx-music 在线目录三大播放源。

## 如何运行

```bash
cd frontend && pnpm install && cd ..        # 首次安装依赖
cp src-tauri/.env.example src-tauri/.env   # 配置 R2 凭证（云端功能需要）

pnpm tauri dev          # 开发模式（首次 ~40s，增量 1-2s）
cargo check --bin tips  # 快速 Rust 语法检查（~5s）
pnpm tauri build        # 生产构建
```

## 验证要求（提交前必须通过）

```bash
cd frontend && pnpm tsc --noEmit           # 前端类型检查（零错误）
cargo clippy --bin tips -- -D warnings     # Rust lint（零 warning）
cargo test                                 # Rust 单元测试
```

## 模块职责速查

### Rust 后端（`src-tauri/src/`）

| 模块                     | 职责                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `lib.rs`                 | Tauri 命令注册、`stream://` 协议、AppState（本地曲目 Mutex）、proxy/upload/delete 命令 |
| `model.rs`               | `Track` 结构体、`from_path`（ID3+mp3-duration）、路径解析工具函数、单元测试            |
| `scanner.rs`             | 递归 MP3 扫描（walkdir），去重、canonical、隐藏文件过滤、排序                          |
| `downloader.rs`          | 下载文件路径工具函数                                                                   |
| `online_store.rs`        | 在线收藏/历史 JSON 持久化（`~/Library/Application Support/…`）                         |
| `source_config_store.rs` | 音源配置 JSON 读写                                                                     |

### React 前端（`frontend/src/`）

| 文件                       | 职责                                                                            |
| -------------------------- | ------------------------------------------------------------------------------- |
| `App.tsx`                  | 主界面：侧边栏、视图路由（library/cloud/online/settings）、键盘快捷键、全局状态 |
| `App.css`                  | 全部样式（Apple Design 风格，无 CSS 框架）                                      |
| `types.ts`                 | `Track`、`UploadHistoryEntry`、`CloudConfig`                                    |
| `hooks/useAudio.ts`        | HTML5 Audio 播放引擎；presigned URL LRU 缓存（max 100）；`playError` 重试机制   |
| `hooks/useCloudStorage.ts` | R2 列举、上传（Rust PUT）、删除（Rust DELETE）、上传历史                        |
| `hooks/useLyrics.ts`       | lrclib.net 歌词获取、LRC 解析、AbortController 防竞态                           |

### 组件（`frontend/src/components/`）

| 组件                    | 职责                                                      |
| ----------------------- | --------------------------------------------------------- |
| `PlaybackBar.tsx`       | 底部播放控制栏（控制/进度/音量/歌词开关）                 |
| `FullPlayer.tsx`        | 全屏播放器（黑胶旋转动画、唱臂、歌词同步、进度 scrubber） |
| `LyricsPanel.tsx`       | 侧边歌词面板（自动滚动、偏移调整、繁简切换）              |
| `SettingsView.tsx`      | 设置页（通用/云端存储/在线音乐/诊断 四标签页）            |
| `ContextMenu.tsx`       | 右键菜单（播放/删除/Finder/上传）                         |
| `OnlineSourcePanel.tsx` | 在线目录面板（搜索结果、平台切换、收藏、分页加载）        |
| `SplashScreen.tsx`      | 启动加载屏                                                |

### 在线音乐模块（`frontend/src/online/`）

| 文件                | 职责                              |
| ------------------- | --------------------------------- |
| `catalog.ts`        | 多平台搜索聚合入口                |
| `lxSourceEngine.ts` | lx-music .js 音源脚本沙箱执行引擎 |
| `musicSearch.ts`    | 酷我直接搜索 API                  |
| `favorites.ts`      | 在线收藏读写（invoke Rust）       |
| `sourceConfig.ts`   | 音源配置类型 + 默认值 + 读写      |

## 关键架构约定

### CORS 策略

R2 的 PUT/DELETE 从 WebView 直接发送会触发 CORS 错误。解决方案：

| 操作                          | 执行方                                     |
| ----------------------------- | ------------------------------------------ |
| ListObjectsV2 / presigned GET | 前端 JS SDK / HTML5 Audio                  |
| PUT（上传）                   | Rust `upload_via_presigned_url`（reqwest） |
| DELETE（删除）                | Rust `delete_via_presigned_url`（reqwest） |

### 曲目列表状态

- `tracks` state = `[...localTracks, ...cloudTracks]`（在线曲目单独用 `onlineResults`）
- Rust AppState 只维护本地曲目（`Vec<Track>`），云端/在线不入 Rust 状态
- 删除本地：`tracks.slice(0, fi).filter(!is_cloud).length` → 后端索引 → `remove_tracks`
- 删除云端：presigned DELETE URL → Rust 执行 → 前端 state 更新

### 播放错误重试

`useAudio.playAtIndex` 遇到无缓存的云端 URL 时触发 `setPlayError`。  
`App.tsx` 的 `playError` useEffect 监听后调用 `cloud.buildPresignedUrl` 重新获取 URL 并重试，最多 2 次（由 `cloudPlayRetryRef` 控制，防止 CORS 持续失败导致无限循环）。

### scan_paths 异步化

`scan_paths` Tauri 命令使用 `spawn_blocking` 包装，避免 mp3-duration 帧扫描阻塞 async executor 导致 UI 冻结。

### 布局结构

- `playback-bar` 是 `.main-content` 的最后一个 flex 子元素（column 方向）
- `stream://` 协议支持 HTTP Range，seek 功能依赖此特性
- `urldecode()` 使用 `from_utf8_lossy` 确保中文路径正确解码

### 选择逻辑

- `lastSelectedVisualIndex`：shift+click 范围选择基于 filteredTracks 的视觉位置
- 搜索变化时重置（防止跨 filter 状态污染）
- 全选切换：已全选 → 取消全选；否则 → 全选

## 调试日志

生产包崩溃时查看：`~/Library/Application Support/dev.tips.app/logs/runtime.log`

## 项目边界（明确不做）

登录/账户体系、EQ 均衡器、数据库媒体库、插件系统、多平台（当前仅 macOS）

## 工具 crate

`r2_music_test/` 为历史遗留的 R2 上传测试工具，**不参与 workspace 构建**。
