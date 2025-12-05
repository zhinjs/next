# 服务系统

服务系统是 Zhin Next 的核心特性之一，提供统一的生命周期管理和依赖注入。

## 什么是服务？

服务是具有以下特点的功能模块：

- ✅ 统一的生命周期（start/stop）
- ✅ 状态保护（防止未初始化使用）
- ✅ 依赖注入（通过 provide/inject）
- ✅ 类型安全（TypeScript 完整支持）

## Service 基类

所有服务都应该继承 `Service` 基类：

```typescript
import { Service } from "zhin-next";

class MyService extends Service {
  readonly name = "my-service";

  async start() {
    await super.start();
    // 初始化逻辑
  }

  async stop() {
    // 清理逻辑
    await super.stop();
  }
}
```

### 生命周期方法

#### start()

初始化服务，在服务开始使用前调用。

```typescript
class DatabaseService extends Service {
  readonly name = "database";
  private connection?: Connection;

  async start() {
    await super.start(); // 必须先调用

    // 建立数据库连接
    this.connection = await createConnection({
      host: "localhost",
      database: "mydb",
    });

    console.log("数据库已连接");
  }
}
```

**注意事项：**

- 必须先调用 `await super.start()`
- 不能重复调用（会抛出错误）
- 在 disposed 后不能再次启动

#### stop()

停止服务，清理资源。

```typescript
class DatabaseService extends Service {
  readonly name = "database";
  private connection?: Connection;

  async stop() {
    // 关闭连接
    if (this.connection) {
      await this.connection.close();
      this.connection = undefined;
    }

    console.log("数据库已断开");

    await super.stop(); // 必须最后调用
  }
}
```

**注意事项：**

- 应该在最后调用 `await super.stop()`
- 不能在未初始化时调用
- 不能重复调用

### 状态属性

#### initialized

服务是否已初始化：

```typescript
const service = new MyService();
console.log(service.initialized); // false

await service.start();
console.log(service.initialized); // true
```

#### disposed

服务是否已销毁：

```typescript
await service.start();
await service.stop();
console.log(service.disposed); // true
```

### 保护方法

#### ensureInitialized()

确保服务已初始化且未销毁，否则抛出错误：

```typescript
class CacheService extends Service {
  readonly name = "cache";
  private data = new Map();

  get(key: string) {
    this.ensureInitialized(); // 保护调用
    return this.data.get(key);
  }

  set(key: string, value: any) {
    this.ensureInitialized();
    this.data.set(key, value);
  }
}
```

**使用场景：**

- 所有业务方法都应该调用此方法
- 防止在未初始化时调用
- 防止在已销毁后调用

## 创建自定义服务

### 完整示例

```typescript
import { Service, useHooks } from "zhin-next";
import Redis from "ioredis";

// 1. 定义服务类
class CacheService extends Service {
  readonly name = "cache";
  private redis?: Redis;

  constructor(private config: { host: string; port: number }) {
    super();
  }

  async start() {
    await super.start();

    // 连接 Redis
    this.redis = new Redis({
      host: this.config.host,
      port: this.config.port,
    });

    console.log("缓存服务已启动");
  }

  async stop() {
    // 断开连接
    if (this.redis) {
      await this.redis.quit();
      this.redis = undefined;
    }

    await super.stop();
    console.log("缓存服务已停止");
  }

  // 业务方法
  async get(key: string): Promise<string | null> {
    this.ensureInitialized();
    return await this.redis!.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    this.ensureInitialized();
    if (ttl) {
      await this.redis!.setex(key, ttl, value);
    } else {
      await this.redis!.set(key, value);
    }
  }

  async delete(key: string): Promise<void> {
    this.ensureInitialized();
    await this.redis!.del(key);
  }
}

// 2. 注册服务
const hooks = useHooks();
const cache = new CacheService({
  host: "localhost",
  port: 6379,
});

hooks.provide("cache", cache);

// 3. 启动框架（会自动启动所有服务）
await hooks.start();

// 4. 在其他地方使用
import { useService } from "zhin-next";

const cache = useService("cache");
await cache.set("user:1", JSON.stringify({ name: "Alice" }));
const data = await cache.get("user:1");
```

## 服务注册

### provide()

注册服务到 Hooks 实例：

```typescript
const hooks = useHooks();
const myService = new MyService();

hooks.provide("my-service", myService);
```

**重要：** 注册的服务会在 `hooks.start()` 时自动调用 `start()` 方法初始化。你不需要手动调用 `service.start()`。

