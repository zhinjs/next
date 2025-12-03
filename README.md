# Zhin Next

> 下一代多平台聊天机器人框架

## 简介

Zhin Next 是一个基于 TypeScript 的现代化聊天机器人框架，支持多平台适配器、插件系统和指令解析。框架采用事件驱动架构，具有高度可扩展性和灵活性。

## 特性

- 🚀 **TypeScript 支持** - 完整的类型定义，提供优秀的开发体验
- 🔌 **插件系统** - 强大的插件机制，支持热重载和动态加载
- 🎯 **指令解析** - 基于 @zhinjs/directive 的指令系统
- 🌐 **多平台适配** - 支持多种聊天平台（ICQQ、Terminal 等）
- 📦 **中间件机制** - 灵活的消息处理中间件
- 🔄 **进程管理** - 多进程架构，支持自动重启
- 📊 **日志系统** - 集成 @zhin.js/logger 日志系统
- ⚡ **高性能** - 优化的缓存策略和事件处理

## 安装

```bash
# 使用 pnpm（推荐）
pnpm install

# 或使用 npm
npm install

# 或使用 yarn
yarn install
```

## 快速开始

### 1. 配置文件

创建 `zhin.config.yml` 配置文件：

```yaml
log_level: 1
plugin_dirs:
  - ./plugins
plugins:
  - status
```

### 2. 创建插件

在 `src/plugins/` 目录下创建插件文件：

```typescript
import { usePlugin } from "zhin";
import { Directive } from "@zhinjs/directive";

const plugin = usePlugin();

// 创建一个简单的指令
const hello = new Directive("hello").handle(() => {
  return "Hello, World!";
});

plugin.directive(hello);
```

### 3. 运行

```bash
# 开发模式（支持热重载）
pnpm dev

# 构建
pnpm build

# 生产模式
node lib/index.js
```

## 核心概念

### Plugin（插件）

插件是 Zhin 的核心组件，每个插件可以：

- 注册指令
- 添加中间件
- 监听生命周期事件
- 注册适配器

```typescript
import { usePlugin } from "zhin";

const plugin = usePlugin();

// 注册指令
plugin.directive("ping", () => "pong");

// 添加中间件
plugin.middleware(async (event, next) => {
  console.log("消息:", event.data);
  await next();
});

// 监听生命周期
plugin.on("mounted", () => {
  console.log("插件已加载");
});
```

### Adapter（适配器）

适配器用于连接不同的聊天平台：

```typescript
import { Adapter, Account } from "zhin";

class MyAdapter extends Adapter<MyAccount> {
  async createAccount(options: Account.IOptions<MyAccount>) {
    return new MyAccount(options);
  }
}

plugin.adapter(new MyAdapter(config));
```

### Directive（指令）

指令系统用于解析和处理用户命令：

```typescript
import { Directive } from "@zhinjs/directive";

// 简单指令
const echo = new Directive("echo <message>").handle((_, message) => {
  return message;
});

// 带权限的指令
const admin = new Directive("admin <cmd>")
  .check((event) => event.user_id === "admin")
  .handle((_, cmd) => {
    return `执行管理命令: ${cmd}`;
  });

plugin.directive(echo);
plugin.directive(admin);
```

### Middleware（中间件）

中间件用于拦截和处理消息：

```typescript
plugin.middleware(async (event, next) => {
  // 前置处理
  console.log("收到消息:", event.data);
  
  // 调用下一个中间件
  await next();
  
  // 后置处理
  console.log("消息处理完成");
});
```

## 项目结构

```
zhin-next/
├── src/                  # 源代码
│   ├── account.ts       # 账号管理
│   ├── adapter.ts       # 适配器基类
│   ├── config.ts        # 配置管理
│   ├── event.ts         # 事件系统
│   ├── plugin.ts        # 插件系统
│   ├── segment.ts       # 消息段
│   ├── utils.ts         # 工具函数
│   ├── worker.ts        # 工作进程
│   ├── zhin.ts          # 核心类
│   └── plugins/         # 内置插件
│       ├── status.ts    # 状态插件
│       ├── adapter-icqq/    # ICQQ 适配器
│       └── adapter-terminal/ # 终端适配器
├── lib/                 # 编译输出
├── data/                # 数据目录
├── plugins/             # 用户插件
├── bin.js              # CLI 入口
├── package.json
├── tsconfig.json
└── zhin.config.yml     # 配置文件
```

## 内置插件

### status

系统状态监控插件，提供运行时信息：

```bash
zt  # 查看系统状态
```

输出信息包括：
- 插件数量
- 适配器数量
- 账号数量
- 运行时间
- 内存使用情况

## API 文档

### Plugin API

```typescript
class Plugin {
  // 注册适配器
  adapter<K extends keyof Plugin.Adapters>(adapter: Plugin.Adapters[K]): this
  
  // 注册指令
  directive(name: string, result: string): this
  directive(name: string, handle: Directive.Callback): this
  directive(directive: Directive): this
  
  // 添加中间件
  middleware(middleware: Plugin.Middleware): this
  
  // 导入子插件
  import(entry: string): Promise<Plugin>
  
  // 移除插件
  remove(name: string): Plugin
  
  // 启动插件
  start(): Promise<void>
  
  // 停止插件
  stop(): void
  
  // 广播事件
  broadcast<K>(name: K, ...args: Args<K>): Promise<void>
  
  // 分发事件
  dispatch<K>(name: K, ...args: Args<K>): Promise<void>
}
```

