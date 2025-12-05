# 服务异步使用示例

## 使用 await 自动等待服务注册

Zhin Next 的 `useService()` 支持 `await`，可以自动等待服务注册完成。

### 基本用法

```typescript
import { useHooks, useService } from "zhin-next";

const hooks = useHooks();

// 方式 1：推荐 - 先导入后使用（同步）
await hooks.import("./plugins/database");
const db = useService("database");
await db.connect();

// 方式 2：使用 await 自动等待（异步）
const dbPromise = useService("database"); // 立即返回 Proxy
await hooks.import("./plugins/database"); // 注册服务
const db = await dbPromise; // 自动等待注册完成
await db.connect();
```

### 实际场景

#### 场景 1：动态加载插件

```typescript
async function loadPluginDynamically(pluginName: string) {
  // 先获取服务引用（可能还未加载）
  const service = useService(pluginName);

  // 根据条件动态加载
  if (shouldLoadPlugin(pluginName)) {
    await hooks.import(`./plugins/${pluginName}`);
  }

  // await 会等待服务注册
  const actualService = await service;
  return actualService;
}
```

#### 场景 2：并行加载多个服务

```typescript
async function loadServices() {
  const hooks = useHooks();

  // 先获取所有服务引用
  const dbPromise = useService("database");
  const cachePromise = useService("cache");
  const configPromise = useService("config");

  // 并行导入所有插件
  await Promise.all([
    hooks.import("./plugins/database"),
    hooks.import("./plugins/cache"),
    hooks.import("./plugins/config"),
  ]);

  // 并行等待所有服务
  const [db, cache, config] = await Promise.all([
    dbPromise,
    cachePromise,
    configPromise,
  ]);

  return { db, cache, config };
}
```

#### 场景 3：条件导入

```typescript
async function setupApp(env: string) {
  const hooks = useHooks();

  // 总是获取配置服务引用
  const config = useService("config");

  // 根据环境导入不同插件
  if (env === "development") {
    await hooks.import("./plugins/dev-tools");
  } else {
    await hooks.import("./plugins/prod-tools");
  }

  // 导入配置插件
  await hooks.import("./plugins/config");

  // 使用 await 确保服务可用
  const configService = await config;
  return configService.get();
}
```

### 工作原理

`useService()` 返回的 Proxy 对象实现了 `then` 方法，使其可被 `await`：

```typescript
// 内部实现（简化版）
export function useService(name) {
  return new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === "then") {
          // 返回 Promise，使用 queueMicrotask 等待微任务队列
          return (resolve, reject) => {
            queueMicrotask(() => {
              const service = hooks.inject(name);
              if (service) resolve(service);
              else reject(new Error(`Service "${name}" not found`));
            });
          };
        }
        // 正常属性访问
        const service = hooks.inject(name);
        return service[prop];
      },
    }
  );
}
```

**为什么使用 `queueMicrotask` 而不是 `setImmediate`？**

1. **更快** - 微任务在当前事件循环结束后立即执行，比 `setImmediate`（下一个事件循环）快
2. **与 Promise 语义一致** - `await` 本质是等待微任务
3. **更可预测** - 执行顺序：同步代码 → 微任务 → 宏任务（setImmediate）

### 最佳实践

1. **优先使用正确的导入顺序（同步）**

   ```typescript
   // ✅ 推荐：清晰、快速
   await hooks.import("./plugins/service");
   const service = useService("service");
   ```

2. **在需要动态加载时使用 await**

   ```typescript
   // ✅ 适用场景：动态加载、条件加载
   const service = useService("service");
   await loadPluginDynamically();
   const actualService = await service;
   ```

3. **避免不必要的 await**

   ```typescript
   // ❌ 不必要：如果已经按顺序导入
   await hooks.import("./plugins/service");
   const service = await useService("service"); // await 是多余的

   // ✅ 更好
   await hooks.import("./plugins/service");
   const service = useService("service"); // 直接使用
   ```

4. **在服务类中不需要 await**

   ```typescript
   class MyService extends Service {
     // ✅ 类属性中直接使用
     private db = useService("database");

     async getData() {
       // ✅ 方法中直接访问（不需要 await useService）
       return await this.db.query("SELECT * FROM data");
     }
   }
   ```

### 错误处理

```typescript
try {
  const service = await useService("unknown-service");
} catch (error) {
  console.error(error);
  // Error: Service "unknown-service" not found.
  // Hint: Import the plugin that provides "unknown-service"...
}
```

### 总结

| 使用方式         | 适用场景      | 优点                 | 缺点               |
| ---------------- | ------------- | -------------------- | ------------------ |
| 先导入后使用     | 大多数情况    | 简单、快速、类型安全 | 需要明确顺序       |
| await useService | 动态/条件加载 | 灵活、自动等待       | 略慢、多一个 await |
| 类属性引用       | 服务间依赖    | 简洁、自动管理       | -                  |