```typescript
const hooks = useHooks();
const myService = new MyService();
hooks.provide("my-service", myService);

// 启动框架时会自动启动所有已注册的服务
await hooks.start();
// 等同于：
// await myService.start();
// 然后启动框架
```

### 模块级注册

在服务定义文件中直接注册：

```typescript
// services/cache.ts
import { Service, useHooks } from "zhin-next";

export class CacheService extends Service {
  readonly name = "cache";
  // ...
}

// 模块级注册
const hooks = useHooks();
export const cacheService = new CacheService();
hooks.provide("cache", cacheService);
```

## 服务使用

### useService()

类型安全的服务访问：

```typescript
import { useService } from "zhin-next";

// 自动类型推导
const config = useService("config"); // ConfigService
const cache = useService("cache"); // CacheService

// TypeScript 会提供完整的类型提示
const value = await cache.get("key");
```

### inject()

底层注入方法：

```typescript
const hooks = useHooks();
const service = hooks.inject("my-service");

if (service) {
  // 使用服务
}
```

**useService vs inject：**

- `useService` - 类型安全，找不到会抛出错误
- `inject` - 返回 `undefined`，需要手动检查

## 服务类型声明

在 `types.ts` 中扩展 `Services` 接口：

```typescript
// src/types.ts
declare module "zhin-next" {
  namespace Hooks {
    interface Services {
      config: ConfigService;
      cache: CacheService;
      database: DatabaseService;
    }
  }
}
```

这样 `useService` 就能提供完整的类型推导。

## 内置服务

### ConfigService

配置管理服务：

```typescript
const config = useService("config");

// 获取配置
const value = config.get("adapters.0.name");

// 设置配置
config.set("log_level", "debug");

// 检查配置
if (config.has("database.host")) {
  // ...
}

// 删除配置
config.delete("temp.data");

// 监听变化
config.watch((key, value) => {
  console.log(`配置变化: ${key} = ${value}`);
});
```

## 服务依赖管理

服务之间通常存在相互调用的关系。Zhin 提供了两个阶段来处理服务依赖：

### 阶段 1：start 前 - 处理公共逻辑

在服务 `start()` 之前，使用 `useService()` 获取其他服务，处理不依赖运行时状态的逻辑：

```typescript
class UserService extends Service {
  readonly name = "user";

  // 在 start 前获取依赖服务
  private cache = useService("cache");
  private db = useService("database");

  async start() {
    await super.start();
    // 此时 cache 和 db 都已经启动完成
    console.log("UserService 已启动");
  }

  // 公共逻辑方法（不依赖运行时状态）
  async getUser(id: string) {
    this.ensureInitialized();

    // 先查缓存
    const cached = await this.cache.get(`user:${id}`);
    if (cached) return JSON.parse(cached);

    // 查数据库
    const user = await this.db.query("SELECT * FROM users WHERE id = ?", [id]);

    // 写入缓存
    await this.cache.set(`user:${id}`, JSON.stringify(user), 3600);

    return user;
  }
}
```

### 阶段 2：start 后 - 处理运行时逻辑

在所有服务启动后，使用 `hooks.onMounted()` 处理需要运行时状态的逻辑：

```typescript
class NotificationService extends Service {
  readonly name = "notification";

  async start() {
    await super.start();
    console.log("NotificationService 已启动");
  }

  async send(userId: string, message: string) {
    this.ensureInitialized();
    // 发送通知逻辑
  }
}

// 注册服务
const hooks = useHooks();
const userService = new UserService();
const notificationService = new NotificationService();

hooks.provide("user", userService);
hooks.provide("notification", notificationService);

// 在所有服务启动后执行
hooks.onMounted(async () => {
  const user = useService("user");
  const notification = useService("notification");

  // 启动后的初始化逻辑
  const admins = await user.getAdmins();
  for (const admin of admins) {
    await notification.send(admin.id, "系统已启动");
  }
});

// 启动框架（自动启动所有服务，然后触发 mounted 事件）
await hooks.start();
```

### 完整示例：服务依赖链