### Adapter API

```typescript
abstract class Adapter<A extends Account = Account> {
  // 创建账号
  abstract createAccount(options: Account.IOptions<A>): Promise<A>
  
  // 获取账号
  pickAccount(account: string): A
  
  // 启动适配器
  start(): Promise<void>
  
  // 停止适配器
  stop(): Promise<void>
  
  // 移除账号
  removeAccount(account: string): void
}
```

### Account API

```typescript
abstract class Account {
  // 发送消息
  abstract send(target: string, message: Segment | string): Promise<void>
  
  // 启动账号
  abstract start(): Promise<void>
  
  // 停止账号
  abstract stop(): Promise<void>
}
```

## 开发指南

### 创建自定义适配器

1. 继承 `Adapter` 类
2. 实现 `createAccount` 方法
3. 注册适配器到插件

```typescript
import { Adapter, Account } from "zhin";

class MyAccount extends Account {
  async send(target: string, message: string) {
    // 实现发送逻辑
  }
  
  async start() {
    // 启动连接
  }
  
  async stop() {
    // 断开连接
  }
}

class MyAdapter extends Adapter<MyAccount> {
  constructor(config: Account.IOptions<MyAccount>[]) {
    super("my-adapter", config);
  }
  
  async createAccount(options: Account.IOptions<MyAccount>) {
    return new MyAccount(options);
  }
}

// 注册适配器
const plugin = usePlugin();
plugin.adapter(new MyAdapter(config));
```

### 插件热重载

框架支持插件热重载功能：

```typescript
const plugin = usePlugin();

// 开启文件监听
plugin.watch();
```

修改插件文件后，框架会自动重新加载插件，无需重启应用。

### 调试技巧

1. **设置日志级别**

```yaml
# zhin.config.yml
log_level: 0  # 0=trace, 1=debug, 2=info, 3=warn, 4=error
```

2. **使用 TypeScript 源码模式**

```bash
pnpm dev  # 直接运行 TypeScript 源码
```

3. **查看进程状态**

使用内置的 `status` 插件查看运行时信息。

## 配置选项

### zhin.config.yml

```yaml
# 日志级别 (0-5)
log_level: 1

# 插件目录
plugin_dirs:
  - ./plugins
  - ./node_modules/@zhin/plugins

# 账号配置
accounts:
  - adapter: terminal
    title: Local Terminal
  - adapter: icqq
    uin: 123456789
    password: your_password

# 启用的插件
plugins:
  - status
  - custom-plugin
```

## 脚本命令

```json
{
  "dev": "运行开发模式（支持热重载）",
  "build": "编译 TypeScript 代码",
  "compile": "仅编译，不清理",
  "clean": "清理编译输出",
  "pub": "发布到 npm"
}
```

## 依赖项

### 核心依赖

- `@icqqjs/icqq` - ICQQ 协议支持
- `@zhinjs/directive` - 指令解析系统
- `@zhin.js/logger` - 日志系统
- `js-yaml` - YAML 配置解析
- `tsx` - TypeScript 执行器

### 开发依赖

- `typescript` - TypeScript 编译器
- `@types/node` - Node.js 类型定义
- `@types/js-yaml` - js-yaml 类型定义

## 性能优化

框架内置多项性能优化：

1. **缓存优化** - 适配器、账号列表等数据采用惰性计算和缓存
2. **中间件组合** - 中间件预编译，减少运行时开销
3. **事件优化** - 高效的事件分发机制
4. **内存管理** - 垃圾回收优化和内存监控

## 常见问题

### Q: 如何添加新的聊天平台支持？

A: 创建一个新的适配器类，继承 `Adapter` 并实现相关方法。参考 `src/plugins/adapter-icqq` 和 `src/plugins/adapter-terminal` 的实现。

### Q: 插件热重载不生效？

A: 确保插件文件不在 `node_modules` 目录下，并且调用了 `plugin.watch()` 方法。

### Q: 如何处理异步指令？

A: 指令处理函数支持异步操作：

```typescript
plugin.directive("async", async () => {
  const result = await someAsyncOperation();
  return result;
});
```

### Q: 如何访问其他插件的功能？

A: 通过 `plugin.root` 访问根插件，然后遍历 `children` 查找目标插件。

## 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

## 许可证

ISC License

## 相关链接

- [GitHub 仓库](https://github.com/zhinjs/next)
- [@zhinjs/directive](https://www.npmjs.com/package/@zhinjs/directive)
- [@zhin.js/logger](https://www.npmjs.com/package/@zhin.js/logger)
- [@icqqjs/icqq](https://www.npmjs.com/package/@icqqjs/icqq)

## 更新日志

### v0.0.1

- 🎉 初始版本发布
- ✨ 完整的插件系统
- ✨ 多平台适配器支持
- ✨ 指令解析系统
- ✨ 热重载支持
- ✨ 进程管理功能

---

**Made with ❤️ by Zhin Team**
