# Tips 测试指南

## 验证命令（开发日常）

```bash
# 前端类型检查（必须零错误）
cd frontend && pnpm tsc --noEmit && cd ..

# Rust 语法 + 类型检查（~5 秒）
cargo check --bin tips

# Rust Lint（必须零 warning）
cargo clippy --bin tips -- -D warnings

# Rust 单元测试
cargo test
```

## 本地播放功能测试

### 通过「添加文件夹」导入

1. `pnpm tauri dev` 启动应用
2. 点击左下角「添加文件夹」，选择含 `.mp3` 的目录
3. 预期：播放列表出现曲目，标题 = 文件名（下划线替换为空格），来源 = 父目录名
4. 双击任意曲目，底部播放栏应开始播放并显示进度

### 拖拽导入

1. 在 Finder 中选择 `.mp3` 文件或文件夹
2. 拖拽到 Tips 窗口（窗口边框变红高亮为正常）
3. 松手后播放列表更新

### 操作验证清单

- [ ] 单击选中（高亮）
- [ ] ⌘ + 单击多选
- [ ] Shift + 单击范围选
- [ ] ⌘A 全选 / 再次 ⌘A 取消全选
- [ ] Delete / Backspace 删除选中曲目
- [ ] 搜索框过滤曲目，显示「N / 总数」计数
- [ ] 播放中删除当前曲目 → 播放停止
- [ ] 右键菜单：播放、删除、在 Finder 中显示
- [ ] 进度条点击 seek（跳转播放位置）
- [ ] 音量滑块调节

## 云端功能测试

### 前置：上传 MP3 到 R2

使用任意 S3 兼容工具将文件上传到 `tips-music/` 前缀：

```bash
# AWS CLI 示例
aws s3 cp ~/Music/test.mp3 s3://<bucket>/tips-music/test.mp3 \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com
```

### 扫描 + 播放

1. 确认 `src-tauri/.env` 已填写正确凭证
2. 启动 Tips，点击侧边栏「云端音乐」按钮
3. 按钮显示旋转图标 → 扫描完成后云端曲目出现在列表（☁ 图标）
4. 双击云端曲目验证串流播放（无需等待完整下载）

### 云端验证清单

- [ ] 云端曲目显示 ☁ 徽标
- [ ] 播放无下载延迟（串流）
- [ ] 云端曲目可删除（仅从列表移除，不影响 R2）
- [ ] 本地 + 云端混合列表正常排序
- [ ] `.env` 凭证错误时显示错误提示

## stream:// 协议验证

本地文件通过 Tauri 自定义 `stream://localhost/<encoded-path>` 协议提供给 HTML5 Audio。

验证 Range 请求（seek 功能依赖）：

1. 播放一首本地 MP3
2. 点击进度条中间位置 → 播放时间应跳转到对应位置（非从头开始）
3. 文件名含中文的 MP3 也应正常播放（urldecode UTF-8 支持）