```typescript
// 1. 数据库服务（基础服务，无依赖）
class DatabaseService extends Service {
  readonly name = "database";

  async start() {
    await super.start();
    // 连接数据库
  }

  async query(sql: string) {
    this.ensureInitialized();
    // 执行查询
  }
}

// 2. 缓存服务（基础服务，无依赖）
class CacheService extends Service {
  readonly name = "cache";

  async start() {
    await super.start();
    // 连接 Redis
  }

  async get(key: string) {
    this.ensureInitialized();
    // 获取缓存
  }
}

// 3. 用户服务（依赖 database 和 cache）
class UserService extends Service {
  readonly name = "user";

  // start 前获取依赖（处理公共逻辑）
  private db = useService("database");
  private cache = useService("cache");

  async start() {
    await super.start();
    console.log("UserService 已启动");
  }

  async getUser(id: string) {
    this.ensureInitialized();

    const cached = await this.cache.get(`user:${id}`);
    if (cached) return JSON.parse(cached);

    const user = await this.db.query("SELECT * FROM users WHERE id = ?", [id]);
    await this.cache.set(`user:${id}`, JSON.stringify(user));

    return user;
  }
}

// 4. 通知服务（基础服务）
class NotificationService extends Service {
  readonly name = "notification";

  async start() {
    await super.start();
    console.log("NotificationService 已启动");
  }

  async send(userId: string, message: string) {
    this.ensureInitialized();
    // 发送通知
  }
}

// 注册所有服务
const hooks = useHooks();
hooks.provide("database", new DatabaseService());
hooks.provide("cache", new CacheService());
hooks.provide("user", new UserService());
hooks.provide("notification", new NotificationService());

// 启动后的逻辑（需要所有服务都已运行）
hooks.onMounted(async () => {
  const user = useService("user");
  const notification = useService("notification");

  // 发送启动通知给所有管理员
  const admins = await user.getAdmins();
  for (const admin of admins) {
    await notification.send(admin.id, "机器人已上线");
  }

  console.log("启动通知已发送");
});

// 启动框架
await hooks.start();
// 执行顺序：
// 1. database.start()
// 2. cache.start()
// 3. user.start()
// 4. notification.start()
// 5. 触发 mounted 事件
// 6. 执行 onMounted 回调
```

### 依赖管理最佳实践

#### ✅ 推荐做法

```typescript
class MyService extends Service {
  readonly name = "my-service";

  // ✅ 在类属性中获取依赖（start 前）
  private db = useService("database");

  async start() {
    await super.start();
    // ✅ start 中只做初始化，不调用其他服务的业务方法
  }

  async doSomething() {
    this.ensureInitialized();
    // ✅ 业务方法中调用依赖服务
    await this.db.query("SELECT * FROM data");
  }
}

// ✅ 需要运行时状态的逻辑放在 onMounted
hooks.onMounted(async () => {
  const myService = useService("my-service");
  await myService.doSomething();
});
```

#### ❌ 不推荐做法

```typescript
class MyService extends Service {
  readonly name = "my-service";

  async start() {
    await super.start();

    // ❌ 不要在 start 中调用其他服务的业务方法
    const db = useService("database");
    await db.query("SELECT * FROM data"); // 可能导致循环依赖
  }
}

// ❌ 不要在服务构造函数中调用业务逻辑
const service = new MyService();
await service.doSomething(); // service 还未启动
```

### 循环依赖的处理

**问题场景：**

```typescript
// 插件 A
const b = useService("b"); // A 依赖 B
hooks.provide("a", serviceA);

// 插件 B
const a = useService("a"); // B 依赖 A
hooks.provide("b", serviceB);
```

**解决方案：惰性查找**

`useService()` 返回的是 **Proxy 对象**，服务查找延迟到**实际访问**时才发生：

```typescript
// 模块加载阶段 - 不会报错
private otherService = useService("other");  // 只是创建 Proxy

// 运行时访问 - 才真正查找服务
async doSomething() {
  await this.otherService.method();  // 此时才查找 "other" 服务
}
```

**注意事项：**

1. **确保正确的导入顺序（推荐）**

   ```typescript
   // ✅ 推荐：先导入提供服务的插件
   await hooks.import("./plugins/config"); // 提供 config 服务

   // 然后使用服务
   const config = useService("config");
   config.load("app.config", {}); // OK
   ```

2. **使用 await 自动等待服务注册（备选方案）**

   ```typescript
   // 先获取服务（此时可能还未提供）
   const configPromise = useService("config");

   // 稍后导入提供服务的插件
   await hooks.import("./plugins/config");

   // await 会自动等待服务注册（使用 setImmediate）
   const config = await configPromise;
   config.load("app.config", {}); // OK
   ```

