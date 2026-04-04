# Controlled Online Source MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Tips 中新增一个可验证、可测试、边界清晰的在线音乐 MVP：受控在线目录 + 在线播放 + 本地收藏 + 显式下载，同时避免把产品做成 LX Music 式聚合平台。

**Architecture:** 保持现有本地/R2 播放路径不变，在前端新增 `online` 领域层，把“在线目录搜索结果”与“可播放 URL 解析”拆开。`/Users/os/Downloads/lx-music-sources` 中的 LX 音源脚本只作为**协议验证样本**，不直接作为 v1 的生产插件系统；v1 依赖一个受控的在线目录契约（JSON/HTTP），并将最终播放 URL 当作普通远端音频 URL 喂给现有 `HTMLAudioElement`。

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Tauri commands, Rust app_data_dir JSON persistence, existing HTML5 Audio pipeline.

---

## Verified Facts (Do Not Re-discover During Implementation)

1. `frontend/package.json` 当前没有 Vitest / Testing Library，前端 TDD 跑道不存在，必须先补。
2. `frontend/src/types.ts` 当前 `Track` 只有本地 / R2 云端字段，没有在线目录、收藏、下载状态字段。
3. `frontend/src/hooks/useAudio.ts` 当前只支持两类播放路径：
   - 本地：`stream://localhost/<path>`
   - 云端：通过 `cloud_key -> presigned URL`
4. `/Users/os/Downloads/lx-music-sources/*.js` 是真实的 LX 自定义源脚本样本；已验证至少 `ikun.js / huibq.js / juhe.js` 都依赖 `globalThis.lx` 宿主协议。
5. 根据 LX 官方自定义源文档，这类脚本只处理 `musicUrl`（少数 `local` 才额外支持 `lyric/pic`），**不负责搜索结果本身**。因此 Tips 若要做“在线搜索”，必须单独定义目录/搜索契约。
6. `docs/prd.md` 仍把“在线音乐”列为非目标，所以本次改造必须以“受控最小闭环”落地，不能扩展成多源聚合平台。

## Scope Boundary for This Plan

### In Scope

- 单一受控在线目录入口
- 在线目录搜索 / 浏览
- 点击在线播放
- 将在线曲目标记为 Tips 本地收藏
- 将在线曲目显式下载到本地目录后进入本地库
- 可测试的 source contract + audio path + persistence

### Out of Scope

- 运行任意第三方 LX 自定义源脚本作为生产插件
- 多源聚合搜索、跨源去重
- 在线歌单系统、同步服务、开放 API
- 下载任务中心、歌词嵌入、封面嵌入、批量下载

## File Structure Map

- Create: `frontend/vitest.config.ts` — 前端测试配置
- Create: `frontend/src/test/setup.ts` — jsdom / mock / matcher 初始化
- Create: `frontend/src/online/types.ts` — 在线目录领域类型
- Create: `frontend/src/online/catalog.ts` — 受控在线目录查询与数据归一化
- Create: `frontend/src/online/favorites.ts` — 前端收藏状态接口（调用 Tauri）
- Create: `frontend/src/online/download.ts` — 在线曲目下载流程接口（调用 Tauri）
- Create: `frontend/src/online/lxScriptContract.ts` — 只用于验证 LX 音源协议，不做生产执行入口
- Create: `frontend/src/components/OnlineSourcePanel.tsx` — 在线目录 UI 面板
- Modify: `frontend/src/types.ts` — 扩展 `Track` 为可表达在线目录曲目
- Modify: `frontend/src/hooks/useAudio.ts` — 支持直接远端 URL 播放，不再把在线曲目误塞进 `cloud_key`
- Modify: `frontend/src/App.tsx` — 新增在线入口、收藏入口、下载动作、状态 wiring
- Modify: `frontend/src/App.css` — 补充在线入口与收藏/下载行操作样式
- Create: `frontend/src/online/__tests__/lxScriptContract.test.ts`
- Create: `frontend/src/online/__tests__/catalog.test.ts`
- Create: `frontend/src/online/__tests__/favorites.test.ts`
- Create: `frontend/src/online/__tests__/download.test.ts`
- Create: `frontend/src/hooks/__tests__/useAudio.online.test.ts`
- Create: `frontend/src/components/__tests__/OnlineSourcePanel.test.tsx`
- Modify: `src-tauri/src/lib.rs` — 新增收藏/下载相关 commands
- Create: `src-tauri/src/online_store.rs` — 收藏与在线配置 JSON 持久化
- Create: `src-tauri/src/downloader.rs` — 在线曲目下载到本地文件的最小实现
- Create: `src-tauri/tests` (if needed via inline module tests) — Rust 侧 persistence / download 单元测试

