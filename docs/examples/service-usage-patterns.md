# 服务使用模式大全

本文档展示了 Zhin Next 中服务系统的各种使用模式和最佳实践。

## 基础模式

### 1. 标准模式（推荐）

**适用场景**：大多数情况，明确的依赖关系

```typescript
// plugin-a.ts
import { useHooks } from "zhin-next";

const hooks = useHooks();

// 先导入依赖服务
await hooks.import("./plugin-database");

// 然后使用服务
const db = useService("database");
await db.connect();
```

**优点**：

- ✅ 清晰明确的依赖关系
- ✅ 立即可用，无需等待
- ✅ 最佳性能（无异步等待）

**缺点**：

- ❌ 需要手动管理导入顺序

---

### 2. 异步等待模式

**适用场景**：动态加载、条件加载、不确定导入顺序

```typescript
// plugin-b.ts
import { useHooks, useService } from "zhin-next";

const hooks = useHooks();

// 先获取服务引用（可能还未加载）
const db = useService("database");

// 稍后或条件性地导入
if (needDatabase) {
  await hooks.import("./plugin-database");
}

// 使用 await 等待服务可用
const database = await db;
await database.connect();
```

**优点**：

- ✅ 灵活的加载顺序
- ✅ 支持条件加载
- ✅ 适合动态场景

**缺点**：

- ❌ 需要额外的 await
- ❌ 略慢（等待微任务）

---

### 3. 服务类依赖模式

**适用场景**：服务间依赖、插件架构

```typescript
// database-service.ts
import { Service, useService } from "zhin-next";

class UserService extends Service {
  readonly name = "user";

  // 类属性中声明依赖（安全，惰性加载）
  private db = useService("database");
  private cache = useService("cache");

  async getUser(id: string) {
    // 运行时访问时才真正查找服务
    const cached = await this.cache.get(`user:${id}`);
    if (cached) return cached;

    const user = await this.db.query("SELECT * FROM users WHERE id = ?", [id]);
    await this.cache.set(`user:${id}`, JSON.stringify(user));

    return user;
  }
}

// 注册服务
const hooks = useHooks();
hooks.provide("user", new UserService());
```

**优点**：

- ✅ 代码简洁，依赖清晰
- ✅ 自动处理循环依赖
- ✅ 类型安全

**缺点**：

- ❌ 运行时错误（如果服务未提供）

---

## 高级模式

### 4. 并行加载模式

**适用场景**：需要同时加载多个服务

```typescript
async function loadAllServices() {
  const hooks = useHooks();

  // 1. 先获取所有服务引用
  const db = useService("database");
  const cache = useService("cache");
  const config = useService("config");

  // 2. 并行导入所有插件
  await Promise.all([
    hooks.import("./plugin-database"),
    hooks.import("./plugin-cache"),
    hooks.import("./plugin-config"),
  ]);

  // 3. 并行等待所有服务（使用 await）
  const [database, cacheService, configService] = await Promise.all([
    db,
    cache,
    config,
  ]);

  return { database, cacheService, configService };
}
```

**优点**：

- ✅ 最快的批量加载速度
- ✅ 充分利用并发

---

### 5. 条件依赖模式

**适用场景**：根据环境或配置加载不同服务

```typescript
async function setupServices(env: "dev" | "prod") {
  const hooks = useHooks();

  // 基础服务总是需要
  await hooks.import("./plugin-config");

  // 根据环境加载不同的数据库服务
  if (env === "dev") {
    await hooks.import("./plugin-sqlite"); // 提供 "database" 服务
  } else {
    await hooks.import("./plugin-postgres"); // 提供 "database" 服务
  }

  // 使用统一的接口
  const db = useService("database");
  await db.connect();
}
```

**优点**：

- ✅ 灵活的服务替换
- ✅ 统一的接口

---

### 6. 懒加载模式

**适用场景**：按需加载重量级服务

```typescript
class HeavyService extends Service {
  readonly name = "heavy";

  private aiModel?: AIModel;

  async start() {
    await super.start();
    // 不在这里加载 AI 模型
  }

  async loadModel() {
    if (!this.aiModel) {
      // 首次使用时才加载
      this.aiModel = await import("./ai-model");
    }
    return this.aiModel;
  }
}
```

**优点**：

- ✅ 减少启动时间
- ✅ 节省内存

---

### 7. 服务工厂模式

**适用场景**：需要创建多个服务实例

