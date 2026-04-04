# Implementation Plan

> **[已归档]** 此文档属于初始 eframe/egui 架构规划阶段，仅供历史参考。当前架构已迁移至 Tauri 2 + React + TypeScript。


## Phase 1 — Discovery & Scope Lock

- 调研极简本地播放器的功能边界
- 选择 Rust GUI / 音频 / 文件对话框技术栈
- 决定只做 MVP 主路径

## Phase 2 — Repo Bootstrap

- 创建 `/Users/os/Desktop/code/self/tips`
- 初始化 Git
- 初始化 Cargo 二进制工程
- 建立文档与源码目录结构

## Phase 3 — Architecture Baseline

- 定义三线程模型
- 确定单一真相源
- 确定拖拽与文件夹选择走统一导入流程

## Phase 4 — Core Implementation

- 扫描器
- 播放引擎
- MVP UI

## Phase 5 — Hardening

- 增加单测
- 增加 tracing
- 修正 build / lint / test 失败项

## Phase 6 — Acceptance

- 手工验证导入、播放、切歌、空状态、错误态
- 运行 fmt / test / clippy / build
