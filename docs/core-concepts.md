# 核心概念

理解 Zhin Next 的核心概念将帮助你更好地使用框架。

## Hooks 系统

Hooks 是框架的核心抽象，它提供：

- **上下文管理** - 通过 AsyncLocalStorage 自动管理执行上下文
- **生命周期** - 统一的启动、停止、重载流程
- **树形结构** - 插件之间自动形成父子关系

### 基本用法

```typescript
import { useHooks } from "zhin-next";

// 每次调用 useHooks() 都会根据调用文件创建或获取对应的 Hooks 实例
const hooks = useHooks();

// 子插件会自动添加到父插件的 children 数组
// plugin-a.ts
const parentHooks = useHooks();

// plugin-b.ts (被 plugin-a 导入)
const childHooks = useHooks(); // 自动成为 parentHooks 的子节点
```

### 生命周期

```typescript
hooks.on("ready", () => {
  console.log("框架已就绪");
});

hooks.on("dispose", () => {
  console.log("框架正在关闭");
});

hooks.on("plugin-added", (plugin) => {
  console.log("插件已加载:", plugin.name);
});

hooks.on("plugin-removed", (plugin) => {
  console.log("插件已卸载:", plugin.name);
});
```

### 树形结构

```typescript
// 获取根节点
const root = hooks.root;

// 访问子插件
for (const child of hooks.children) {
  console.log("子插件:", child.name);
}

// 向上查找父节点
let current = hooks;
while (current.parent) {
  current = current.parent;
  console.log("父插件:", current.name);
}
```

## 服务系统

服务是可复用的功能模块，具有完整的生命周期管理。

### Service 基类

```typescript
import { Service } from "zhin-next";

class MyService extends Service {
  // 必须实现：服务名称
  readonly name = "my-service";

  // 可选：初始化逻辑
  async start() {
    await super.start(); // 必须调用
    // 你的初始化代码
    console.log("服务已启动");
  }

  // 可选：清理逻辑
  async stop() {
    // 你的清理代码
    console.log("服务正在停止");
    await super.stop(); // 必须调用
  }

  // 业务方法
  async doSomething() {
    this.ensureInitialized(); // 确保服务已初始化
    // 业务逻辑
  }
}
```

### 服务状态

Service 基类提供三个状态标志：

- `initialized` - 服务是否已初始化
- `disposed` - 服务是否已销毁
- `ensureInitialized()` - 保护方法，确保服务可用

```typescript
const service = new MyService();

console.log(service.initialized); // false
console.log(service.disposed); // false

await service.start();
console.log(service.initialized); // true

service.doSomething(); // ✅ 正常执行

await service.stop();
console.log(service.disposed); // true

service.doSomething(); // ❌ 抛出错误
```

### 服务注册与使用

```typescript
import { useHooks, useService } from "zhin-next";

// 1. 创建并注册服务
const hooks = useHooks();
const myService = new MyService();
hooks.provide("my-service", myService);

// 2. 启动框架（自动启动所有已注册的服务）
await hooks.start();

// 3. 在其他地方使用（类型安全）
const service = useService("my-service"); // 自动推断类型
await service.doSomething();
```

### 服务依赖管理

服务之间的依赖分两个阶段处理：

**阶段 1：start 前 - 公共逻辑**

```typescript
class UserService extends Service {
  readonly name = "user";

  // start 前获取依赖服务
  private db = useService("database");
  private cache = useService("cache");

  async getUser(id: string) {
    this.ensureInitialized();
    // 使用依赖服务的公共方法
    const cached = await this.cache.get(`user:${id}`);
    if (cached) return cached;
    return await this.db.query("SELECT * FROM users WHERE id = ?", [id]);
  }
}
```

**阶段 2：start 后 - 运行时逻辑**

```typescript
// 所有服务启动后的协作逻辑
hooks.onMounted(async () => {
  const user = useService("user");
  const notification = useService("notification");

  // 跨服务调用
  const admins = await user.getAdmins();
  for (const admin of admins) {
    await notification.send(admin.id, "系统已启动");
  }
});
```

### 服务查找策略

`useService` 和 `inject` 使用混合查找策略：

1. **当前节点** - 先查找当前 Hooks 实例
2. **父链查找** - 向上遍历父节点
3. **全局查找** - 从根节点向下遍历整个树

