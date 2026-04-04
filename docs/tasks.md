# Atomic Tasks

> **[已归档]** 此文档属于初始 eframe/egui 架构实现阶段，仅供历史参考。


## T1 — 建仓与脚手架
- 创建目标目录
- 初始化 Git
- 初始化 Cargo

## T2 — 写基础文档
- README
- AGENTS
- PRD
- 架构
- requirements

## T3 — 写模型层
- Track
- PlaybackState
- PlayerSnapshot
- 时间格式化

## T4 — 写扫描器
- 校验路径
- 递归扫描
- MP3 过滤
- 去重排序

## T5 — 写播放引擎
- 音频线程
- 输出设备初始化
- 命令通道
- 播放状态快照

## T6 — 写 UI 主题
- 色板
- 文本层级
- 控件 spacing

## T7 — 写主界面
- 顶部工具栏
- 左侧来源栏
- 中央列表
- 底部播放栏

## T8 — 连接导入与播放
- 文件夹选择器
- 拖拽导入
- 单击播放
- 上下首控制

## T9 — 测试与验证
- scanner tests
- model tests
- fmt / clippy / build / test