3. **不要在模块顶层直接访问服务属性**

   ```typescript
   // ❌ 错误：模块加载时立即访问
   const db = useService("database");
   const version = db.version; // 报错：此时 database 可能还未 provide

   // ✅ 正确：在方法/函数中访问
   const db = useService("database");
   async init() {
     const version = db.version; // OK：延迟访问
   }

   // ✅ 或使用 await（自动等待）
   const db = await useService("database");
   const version = db.version; // OK
   ```

4. **服务间依赖在类属性中声明是安全的**

   ```typescript
   class UserService extends Service {
     // ✅ 安全：只是创建 Proxy，不立即访问
     private db = useService("database");
     private cache = useService("cache");

     async getUser(id: string) {
       // ✅ 实际访问时才查找服务
       const user = await this.db.query("...");
       return user;
     }
   }
   ```

5. **循环调用依然需要避免**
   ```typescript
   // ❌ 即使有 Proxy，也要避免循环调用
   class A extends Service {
     private b = useService("b");
     async start() {
       await this.b.init(); // B.init 又调用 A.init = 死循环
     }
   }
   ```

### 为什么这样设计？

**阶段分离的好处：**

1. **避免循环依赖**
   - start 前只获取服务引用（Proxy），不立即查找
   - start 中只做自身初始化
   - onMounted 中才进行跨服务调用

2. **明确的启动顺序**
   - 所有服务先完成 start（初始化）
   - 然后统一触发 mounted（业务逻辑）

3. **更好的可测试性**
   - 服务初始化和业务逻辑分离
   - 可以单独测试每个阶段

4. **清晰的责任划分**
   - `useService()` → 获取依赖（惰性）
   - `start()` → 初始化自身
   - `onMounted()` → 跨服务协作

````

## 最佳实践

### 1. 总是实现生命周期

即使暂时为空，也应该实现 start/stop：

```typescript
class MyService extends Service {
  readonly name = "my-service";

  async start() {
    await super.start();
    // 未来可能需要初始化
  }

  async stop() {
    // 未来可能需要清理
    await super.stop();
  }
}
````

### 2. 使用 ensureInitialized

所有业务方法都应该检查状态：

```typescript
class MyService extends Service {
  doSomething() {
    this.ensureInitialized(); // ✅ 保护
    // 业务逻辑
  }
}
```

### 3. 正确处理资源

在 stop 中清理所有资源：

```typescript
class MyService extends Service {
  private timers: NodeJS.Timeout[] = [];
  private connections: Connection[] = [];

  async stop() {
    // 清理定时器
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers = [];

    // 关闭连接
    await Promise.all(this.connections.map((conn) => conn.close()));
    this.connections = [];

    await super.stop();
  }
}
```

### 4. 服务命名规范

- 使用小写加连字符：`my-service`
- 保持简洁明确：`cache` 而非 `cache-service`
- 避免冲突：检查是否已存在同名服务

### 5. 类型声明

始终为自定义服务添加类型声明：

```typescript
// services/my-service.ts
export class MyService extends Service {
  readonly name = "my-service";
}

// types.ts
declare module "zhin-next" {
  namespace Hooks {
    interface Services {
      "my-service": MyService;
    }
  }
}
```

## 错误处理

服务会在以下情况抛出错误：

```typescript
const service = new MyService();

// ❌ 重复初始化
await service.start();
await service.start(); // Error: Service "my-service" already initialized

// ❌ 未初始化就停止
service.stop(); // Error: Service "my-service" not initialized

// ❌ 已销毁后调用
await service.start();
await service.stop();
await service.start(); // Error: Service "my-service" already disposed

// ❌ 未初始化就使用
service.doSomething(); // Error: Service "my-service" not initialized
```

## 调试技巧

### 日志服务状态

```typescript
class MyService extends Service {
  async start() {
    console.log(`[${this.name}] 正在启动...`);
    await super.start();
    console.log(`[${this.name}] 已启动`);
  }

  async stop() {
    console.log(`[${this.name}] 正在停止...`);
    await super.stop();
    console.log(`[${this.name}] 已停止`);
  }
}
```

### 查看所有服务

```typescript
const hooks = useHooks();
// hooks.#services 是私有的，但可以通过 inject 遍历
const serviceNames = ["config", "cache", "database"];
for (const name of serviceNames) {
  const service = hooks.inject(name);
  if (service) {
    console.log(
      `${name}: initialized=${service.initialized}, disposed=${service.disposed}`
    );
  }
}
```

## 下一步

- [配置管理](./configuration.md) - 深入了解 ConfigService
- [错误处理](./error-handling.md) - 服务错误处理
- [API 参考](./api-reference.md) - 完整的 API 文档