```typescript
// plugin-a.ts
const hooks = useHooks();
hooks.provide("db", dbService);

// plugin-b.ts (plugin-a 的子插件)
const db = useService("db"); // ✅ 可以找到父插件的服务

// plugin-c.ts (独立插件)
const db = useService("db"); // ✅ 通过全局查找也能找到
```

## 依赖注入

框架提供 `provide` 和 `inject` 实现依赖注入：

```typescript
// 提供依赖
hooks.provide("config", configValue);
hooks.provide("logger", loggerInstance);

// 注入依赖
const config = hooks.inject("config");
const logger = hooks.inject("logger");

// 类型安全的注入
const config = useService("config"); // ConfigService 类型
```

## 事件系统

Hooks 继承自 EventEmitter，支持完整的事件功能：

```typescript
// 监听事件
hooks.on("message", (event) => {
  console.log(event.raw_message);
});

// 一次性监听
hooks.once("ready", () => {
  console.log("首次启动");
});

// 移除监听
const handler = (event) => {
  /* ... */
};
hooks.on("message", handler);
hooks.off("message", handler);

// 触发事件
hooks.emit("custom-event", data);
```

### 内置事件

| 事件名           | 参数           | 描述     |
| ---------------- | -------------- | -------- |
| `ready`          | -              | 框架就绪 |
| `dispose`        | -              | 框架关闭 |
| `plugin-added`   | `Plugin`       | 插件加载 |
| `plugin-removed` | `Plugin`       | 插件卸载 |
| `message`        | `MessageEvent` | 收到消息 |
| `request`        | `RequestEvent` | 收到请求 |
| `notice`         | `NoticeEvent`  | 收到通知 |

## 中间件

中间件提供洋葱模型的消息处理：

```typescript
// 基础中间件
hooks.middleware(async (event, next) => {
  console.log("Before");
  await next(); // 调用下一个中间件
  console.log("After");
});

// 条件中间件
hooks.middleware(
  async (event, next) => {
    // 处理逻辑
    await next();
  },
  (event) => event.message_type === "private" // 过滤条件
);

// 中间件组合
hooks.middleware(middleware1);
hooks.middleware(middleware2);
hooks.middleware(middleware3);
// 执行顺序：middleware1 → middleware2 → middleware3 → middleware3 → middleware2 → middleware1
```

### 中间件错误处理

```typescript
hooks.middleware(async (event, next) => {
  try {
    await next();
  } catch (error) {
    console.error("中间件错误:", error);
    event.reply("处理消息时出错");
  }
});
```

## 插件系统

插件是组织代码的基本单位：

```typescript
// plugin.ts
import { useHooks } from "zhin-next";

export const name = "my-plugin";

const plugin = useHooks();

plugin.middleware(async (event, next) => {
  // 插件逻辑
  await next();
});

plugin.command("test").action((event) => {
  event.reply("测试插件");
});
```

### 动态加载插件

```typescript
// 加载插件文件
await hooks.plugin("./plugins/my-plugin.ts");

// 插件会自动成为子节点
console.log(hooks.children.length); // 1
```

### 插件热重载

开发时框架会监听文件变化并自动重载：

```typescript
hooks.watch(); // 启用文件监听

// 修改插件文件后会自动：
// 1. 卸载旧插件
// 2. 重新加载新插件
// 3. 触发 plugin-removed 和 plugin-added 事件
```

## 适配器

适配器提供平台抽象：

```typescript
import { Adapter } from "zhin-next";

class MyAdapter extends Adapter<MyBot> {
  async start() {
    // 启动逻辑
    this.bot = await this.createBot();
    this.bindEvents();
  }

  async stop() {
    // 停止逻辑
    await this.bot.disconnect();
  }

  private bindEvents() {
    this.bot.on("message", (data) => {
      const account = this.createAccount(data.user_id);
      const event = this.createMessageEvent(account, data);
      this.dispatch(event); // 分发到框架
    });
  }
}

// 注册适配器
Adapter.define("my-platform", MyAdapter);
```

## 账号管理

每个适配器可以管理多个账号：

```typescript
// 获取所有账号
const accounts = hooks.accounts;

// 获取指定适配器的账号
const qqAccounts = hooks.adapters.get("icqq")?.accounts;

// 遍历账号
for (const account of accounts) {
  console.log(`账号: ${account.self_id} - ${account.adapter.name}`);
}
```

## 下一步

- [服务系统详解](./service-system.md)
- [指令系统](./command-system.md)
- [配置管理](./configuration.md)
- [错误处理](./error-handling.md)