## Contract Decisions Locked by This Plan

### Normalized online track contract

```ts
export interface OnlineTrackRef {
  sourceId: string
  trackId: string
  title: string
  artist: string
  album?: string
  streamUrl?: string
  artworkUrl?: string
  resolverPayload?: Record<string, unknown>
}
```

### Extended Tips track contract

```ts
export interface Track {
  path: string
  title: string
  subtitle: string
  is_cloud?: boolean
  cloud_key?: string
  is_online?: boolean
  online_id?: string
  online_source_id?: string
  online_stream_url?: string
  is_favorite?: boolean
}
```

### Controlled catalog HTTP contract (v1)

```json
{
  "items": [
    {
      "sourceId": "demo",
      "trackId": "123",
      "title": "Song Name",
      "artist": "Artist Name",
      "album": "Album Name",
      "streamUrl": "https://example.com/audio.mp3"
    }
  ]
}
```

> Notes:
> - v1 必须支持 `streamUrl` 直出，避免把“在线搜索”与“LX URL 解析脚本运行时”同时做掉。
> - `resolverPayload` 只为后续兼容层预留，不在 v1 UI 暴露。

---

### Task 1: 建立前端 TDD 跑道

**Files:**
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/test/setup.ts`
- Modify: `frontend/package.json`
- Test: `frontend/src/online/__tests__/testHarness.smoke.test.ts`

- [ ] **Step 1: 写失败测试，证明前端测试命令当前不存在**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

```ts
import { describe, expect, test } from 'vitest'

