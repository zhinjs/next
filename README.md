# Zhin Next

> 下一代 Hooks 风格的多平台聊天机器人框架

[![npm version](https://img.shields.io/npm/v/zhin-next.svg)](https://www.npmjs.com/package/zhin-next)
[![License](https://img.shields.io/npm/l/zhin-next.svg)](https://github.com/zhinjs/next/blob/main/LICENSE)
[![Node.js Version](https://img.shields.io/node/v/zhin-next.svg)](https://nodejs.org)

## ✨ 特性

- 🎣 **Hooks 风格 API** - 类似 React Hooks 的直观 API 设计
- 🔌 **多平台支持** - 支持 QQ、终端等多种适配器
- 🛡️ **完整的类型安全** - 基于 TypeScript，提供完整的类型推导
- 🧩 **服务系统** - 统一的服务生命周期管理
- ⚡ **热重载** - 开发时自动重载插件
- 🔧 **灵活的配置** - 支持环境变量、嵌套配置、类型安全访问
- 🎯 **指令系统** - 强大的消息指令解析
- 📦 **零配置启动** - 开箱即用的开发体验
- 🧪 **高测试覆盖** - 完整的单元测试和集成测试

## 📦 安装

```bash
npm install zhin-next
# 或
pnpm add zhin-next
# 或
yarn add zhin-next
```

## 🚀 快速开始

### 基础使用

```typescript
import { useHooks } from "zhin-next";

// 创建插件
const plugin = useHooks();

// 注册中间件
plugin.middleware(async (event, next) => {
  console.log("收到消息:", event.raw_message);
  await next();
});

// 注册指令
plugin.command("hello <name>").action((event, args) => {
  event.reply(`你好，${args.name}！`);
});

// 启动框架
await plugin.start();
```

### 配置文件

创建 `zhin.config.yml`:

```yaml
# 适配器配置
adapters:
  - name: icqq
    bots:
      - self_id: 123456789
        password: your_password
```

## 📖 核心概念

### Hooks 系统

Hooks 是框架的核心，提供统一的生命周期和上下文管理：

```typescript
import { useHooks } from "zhin-next";

const hooks = useHooks();

// 插件自动形成父子树结构
// 当前插件文件会自动创建新的 Hooks 节点
```

### 服务系统

服务提供可复用的功能模块：

```typescript
import { Service, useService, useHooks } from "zhin-next";

// 1. 定义服务
class DatabaseService extends Service {
  readonly name = "database";

  async start() {
    await super.start();
    // 初始化数据库连接
  }

  async stop() {
    // 清理资源
    await super.stop();
  }

  async query(sql: string) {
    this.ensureInitialized();
    // 执行查询
  }
}

// 2. 注册服务
const hooks = useHooks();
const dbService = new DatabaseService();
hooks.provide("database", dbService);

// 3. 启动框架（自动启动所有已注册的服务）
await hooks.start();

// 4. 使用服务（惰性查找，避免循环依赖）
const db = useService("database"); // 返回 Proxy，延迟查找
await db.query("SELECT * FROM users"); // 实际访问时才查找服务
```

**重要：导入顺序**

```typescript
// ✅ 推荐：先导入提供服务的插件
await hooks.import("./plugins/config"); // 提供 config 服务

const config = useService("config");
config.load("app.config", {}); // OK

// ✅ 备选：使用 await 自动等待
const config = await useService("config"); // 自动等待服务注册
config.load("app.config", {}); // OK
```

**循环依赖处理：**

`useService()` 返回 Proxy 对象，服务查找延迟到实际访问时，因此支持服务间循环依赖：

```typescript
// 插件 A
class ServiceA extends Service {
  private b = useService("b"); // ✅ 只创建 Proxy，不立即查找
}
hooks.provide("a", new ServiceA());

// 插件 B
class ServiceB extends Service {
  private a = useService("a"); // ✅ 同样不会报错
}
hooks.provide("b", new ServiceB());

// 运行时调用正常工作
await serviceA.callB(); // ✅ 此时才真正查找服务
```

hooks.provide("a", serviceA);

// 插件 B
const serviceA = useService("a"); // ✅ 同样不会立即查找
hooks.provide("b", serviceB);

// 运行时访问 - 此时所有服务已注册
await serviceA.callB(); // ✅ 实际访问时才查找，正常工作

````

### 配置管理

内置的配置服务支持类型安全的配置访问：

```typescript
import { useService } from "zhin-next";

const config = useService("config");

// 类型安全的配置访问
const value = config.get("adapters.0.name"); // string
config.set("adapters.0.name", "new-adapter");

// 支持环境变量替换
// 配置文件: password: ${QQ_PASSWORD:-default}
// 会自动读取 process.env.QQ_PASSWORD，不存在则使用 'default'
````

### 事件系统

```typescript
// 监听消息事件
hooks.on("message", (event) => {
  console.log("收到消息:", event.raw_message);
});

// 监听好友请求
hooks.on("request.friend", (event) => {
  event.approve(); // 同意好友请求
});

// 生命周期事件
hooks.on("ready", () => {
  console.log("框架已就绪");
});

hooks.on("dispose", () => {
  console.log("框架正在关闭");
});
```

### 中间件

中间件提供洋葱模型的消息处理流程：

```typescript
// 全局中间件
hooks.middleware(async (event, next) => {
  console.log("Before:", event.raw_message);
  await next();
  console.log("After:", event.raw_message);
});

// 条件中间件
hooks.middleware(
  async (event, next) => {
    // 仅处理包含 "hello" 的消息
    await next();
  },
  (event) => event.raw_message.includes("hello")
);
```

### 指令系统

强大的指令解析和参数验证：

```typescript
// 基础指令
hooks.command("ping").action((event) => {
  event.reply("pong!");
});

// 带参数的指令
hooks.command("echo <message...>").action((event, args) => {
  event.reply(args.message);
});

// 带选项的指令
hooks
  .command("user <id>")
  .option("-v, --verbose", "详细信息")
  .option("-f, --format <type>", "输出格式", { default: "json" })
  .action((event, args, options) => {
    // args.id: string
    // options.verbose: boolean
    // options.format: string
  });

// 子指令
const user = hooks.command("user");
user.subcommand("list").action((event) => {
  event.reply("用户列表...");
});
```

### 适配器

适配器提供多平台支持：

```typescript
import { Adapter, Account } from "zhin-next";

class MyAdapter extends Adapter<MyBot> {
  async start() {
    // 启动适配器
    this.bot = new MyBot(this.config);

    // 绑定事件
    this.bot.on("message", (data) => {
      const account = this.createAccount(data.user_id);
      const event = this.createEvent(account, data);
      this.dispatch(event);
    });
  }

  async stop() {
    // 停止适配器
    await this.bot.disconnect();
  }
}

// 注册适配器
Adapter.define("my-platform", MyAdapter);
```

## 🔧 API 参考

### Hooks

| 方法                      | 描述       |
| ------------------------- | ---------- |
| `middleware(fn, filter?)` | 注册中间件 |
| `command(def)`            | 注册指令   |
| `plugin(path)`            | 加载插件   |
| `provide(name, value)`    | 提供服务   |
| `inject(name)`            | 注入服务   |
| `on(event, handler)`      | 监听事件   |
| `emit(event, ...args)`    | 触发事件   |
| `start()`                 | 启动框架   |
| `stop()`                  | 停止框架   |

### Service

| 方法/属性             | 描述                 |
| --------------------- | -------------------- |
| `name`                | 服务名称（必须实现） |
| `initialized`         | 是否已初始化         |
| `disposed`            | 是否已销毁           |
| `start()`             | 初始化服务           |
| `stop()`              | 停止服务             |
| `ensureInitialized()` | 确保服务已初始化     |

### ConfigService

| 方法              | 描述             |
| ----------------- | ---------------- |
| `get(key)`        | 获取配置值       |
| `set(key, value)` | 设置配置值       |
| `has(key)`        | 检查配置是否存在 |
| `delete(key)`     | 删除配置         |
| `watch(callback)` | 监听配置变化     |

### 辅助函数

| 函数                  | 描述                     |
| --------------------- | ------------------------ |
| `useHooks()`          | 获取当前 Hooks 实例      |
| `useService<T>(name)` | 获取指定服务（类型安全） |

## 🔌 内置适配器

- **ICQQ** - QQ 平台适配器
- **Terminal** - 终端命令行适配器（用于测试）

## 📝 配置文件

### zhin.config.yml

```yaml
# 日志级别
log_level: info

# 适配器配置
adapters:
  - name: icqq
    bots:
      - self_id: 123456789
        password: ${QQ_PASSWORD}
        platform: 5 # 1: Android, 5: iPad

  - name: terminal
    bots:
      - self_id: terminal

# 插件目录
plugin_dir: ./plugins

# 数据目录
data_dir: ./data
```

### 环境变量支持

配置文件支持环境变量替换：

```yaml
# ${VAR} - 使用环境变量，不存在则报错
# ${VAR:-default} - 使用环境变量，不存在则使用默认值
password: ${QQ_PASSWORD:-123456}
```

## 🧪 测试

```bash
# 运行测试
pnpm test

# 监听模式
pnpm test:watch

# 覆盖率报告
pnpm test:coverage

# 测试 UI
pnpm test:ui
```

## 🛠️ 开发

```bash
# 克隆项目
git clone https://github.com/zhinjs/next.git
cd next

# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 代码检查
pnpm lint

# 格式化代码
pnpm format
```

## 📚 示例

查看 [examples](./examples) 目录获取更多示例：

- **基础插件** - 简单的消息响应
- **自定义服务** - 创建和使用服务
- **指令系统** - 复杂指令处理
- **数据库集成** - 服务与数据库结合

## 🤝 贡献

欢迎贡献代码！请查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解详情。

## 📄 许可

[ISC](./LICENSE) © Zhin Team

## 🔗 相关链接

- [GitHub](https://github.com/zhinjs/next)
- [NPM](https://www.npmjs.com/package/zhin-next)
- [问题反馈](https://github.com/zhinjs/next/issues)

---

**使用 Zhin Next 构建你的下一个聊天机器人！** 🚀