```typescript
class ConnectionPoolService extends Service {
  readonly name = "connection-pool";

  private config = useService("config");
  private pools = new Map<string, ConnectionPool>();

  async getPool(name: string) {
    if (!this.pools.has(name)) {
      const config = (await this.config).get(`pools.${name}`);
      const pool = new ConnectionPool(config);
      this.pools.set(name, pool);
    }
    return this.pools.get(name)!;
  }
}
```

---

### 8. 服务装饰模式

**适用场景**：增强现有服务功能

```typescript
class CachedDatabaseService extends Service {
  readonly name = "cached-database";

  private db = useService("database");
  private cache = useService("cache");

  async query(sql: string, params?: any[]) {
    const key = `query:${sql}:${JSON.stringify(params)}`;

    // 先查缓存
    const cached = await (await this.cache).get(key);
    if (cached) return JSON.parse(cached);

    // 缓存未命中，查询数据库
    const result = await (await this.db).query(sql, params);

    // 缓存结果
    await (await this.cache).set(key, JSON.stringify(result));

    return result;
  }
}
```

---

## 最佳实践总结

### ✅ 推荐做法

1. **优先使用标准模式**

   ```typescript
   await hooks.import("./services");
   const service = useService("service");
   ```

2. **在服务类中使用类属性依赖**

   ```typescript
   class MyService extends Service {
     private dep = useService("dependency");
   }
   ```

3. **使用 TypeScript 类型定义**

   ```typescript
   declare module "zhin-next" {
     namespace Hooks {
       interface Services {
         myService: MyService;
       }
     }
   }
   ```

4. **在 start() 中只做初始化**

   ```typescript
   async start() {
     await super.start();
     await this.connect();  // 自己的初始化
   }
   ```

5. **在 onMounted() 中进行跨服务调用**
   ```typescript
   hooks.onMounted(async () => {
     const user = useService("user");
     await user.initialize();
   });
   ```

---

### ❌ 避免做法

1. **不要在模块顶层立即访问服务属性**

   ```typescript
   // ❌ 错误
   const db = useService("database");
   const version = db.version; // 立即访问

   // ✅ 正确
   const db = useService("database");
   async function init() {
     const version = db.version; // 延迟访问
   }
   ```

2. **不要在 start() 中调用其他服务的业务方法**

   ```typescript
   // ❌ 错误
   async start() {
     const db = useService("database");
     await db.query("...");  // 可能导致循环依赖
   }

   // ✅ 正确
   async start() {
     await super.start();
     await this.connect();  // 只初始化自己
   }
   ```

3. **不要过度使用 await useService()**

   ```typescript
   // ❌ 不必要
   await hooks.import("./plugin");
   const service = await useService("service"); // await 多余

   // ✅ 更好
   await hooks.import("./plugin");
   const service = useService("service");
   ```

4. **不要创建循环调用**
   ```typescript
   // ❌ 死循环
   class A extends Service {
     private b = useService("b");
     async start() {
       await (await this.b).start(); // B.start 又调用 A.start
     }
   }
   ```

---

## 性能对比

| 模式       | 性能       | 适用场景   |
| ---------- | ---------- | ---------- |
| 标准模式   | ⭐⭐⭐⭐⭐ | 大多数情况 |
| 异步等待   | ⭐⭐⭐⭐   | 动态加载   |
| 类属性依赖 | ⭐⭐⭐⭐⭐ | 服务间依赖 |
| 并行加载   | ⭐⭐⭐⭐⭐ | 批量加载   |
| 懒加载     | ⭐⭐⭐⭐⭐ | 重量级服务 |

---

## 调试技巧

### 1. 检查服务是否已注册

```typescript
const hooks = useHooks();
const service = hooks.inject("service-name");
if (service === undefined) {
  console.error("Service not found!");
}
```

### 2. 列出所有已注册服务

```typescript
// 在 Hooks 类中添加辅助方法
class Hooks {
  listServices() {
    return Array.from(this.#services.keys());
  }
}

// 使用
console.log(hooks.listServices());
```

### 3. 追踪服务加载顺序

```typescript
const originalProvide = hooks.provide;
hooks.provide = function (name, value) {
  console.log(`[Service] Providing "${name}"`, new Error().stack);
  return originalProvide.call(this, name, value);
};
```

---

## 总结

选择合适的服务使用模式取决于你的具体场景：

- **简单项目** → 标准模式
- **复杂依赖** → 类属性依赖模式
- **动态加载** → 异步等待模式
- **高性能** → 并行加载模式

记住核心原则：**先导入，后使用；在类中声明依赖；延迟访问属性**。