describe('test harness', () => {
  test('runs frontend unit tests', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 2: 运行测试，确认当前仓库前端测试未配置**

Run: `export PATH="/opt/homebrew/bin:/usr/local/bin:/Users/os/.nvm/versions/node/v18.20.4/bin:$PATH" && pnpm --dir frontend test`

Expected before implementation: command fails because `test` script / `vitest` is missing.

- [ ] **Step 3: 最小实现测试基础设施**

```ts
// frontend/vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

```ts
// frontend/src/test/setup.ts
import '@testing-library/jest-dom/vitest'
```

```json
// frontend/package.json (devDependencies additions)
{
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "jsdom": "^26.1.0",
    "vitest": "^3.1.1"
  }
}
```

- [ ] **Step 4: 再次运行测试，确认跑道可用**

Run: `export PATH="/opt/homebrew/bin:/usr/local/bin:/Users/os/.nvm/versions/node/v18.20.4/bin:$PATH" && pnpm --dir frontend test`

Expected: smoke test PASS.

### Task 2: 用真实样本验证 LX 音源协议边界

**Files:**
- Create: `frontend/src/online/lxScriptContract.ts`
- Test: `frontend/src/online/__tests__/lxScriptContract.test.ts`

- [ ] **Step 1: 写失败测试，锁定“LX 音源脚本仅解析 URL，不提供搜索”的事实**

```ts
import { describe, expect, test } from 'vitest'
import { inspectLxSourceScript } from '../lxScriptContract'

const ikunFixture = `
const { EVENT_NAMES, on, send } = globalThis.lx
on(EVENT_NAMES.request, ({ action }) => {
  if (action === 'musicUrl') return Promise.resolve('https://demo/song.mp3')
  return Promise.reject('action not support')
})
send(EVENT_NAMES.inited, {
  sources: { kw: { name: 'kw', type: 'music', actions: ['musicUrl'], qualitys: ['128k'] } }
})
`

describe('inspectLxSourceScript', () => {
  test('extracts supported actions from inited payload', async () => {
    const result = await inspectLxSourceScript(ikunFixture)
    expect(result.sources.kw.actions).toEqual(['musicUrl'])
  })

  test('marks search as unsupported for LX custom source contract', async () => {
    const result = await inspectLxSourceScript(ikunFixture)
    expect(result.supportsSearch).toBe(false)
  })
})
```

- [ ] **Step 2: 手动核对真实样本，确认 fixture 没有捏造协议**

Run:

`python3 - <<'PY'
from pathlib import Path
for name in ['ikun.js', 'huibq.js', 'juhe.js']:
    text = Path('/Users/os/Downloads/lx-music-sources', name).read_text()
    print(name, 'musicUrl' in text, 'EVENT_NAMES' in text, 'send(EVENT_NAMES.inited' in text or 'y(n.inited' in text)
PY`

Expected: all three files print `True True True`.

- [ ] **Step 3: 实现最小协议检测器，不执行网络请求，只执行受控初始化路径**

```ts
// frontend/src/online/lxScriptContract.ts
export interface LxSourceInspectionResult {
  sources: Record<string, { actions: string[]; qualitys: string[] }>
  supportsSearch: boolean
}

export async function inspectLxSourceScript(script: string): Promise<LxSourceInspectionResult> {
  let initedPayload: any = null
  const handlers = new Map<string, Function>()

  const lx = {
    EVENT_NAMES: { request: 'request', inited: 'inited', updateAlert: 'updateAlert' },
    on(event: string, handler: Function) {
      handlers.set(event, handler)
    },
    send(event: string, payload: unknown) {
      if (event === 'inited') initedPayload = payload
    },
    request() {
      throw new Error('network disabled in inspection mode')
    },
    env: 'desktop',
    version: '0-test',
    utils: {},
  }

  const runner = new Function('globalThis', `${script}; return globalThis.lx`)
  runner({ lx })

  if (!initedPayload?.sources) {
    throw new Error('LX script did not send inited sources')
  }

  const normalizedSources = Object.fromEntries(
    Object.entries(initedPayload.sources).map(([key, value]: [string, any]) => [
      key,
      {
        actions: Array.isArray(value.actions) ? value.actions : [],
        qualitys: Array.isArray(value.qualitys) ? value.qualitys : [],
      },
    ])
  )

  return {
    sources: normalizedSources,
    supportsSearch: Object.values(normalizedSources).some((source: any) => source.actions.includes('search')),
  }
}
```

- [ ] **Step 4: 运行协议测试并记录结论**

Run: `export PATH="/opt/homebrew/bin:/usr/local/bin:/Users/os/.nvm/versions/node/v18.20.4/bin:$PATH" && pnpm --dir frontend test lxScriptContract`

Expected: PASS，且结论固定为“LX source scripts are URL resolvers, not search providers”.

### Task 3: 定义受控在线目录类型与查询契约

**Files:**
- Create: `frontend/src/online/types.ts`
- Create: `frontend/src/online/catalog.ts`
- Modify: `frontend/src/types.ts`
- Test: `frontend/src/online/__tests__/catalog.test.ts`

- [ ] **Step 1: 写失败测试，锁定目录查询的最小契约**

```ts
import { describe, expect, test, vi } from 'vitest'
import { searchCatalog } from '../catalog'

describe('searchCatalog', () => {
  test('maps remote JSON items into normalized Track-like objects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        items: [
          {
            sourceId: 'demo',
            trackId: '1',
            title: 'Blue Sky',
            artist: 'Artist',
            streamUrl: 'https://demo.test/blue-sky.mp3',
          },
        ],
      }),
    })))

    const result = await searchCatalog('blue')
    expect(result).toEqual([
      expect.objectContaining({
        title: 'Blue Sky',
        subtitle: 'Artist',
        is_online: true,
        online_stream_url: 'https://demo.test/blue-sky.mp3',
      }),
    ])
  })
})
```

- [ ] **Step 2: 实现最小目录查询器**

```ts
// frontend/src/online/catalog.ts
import type { Track } from '../types'

