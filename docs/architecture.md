# Architecture — Tips

> 当前架构：Tauri 2 + React 18 + TypeScript + HTML5 Audio
> （历史：eframe/egui + rodio，已完全替换）

## 1. 总体结构

```
┌────────────────────────────────────────────────────┐
│  macOS 窗口（Tauri 2 WebView，transparent: true）   │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  React 18 + TypeScript 前端                  │  │
│  │                                              │  │
│  │  App.tsx          主界面 + 状态管理           │  │
│  │  useAudio.ts      HTML5 Audio 播放引擎        │  │
│  │  useCloudStorage  R2 列举 + 预签名 URL         │  │
│  └──────────────┬───────────────────────────────┘  │
│                 │  Tauri invoke / custom protocol   │
│  ┌──────────────▼───────────────────────────────┐  │
│  │  Rust / Tauri 后端                            │  │
│  │                                              │  │
│  │  lib.rs       命令注册 + stream:// 协议       │  │
│  │  scanner.rs   walkdir 递归 MP3 扫描           │  │
│  │  model.rs     Track 结构体 + 路径解析         │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

**核心设计决策**：音频播放从 Rust 迁移到前端 HTML5 Audio，使 Rust 后端极度精简（仅文件系统 + 凭证），所有业务逻辑在 TypeScript 中。

## 2. Rust 后端模块

### `lib.rs` — 命令枢纽

- 注册所有 Tauri commands
- 实现 `stream://` 自定义 URI 协议（支持 HTTP Range 请求，提供本地 MP3 给 HTML5 Audio）
- 维护 `AppState { tracks: Mutex<Vec<Track>> }`

**关键约定**：AppState 只存储**本地**曲目；云端曲目仅存在于前端 React state。

### `scanner.rs` — 文件扫描

- 接收路径列表（单目录或多路径）
- walkdir 递归枚举 `.mp3`（不区分大小写）
- 路径排序 + 去重
- 返回 `Vec<PathBuf>`

### `model.rs` — 数据模型

- `Track { path, title, subtitle }` — serde Serialize 传给前端
- `title_from_path`：取文件名 stem，下划线替换为空格
- `subtitle_from_path`：取父目录名

## 3. 前端模块

### `App.tsx` — 主界面（~550 行）

状态管理核心：

| state | 职责 |
| ----- | ---- |
| `tracks` | 全量曲目列表 = `[...local, ...cloud]` |
| `search` | 搜索关键词（useMemo 过滤） |
| `selectedIndices` | 选中的 originalIndex 集合（Set） |
| `lastSelectedVisualIndex` | Shift+click 范围选起点（视觉位置） |
| `audio.currentIndex` | 当前播放的 originalIndex |

关键 hooks 依赖：`useAudio`（播放引擎）、`useCloudStorage`（云端 IO）

### `useAudio.ts` — 播放引擎

- 封装单个 `HTMLAudioElement`（非渲染型，永不卸载）
- `playAtIndex(n)`：本地路径 → `stream://localhost/<encoded>` URI；云端 → presigned URL
- 事件循环：`timeupdate → setPosition`，`ended → playAtIndex(n+1)`
- `stop()`：暂停 + 清空 src + 重置所有播放状态

### `useCloudStorage.ts` — R2 云端

- `S3Client` 懒初始化（缓存在 `clientRef`）
- `ListObjectsV2` 列举 `tips-music/` 前缀的 `.mp3`
- `getSignedUrl` 为每首曲目生成 1h 有效期预签名 URL
- 返回 `Track[]` + `getPresignedUrl` 函数；调用方存入 `useAudio.presignedUrlsRef`

## 4. 数据流

### 4.1 本地导入

```
用户（拖拽 / 选择文件夹）
  → invoke('scan_paths' | 'scan_directory')
  → scanner.rs（walkdir）
  → Vec<Track>（title=文件名，subtitle=父目录名）
  → setTracksState(result)
  → filteredTracks useMemo → 渲染列表
```

### 4.2 本地播放

```
双击曲目 → audio.playAtIndex(originalIndex)
  → stream://localhost/<encodeURIComponent(path)>
  → Tauri stream:// handler
      GET /path → fs::File::open → Range slice → 200/206 响应
  → HTML5 Audio 解码播放
```

### 4.3 云端播放

```
点击「云端音乐」→ useCloudStorage.scanCloud()
  → invoke('get_cloud_config') → .env → CloudConfig
  → S3Client.ListObjectsV2(Prefix: 'tips-music/')
  → getSignedUrl × N（1h TTL）
  → audio.setPresignedUrl(key, url)
  → setTracksState([...local, ...cloud])

双击云端曲目 → audio.playAtIndex(n)
  → presignedUrlsRef.get(cloud_key)
  → HTMLAudioElement.src = presignedUrl
  → HTML5 Audio → R2 直接串流
```

### 4.4 删除曲目

```
本地曲目删除：
  前端索引 → 映射 backend 索引
    = tracks.slice(0, fi).filter(!is_cloud).length
  → invoke('remove_tracks', { indices })
  → Rust 更新 AppState.tracks
  → 返回新 Vec<Track>
  → setTracksState([...newLocal, ...existingCloud])

云端曲目删除：
  纯前端 state 更新，不调 Rust
```

## 5. 单一真相源

| 数据 | 归属 |
| ---- | ---- |
| 本地曲目列表 | Rust `AppState` |
| 完整播放列表 | React `tracks` state |
| 播放位置 / 时长 | `useAudio` 内部（Audio 事件驱动） |
| 云端预签名 URL | `useAudio.presignedUrlsRef`（Map） |

## 6. 错误处理策略

- 扫描失败：`setErrorMsg(String(e))` → 顶部红色错误栏，用户可关闭
- 播放失败：`onError` 事件 → `setIsPlaying(false)`，不 panic
- 云端失败：抛出异常 → 上层 `scanCloud()` catch → `setErrorMsg`
- 不允许 `unwrap()`/panic 作为用户路径的错误处理
