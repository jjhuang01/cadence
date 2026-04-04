# Epic Breakdown

> **[已归档]** 此文档属于初始 eframe/egui 架构规划阶段，仅供历史参考。当前架构已迁移至 Tauri 2 + React + TypeScript。


## Epic 1 — Product Foundation

- 明确 MVP 范围
- 建立文档体系
- 写清 UI / 扫描 / 播放边界

## Epic 2 — Desktop App Skeleton

- 建立 Rust crate
- 集成 eframe/egui
- 初始化主题和窗口

## Epic 3 — Local Music Ingestion

- 文件夹选择
- 拖拽导入
- 递归扫描 `.mp3`
- 去重与排序

## Epic 4 — Playback Engine

- 音频线程
- 输出设备生命周期管理
- 播放 / 暂停 / 切歌
- 播放状态快照

## Epic 5 — User Interface

- 顶部工具栏
- 左侧来源栏
- 中央曲目列表
- 底部播放控制栏
- 空状态 / 错误态 / 拖拽态

## Epic 6 — Quality & Verification

- 单元测试
- 基础调试日志
- 构建验证
- 验收脚本