export async function searchCatalog(query: string): Promise<Track[]> {
  const res = await fetch(`/catalog/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(`catalog search failed: ${res.status}`)
  const data = await res.json() as {
    items: Array<{ sourceId: string; trackId: string; title: string; artist: string; streamUrl: string }>
  }

  return data.items.map(item => ({
    path: '',
    title: item.title,
    subtitle: item.artist,
    is_online: true,
    online_id: item.trackId,
    online_source_id: item.sourceId,
    online_stream_url: item.streamUrl,
  }))
}
```

```ts
// frontend/src/types.ts additions
export interface Track {
  path: string
  title: string
  subtitle: string
  is_cloud?: boolean
  cloud_key?: string
  is_online?: boolean
  online_id?: string
  online_source_id?: string
  online_stream_url?: string
  is_favorite?: boolean
}
```

- [ ] **Step 3: 运行目录单测**

Run: `export PATH="/opt/homebrew/bin:/usr/local/bin:/Users/os/.nvm/versions/node/v18.20.4/bin:$PATH" && pnpm --dir frontend test catalog`

Expected: PASS.

### Task 4: 扩展播放引擎以支持在线直链 Track

**Files:**
- Modify: `frontend/src/hooks/useAudio.ts`
- Test: `frontend/src/hooks/__tests__/useAudio.online.test.ts`

- [ ] **Step 1: 写失败测试，锁定在线 Track 播放路径**

```ts
import { renderHook, act } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { useAudio } from '../useAudio'

describe('useAudio online playback', () => {
  test('plays online track via online_stream_url', async () => {
    const play = vi.fn(() => Promise.resolve())
    vi.stubGlobal('Audio', class {
      src = ''
      currentTime = 0
      paused = true
      ended = false
      duration = 0
      volume = 1
      error = null
      play = play
      pause = vi.fn()
      load = vi.fn()
      addEventListener = vi.fn()
      removeEventListener = vi.fn()
    })

    const { result } = renderHook(() => useAudio())
    act(() => {
      result.current.setTracks([
        { path: '', title: 'Net Song', subtitle: 'Artist', is_online: true, online_stream_url: 'https://demo/song.mp3' },
      ])
      result.current.playAtIndex(0)
    })

    expect(play).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 最小修改 `useAudio.ts`，新增在线播放分支**

```ts
if (track.is_cloud && track.cloud_key) {
  const cached = presignedUrlsRef.current.get(track.cloud_key)
  if (!cached) return
  url = cached
} else if (track.is_online && track.online_stream_url) {
  url = track.online_stream_url
} else {
  url = `stream://localhost/${encodeURIComponent(track.path)}`
}
```

- [ ] **Step 3: 运行 hook 测试**

Run: `export PATH="/opt/homebrew/bin:/usr/local/bin:/Users/os/.nvm/versions/node/v18.20.4/bin:$PATH" && pnpm --dir frontend test useAudio.online`

Expected: PASS.

### Task 5: 添加收藏持久化（本地 Favorite，不做平台歌单）

**Files:**
- Create: `src-tauri/src/online_store.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `frontend/src/online/favorites.ts`
- Test: `src-tauri/src/online_store.rs` inline tests
- Test: `frontend/src/online/__tests__/favorites.test.ts`

- [ ] **Step 1: 写 Rust 失败测试，锁定收藏 JSON 结构**

```rust
#[test]
fn favorites_round_trip() {
    let items = vec!["demo:1".to_string(), "demo:2".to_string()];
    let json = serde_json::to_string(&items).unwrap();
    let restored: Vec<String> = serde_json::from_str(&json).unwrap();
    assert_eq!(restored, items);
}
```

- [ ] **Step 2: 实现最小收藏存取命令**

```rust
// src-tauri/src/online_store.rs
pub fn favorites_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("online-favorites.json"))
}
```

```rust
#[tauri::command]
fn load_online_favorites(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let path = online_store::favorites_path(&app)?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let json = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_online_favorites(app: tauri::AppHandle, ids: Vec<String>) -> Result<(), String> {
    let path = online_store::favorites_path(&app)?;
    let json = serde_json::to_string(&ids).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}
```

- [ ] **Step 3: 前端写失败测试并接上 invoke**

```ts
import { describe, expect, test, vi } from 'vitest'
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
```

```ts
export async function loadFavorites(): Promise<Set<string>> {
  const { invoke } = await import('@tauri-apps/api/core')
  const ids = await invoke<string[]>('load_online_favorites')
  return new Set(ids)
}
```

- [ ] **Step 4: 运行 Rust 与前端收藏测试**

Run: `cargo test online_store`

Run: `export PATH="/opt/homebrew/bin:/usr/local/bin:/Users/os/.nvm/versions/node/v18.20.4/bin:$PATH" && pnpm --dir frontend test favorites`

Expected: both PASS.

### Task 6: 添加在线曲目显式下载到本地库

**Files:**
- Create: `src-tauri/src/downloader.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `frontend/src/online/download.ts`
- Test: `src-tauri/src/downloader.rs` inline tests
- Test: `frontend/src/online/__tests__/download.test.ts`

- [ ] **Step 1: 写 Rust 失败测试，锁定保存路径与文件名清洗**

```rust
#[test]
fn sanitize_download_filename() {
    assert_eq!(sanitize_filename("A/B:C"), "A_B_C");
}
```

- [ ] **Step 2: 实现最小下载能力：HTTP GET -> app_data_dir/downloads -> return path**

```rust
#[tauri::command]
async fn download_online_track(app: tauri::AppHandle, url: String, title: String) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("downloads");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file_name = format!("{}.mp3", downloader::sanitize_filename(&title));
    let path = dir.join(file_name);
    let bytes = reqwest::get(url).await.map_err(|e| e.to_string())?.bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}
```

- [ ] **Step 3: 前端写失败测试，锁定 invoke 参数**

```ts
export async function downloadOnlineTrack(track: { title: string; online_stream_url?: string }) {
  if (!track.online_stream_url) throw new Error('missing online stream url')
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<string>('download_online_track', {
    url: track.online_stream_url,
    title: track.title,
  })
}
```

- [ ] **Step 4: 运行下载单测**

Run: `cargo test downloader`

Run: `export PATH="/opt/homebrew/bin:/usr/local/bin:/Users/os/.nvm/versions/node/v18.20.4/bin:$PATH" && pnpm --dir frontend test download`

Expected: both PASS.

### Task 7: 集成在线面板 UI，并保持 Tips 的极简视觉边界

**Files:**
- Create: `frontend/src/components/OnlineSourcePanel.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`
- Test: `frontend/src/components/__tests__/OnlineSourcePanel.test.tsx`

- [ ] **Step 1: 写组件失败测试，锁定最小交互**

```ts
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { OnlineSourcePanel } from '../OnlineSourcePanel'

describe('OnlineSourcePanel', () => {
  test('renders results and exposes play / favorite / download actions', async () => {
    render(
      <OnlineSourcePanel
        results={[{ path: '', title: 'Net Song', subtitle: 'Artist', is_online: true, online_stream_url: 'https://demo/song.mp3' }]}
        onPlay={vi.fn()}
        onToggleFavorite={vi.fn()}
        onDownload={vi.fn()}
      />
    )

    expect(screen.getByText('Net Song')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /收藏/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /下载/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 最小实现 UI，不新增复杂页面范式**

```tsx
// 关键要求，不是完整组件全文：
// - 复用当前 list-row 视觉语言
// - 在线曲目行只新增轻量 badge 与两个次级动作按钮
// - 不新增 dashboard 式卡片，不新增多栏信息架构
```

```tsx
// App.tsx integration shape
const [showOnline, setShowOnline] = useState(false)
const [onlineResults, setOnlineResults] = useState<Track[]>([])
```

```css
/* App.css additions */
.online-badge {
  font-size: 10px;
  opacity: 0.7;
}

.row-action-btn {
  opacity: 0;
}

.track-row:hover .row-action-btn,
.track-row.is-selected .row-action-btn {
  opacity: 1;
}
```

- [ ] **Step 3: 运行组件测试**

Run: `export PATH="/opt/homebrew/bin:/usr/local/bin:/Users/os/.nvm/versions/node/v18.20.4/bin:$PATH" && pnpm --dir frontend test OnlineSourcePanel`

Expected: PASS.

### Task 8: 端到端验收与手工证据收集

**Files:**
- Modify: `docs/acceptance.md`
- Modify: `docs/tasks.md` (if the repo uses it as execution log)

- [ ] **Step 1: 增加验收 checklist**

```md
- [ ] 搜索在线目录返回结果
- [ ] 双击在线曲目可以播放
- [ ] 在线曲目可加入收藏并在重启后保留
- [ ] 在线曲目可下载到本地目录
- [ ] 下载后的文件可被现有本地扫描路径识别
- [ ] 本地 / R2 / 在线 三类曲目在列表里视觉一致，仅来源标记不同
```

- [ ] **Step 2: 运行完整验证链**

Run: `export PATH="/opt/homebrew/bin:/usr/local/bin:/Users/os/.nvm/versions/node/v18.20.4/bin:$PATH" && pnpm --dir frontend test`

Run: `export PATH="/opt/homebrew/bin:/usr/local/bin:/Users/os/.nvm/versions/node/v18.20.4/bin:$PATH" && pnpm --dir frontend build`

Run: `cargo test`

Run: `cargo clippy --bin tips -- -D warnings`

Expected: all commands exit 0.

- [ ] **Step 3: 使用真实样本做非自动化协议复核（不把其作为生产插件）**

Run:

`python3 - <<'PY'
from pathlib import Path
root = Path('/Users/os/Downloads/lx-music-sources')
for path in sorted(root.glob('*.js')):
    text = path.read_text(errors='ignore')
    print(path.name, {
        'has_EVENT_NAMES': 'EVENT_NAMES' in text,
        'has_musicUrl': 'musicUrl' in text,
        'has_inited': 'inited' in text,
    })
PY`

Expected: every source file reports the three booleans as true.

---

## Go / No-Go Rule

- **Go:** Task 2 proves LX scripts are only URL resolvers, Task 3 provides a controlled searchable catalog, Task 4 proves existing audio stack can play online direct URLs.
- **No-Go:** If the chosen online directory cannot return direct `streamUrl`, or if the product requirement changes to “run arbitrary LX scripts in-app”, stop this plan and write a separate plugin-runtime plan. That is a different subsystem.

## Notes for Execution

- 不要把 `/Users/os/Downloads/lx-music-sources` 当成仓库测试 fixture 的长期依赖；实现时请把**最小必要 fixture** 内联或复制到 repo 的 `frontend/src/online/__tests__/fixtures/`。
- 不要在这个计划里引入多源聚合、同步服务、开放 API。
- 不要创建 git commit，除非用户明确要求。
