# Debug & Observability

## 日志

项目使用 `tracing` 输出结构化日志。

默认级别：`info`

可通过环境变量调整：

```bash
RUST_LOG=debug cargo run
```

## 关键日志事件

- `music scan started`
- `music scan finished`
- `playback started`
- `playback paused`
- `playback resumed`
- `playback start failed`
- `auto-next failed`

## 典型排查路径

### 导入后没有曲目

- 检查目录中是否存在 `.mp3`
- 检查扫描 warning
- 检查 `RUST_LOG=debug cargo run` 输出

### 点击播放没有声音

- 检查系统是否存在默认音频输出设备
- 检查日志中的 `audio backend unavailable`
- 检查对应文件是否损坏或不可读

### 扫描时界面卡顿

- 检查是否误把重 IO 放到了 UI 线程
- 检查扫描线程是否正常返回 `ScanEvent`

## 后续可扩展方向

- 写入本地日志文件
- 增加性能计时埋点
- 统计平均扫描耗时与播放失败率
