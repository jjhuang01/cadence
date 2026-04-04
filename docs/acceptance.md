# Acceptance Checklist

## 产品验收

- [ ] 应用可启动并显示单窗口界面
- [ ] 可通过 `Import Folder` 选择目录
- [ ] 可通过拖拽导入文件或文件夹
- [ ] 能扫描并列出本地 MP3
- [ ] 单击曲目可立即播放
- [ ] 主列表标题列明显左偏，非当前播放行不保留无意义右侧占位
- [ ] 支持播放 / 暂停 / 上一首 / 下一首
- [ ] 顶部提供 `Play Selected`、`Delete Selected`、`Clear All`，且在不可用时禁用
- [ ] 删除非当前曲目时，当前播放索引按前后位置正确保持或递减
- [ ] 删除当前播放曲目时会停止播放并清空 current
- [ ] 清空列表时会停止播放、清空队列并清空 current / selected
- [ ] 底部栏能显示当前曲目和基础进度
- [ ] 空目录有空状态提示
- [ ] 错误文件或无音频设备时有明确提示

## 工程验收

- [ ] `cargo fmt --check`
- [ ] `cargo test`
- [ ] `cargo clippy --all-targets --all-features -- -D warnings`
- [ ] `cargo build`

## 体验验收

- [ ] 界面层级清晰
- [ ] 操作路径短
- [ ] 扫描时 UI 不明显冻结
- [ ] 视觉符合极简、mac 风格气质
