# 更新日志

所有重要的变更都会记录在此文件中。

## [0.0.1] - 2025-12-04

### 新增

- 🎣 **Hooks 系统** - 类 React Hooks 的核心 API
  - `useHooks()` - 获取当前 Hooks 实例
  - `useService()` - 类型安全的服务访问
  - 自动的父子树结构管理
  - 完整的生命周期事件

- 🛡️ **Service 基类** - 统一的服务生命周期管理
  - `start()` / `stop()` 生命周期方法
  - `initialized` / `disposed` 状态属性
  - `ensureInitialized()` 保护方法
  - 完整的状态校验

- 🔧 **ConfigService** - 强大的配置管理
  - 嵌套配置访问（点号路径）
  - 环境变量替换（`${VAR:-default}`）
  - 自动保存到文件
  - 配置变更监听
  - 类型安全的配置访问

- 🔌 **适配器系统** - 多平台支持
  - ICQQ 适配器（QQ 平台）
  - Terminal 适配器（终端测试）
  - 统一的适配器接口
  - 账号管理

- 🎯 **指令系统** - 强大的消息解析
  - 参数解析（`<required>` / `[optional]`）
  - 选项支持（`-s, --long`）
  - 子指令
  - 自动帮助生成

- ⚡ **中间件系统** - 洋葱模型消息处理
  - 异步中间件支持
  - 条件过滤
  - 错误处理
  - next() 调用保护

- 🔥 **热重载** - 开发时自动重载
  - 文件监听
  - 自动卸载旧插件
  - 无缝重载

- 🚨 **错误处理** - 完整的错误体系
  - `ZhinError` 基类
  - 专用错误类（AdapterError、PluginError、ConfigError 等）
  - `ErrorManager` 全局错误管理
  - 错误代码常量
  - 错误上下文

- 🧪 **测试支持** - 高测试覆盖率
  - Vitest 测试框架
  - 227+ 测试用例
  - 覆盖率报告
  - UI 测试界面

### 技术栈

- TypeScript 5.7+
- Node.js 18+
- Vitest 4.0+
- ICQQ (QQ 适配器)
- js-yaml (配置文件)

### 文档

- ✅ README.md - 项目介绍
- ✅ docs/getting-started.md - 快速开始
- ✅ docs/core-concepts.md - 核心概念
- ✅ docs/service-system.md - 服务系统
- ✅ docs/configuration.md - 配置管理
- ✅ docs/error-handling.md - 错误处理

---

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。
