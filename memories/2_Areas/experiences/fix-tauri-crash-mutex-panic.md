# 修复 Tauri 应用崩溃问题经验

## 问题背景

律动（Tips）是一个 Tauri 2.0 桌面 MP3 播放器，播放一段时间后崩溃。

## 根本原因

经过多专家交叉验证审查，确认以下问题导致崩溃：

### 1. Mutex Panic 传播（最高优先级）

**问题代码**:
```rust
let mut state_tracks = state.tracks.lock().unwrap();
```

**崩溃机制**:
- 任何线程在持有 Mutex 时 panic → Mutex 被污染
- 后续所有获取锁的操作都会 panic → 应用崩溃

**修复方案**:
```rust
let mut state_tracks = state.tracks.lock()
    .map_err(|e| format!("Failed to acquire lock: {}", e))?;
```

### 2. macOS 私有 API 不稳定性

**问题配置**:
```json
"macOSPrivateApi": true
```

**已知问题**:
- GitHub Issue #11340: NSApplication panic
- GitHub Issue #11336: LTO 优化相关崩溃
- GitHub Issue #4159: 段错误

**修复方案**: 禁用私有 API，除非确实需要透明标题栏等特性。

### 3. stream:// 协议内存管理

**问题**:
- 每次 Range 请求分配 2MB 缓冲区
- spawn_blocking 可能导致线程池耗尽

**修复方案**:
```rust
static ACTIVE_STREAM_REQUESTS: AtomicUsize = AtomicUsize::new(0);
const MAX_CONCURRENT_STREAMS: usize = 10;

// 检查并发限制
if ACTIVE_STREAM_REQUESTS.load(Ordering::Relaxed) >= MAX_CONCURRENT_STREAMS {
    return 503;
}

// 使用 scopeguard 自动清理
ACTIVE_STREAM_REQUESTS.fetch_add(1, Ordering::Relaxed);
let _guard = scopeguard::guard((), |_| {
    ACTIVE_STREAM_REQUESTS.fetch_sub(1, Ordering::Relaxed);
});
```

### 4. 预签名 URL 缓存无限增长

**问题**:
```typescript
const presignedUrlsRef = useRef<Map<string, string>>(new Map());
// 无限制增长
```

**修复方案**:
```typescript
const MAX_PRESIGNED_CACHE_SIZE = 100;

const setPresignedUrl = (key: string, url: string) => {
  const cache = presignedUrlsRef.current;
  
  // LRU: 删除最旧的条目
  if (cache.size >= MAX_PRESIGNED_CACHE_SIZE && !cache.has(key)) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  
  cache.set(key, url);
};
```

## 关键经验

### 1. Rust 错误处理原则

- **禁止** 在生产代码中使用 `.unwrap()` 处理可能失败的操作
- **推荐** 使用 `?` 操作符或 `match` 进行错误传播
- **推荐** 对于 Mutex，使用 `lock().map_err(|e| ...)?` 或恢复机制

### 2. Tauri 2.0 稳定性注意事项

- macOS 私有 API 存在已知稳定性问题，除非必要否则禁用
- 自定义协议需要限制并发，防止线程池耗尽
- 长时间运行的应用需要实现资源清理机制

### 3. 前端内存管理

- 使用 `useRef` 缓存数据时，必须实现大小限制
- LRU 缓存是防止无限增长的简单有效方案
- 预签名 URL 等临时数据应该有过期时间

### 4. 多专家交叉验证方法

当遇到复杂问题时，采用多专家视角审查：

1. **Rust 内存安全专家** - 分析 Mutex、内存泄漏、unsafe 代码
2. **Tauri 框架专家** - 检查自定义协议、异步任务、生命周期
3. **音频处理专家** - 分析 HTML5 Audio API 使用模式
4. **React 性能专家** - 检查组件生命周期、内存泄漏
5. **并发安全专家** - 分析多线程访问、竞态条件

交叉验证可以识别单个专家可能遗漏的问题。

## 验证清单

修复完成后必须验证：

- [ ] `cargo check --bin tips` - 编译通过
- [ ] `cargo test --bin tips` - 测试通过
- [ ] `cargo clippy --bin tips -- -D warnings` - 无警告
- [ ] `pnpm tsc --noEmit` - 前端类型检查通过
- [ ] 长时间播放测试（2+ 小时）
- [ ] 内存使用监控（< 200MB 稳定）

## 参考资料

- Tauri GitHub Issues: #11340, #11336, #4159, #9190, #2952
- Rust Mutex Poisoning: https://doc.rust-lang.org/std/sync/struct.Mutex.html#poisoning
- scopeguard crate: https://docs.rs/scopeguard/

---

**修复时间**: 2026-04-03
**参与专家**: Rust 内存安全、Tauri 框架、音频处理、React 性能、并发安全
