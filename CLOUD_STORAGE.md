# Tips 云存储集成说明

## 架构概述

Tips 使用 **Cloudflare R2** 作为云端音乐存储。云端播放完全在前端实现，无需 Rust 参与：

```
前端 useCloudStorage.ts
  │
  ├── invoke('get_cloud_config')  →  Rust 从 src-tauri/.env 读取凭证
  │
  ├── S3Client.ListObjectsV2     →  列举 R2 中 tips-music/ 前缀的 .mp3
  │
  └── getSignedUrl (1h 有效期)   →  HTML5 Audio 直接串流，无本地缓存
```

## 配置

### 环境变量

编辑 `src-tauri/.env`（从模板复制）：

```bash
cp src-tauri/.env.example src-tauri/.env
```

填写以下字段：

```env
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<your-access-key-id>
R2_SECRET_ACCESS_KEY=<your-secret-access-key>
R2_BUCKET=<your-bucket-name>
```

> `.env` 已加入 `.gitignore`，不会被提交到 git。

### R2 命名空间

所有 Tips 音乐文件存储在 `tips-music/` 前缀下：

```
your-bucket/
├── tips-music/
│   ├── song1.mp3
│   └── song2.mp3
└── other-prefix/   ← Tips 不扫描此路径
```

## 使用方法

### 扫描云端音乐

1. 启动 Tips（`pnpm tauri dev`）
2. 点击侧边栏底部 **「云端音乐」** 按钮
3. 等待扫描完成（按钮显示旋转图标）
4. 云端曲目以 ☁ 图标标识，与本地曲目混合在同一播放列表

### 播放云端曲目

双击云端曲目即可播放。播放流程：

1. 扫描时已为所有云端曲目生成预签名 URL（1 小时有效期）
2. 双击时 `useAudio.playAtIndex()` 直接使用预签名 URL
3. HTML5 Audio 向 R2 直接串流，**无需下载到本地**

> **注意**：预签名 URL 1 小时后失效。若应用运行超过 1 小时，需重新点击「云端音乐」刷新 URL。

### 上传音乐到 R2

Tips 不内置上传 UI。可使用任意 S3 兼容工具：

```bash
# 使用 AWS CLI（配置 R2 endpoint）
aws s3 cp ~/Music/song.mp3 s3://<bucket>/tips-music/song.mp3 \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com

# 使用 rclone
rclone copy ~/Music/song.mp3 r2:<bucket>/tips-music/
```

## 数据流

```
点击「云端音乐」按钮
  → useCloudStorage.scanCloud()
  → invoke('get_cloud_config')         # 从 .env 获取凭证
  → S3Client.ListObjectsV2             # 列举 tips-music/*.mp3
  → 为每个文件生成 presigned URL（1h）
  → audio.setPresignedUrl(key, url)    # 缓存至 useAudio 内部 Map
  → setTracksState([...local, ...cloud])

双击云端曲目
  → audio.playAtIndex(index)
  → presignedUrlsRef.get(cloud_key)   # 取缓存 URL
  → audioElement.src = url            # HTML5 Audio 直接串流
```

## 故障排查

### 「云端音乐」按钮无响应 / 报错

1. 检查 `src-tauri/.env` 是否存在且字段完整
2. 确认 R2 凭证有效，bucket 名称正确
3. 查看开发终端日志（`RUST_LOG=debug pnpm tauri dev`）

### 云端曲目无法播放

1. 应用运行是否超过 1 小时？重新点击「云端音乐」刷新预签名 URL
2. 确认 R2 文件为有效 MP3 格式
3. 检查网络能否访问 Cloudflare R2

### 云端曲目不显示

确认文件已上传至 `tips-music/` 前缀下，且文件名以 `.mp3` 结尾（大小写不限）。
