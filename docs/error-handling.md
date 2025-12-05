# 错误处理

Zhin Next 提供完整的错误处理体系，包括错误分类、错误管理和最佳实践。

## 错误类型

### ZhinError

框架的基础错误类，所有自定义错误都继承自它：

```typescript
import { ZhinError } from "zhin-next";

throw new ZhinError("操作失败", "OPERATION_FAILED", {
  userId: 123,
  action: "delete",
});
```

**属性：**

- `message` - 错误描述
- `code` - 错误代码
- `details` - 附加信息
- `stack` - 调用堆栈

### 专用错误类

框架提供多种专用错误类：

#### AdapterError

适配器相关错误：

```typescript
import { AdapterError, ErrorCode } from "zhin-next";

throw new AdapterError("适配器未找到", ErrorCode.ADAPTER_NOT_FOUND, {
  adapterName: "unknown",
});
```

#### PluginError

插件相关错误：

```typescript
import { PluginError, ErrorCode } from "zhin-next";

throw new PluginError("插件加载失败", ErrorCode.PLUGIN_LOAD_FAILED, {
  pluginPath: "./plugin.ts",
  reason: "syntax error",
});
```

#### ConfigError

配置相关错误：

```typescript
import { ConfigError, ErrorCode } from "zhin-next";

throw new ConfigError("配置键无效", ErrorCode.CONFIG_INVALID_KEY, {
  key: "invalid.path",
});
```

#### AccountError

账号相关错误：

```typescript
import { AccountError, ErrorCode } from "zhin-next";

throw new AccountError("账号启动失败", ErrorCode.ACCOUNT_START_FAILED, {
  accountId: "123456",
});
```

#### MiddlewareError

中间件相关错误：

```typescript
import { MiddlewareError, ErrorCode } from "zhin-next";

throw new MiddlewareError(
  "next() 被多次调用",
  ErrorCode.MIDDLEWARE_NEXT_CALLED_MULTIPLE
);
```

## 错误代码

使用 `ErrorCode` 常量确保一致性：

```typescript
import { ErrorCode } from "zhin-next";

// 适配器错误
ErrorCode.ADAPTER_NOT_BOUND;
ErrorCode.ADAPTER_NOT_FOUND;
ErrorCode.ADAPTER_ALREADY_EXISTS;
ErrorCode.ACCOUNT_NOT_FOUND;
ErrorCode.ACCOUNT_START_FAILED;
ErrorCode.ACCOUNT_STOP_FAILED;

// 插件错误
ErrorCode.PLUGIN_NOT_FOUND;
ErrorCode.PLUGIN_LOAD_FAILED;
ErrorCode.PLUGIN_ALREADY_LOADED;
ErrorCode.PLUGIN_IMPORT_FAILED;

// 配置错误
ErrorCode.CONFIG_INVALID_KEY;
ErrorCode.CONFIG_LOAD_FAILED;
ErrorCode.CONFIG_SAVE_FAILED;
ErrorCode.CONFIG_PARSE_FAILED;

// 中间件错误
ErrorCode.MIDDLEWARE_NEXT_CALLED_MULTIPLE;
ErrorCode.MIDDLEWARE_EXECUTION_FAILED;

// 通用错误
ErrorCode.INVALID_ARGUMENT;
ErrorCode.OPERATION_FAILED;
ErrorCode.NOT_IMPLEMENTED;
```

## ErrorManager

全局错误处理器管理。

### 注册错误处理器

```typescript
import { ErrorManager } from "zhin-next";

// 注册处理器
const unregister = ErrorManager.onError((error, context) => {
  console.error("捕获到错误:", error.message);
  console.error("上下文:", context);

  // 发送到日志服务
  logger.error(error);

  // 发送到监控系统
  monitor.captureException(error);
});

// 取消注册
unregister();
```

### 错误上下文

```typescript
ErrorManager.handle(error, {
  source: "plugin-manager",
  operation: "load-plugin",
  metadata: {
    pluginPath: "./plugins/my-plugin.ts",
    timestamp: Date.now(),
  },
});
```

### 包装函数

#### wrap() - 异步函数

```typescript
const safeAsyncFunction = ErrorManager.wrap(
  async (id: string) => {
    // 可能抛出错误的代码
    return await fetchUser(id);
  },
  { source: "user-service", operation: "fetch-user" }
);

// 错误会自动被 ErrorManager 处理
await safeAsyncFunction("123");
```

#### wrapSync() - 同步函数

```typescript
const safeFunction = ErrorManager.wrapSync(
  (id: string) => {
    // 可能抛出错误的代码
    return parseId(id);
  },
  { source: "parser", operation: "parse-id" }
);

// 错误会自动被 ErrorManager 处理
safeFunction("abc");
```

## 错误处理模式

### Try-Catch

基础的错误处理：

```typescript
try {
  await dangerousOperation();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error("配置错误:", error.message);
  } else if (error instanceof PluginError) {
    console.error("插件错误:", error.message);
  } else {
    console.error("未知错误:", error);
  }
}
```

### 中间件错误处理

```typescript
hooks.middleware(async (event, next) => {
  try {
    await next();
  } catch (error) {
    console.error("中间件错误:", error);

    // 回复用户
    event.reply("抱歉，处理消息时出错了");

    // 不要继续传播
  }
});
```

### 指令错误处理

```typescript
hooks.command("risky").action(async (event) => {
  try {
    const result = await riskyOperation();
    event.reply(`结果: ${result}`);
  } catch (error) {
    if (error instanceof ZhinError) {
      event.reply(`操作失败: ${error.message}`);
    } else {
      event.reply("发生未知错误");
    }
  }
});
```

### 服务错误处理

```typescript
class MyService extends Service {
  readonly name = "my-service";

  async start() {
    try {
      await super.start();
      await this.initialize();
    } catch (error) {
      // 记录错误
      console.error(`服务启动失败:`, error);

      // 清理部分初始化的资源
      await this.cleanup();

      // 重新抛出
      throw new Error(`${this.name} 启动失败: ${error.message}`);
    }
  }

  async doSomething() {
    this.ensureInitialized(); // 自动抛出错误

    try {
      // 业务逻辑
    } catch (error) {
      ErrorManager.handle(error, {
        source: this.name,
        operation: "doSomething",
      });
      throw error;
    }
  }
}
```

## 工具函数

### isZhinError()

判断是否为框架错误：

```typescript
import { isZhinError } from "zhin-next";

try {
  // ...
} catch (error) {
  if (isZhinError(error)) {
    console.log("框架错误:", error.code);
    console.log("详情:", error.details);
  } else {
    console.log("其他错误:", error);
  }
}
```

### formatError()

格式化错误信息：

```typescript
import { formatError } from "zhin-next";

try {
  // ...
} catch (error) {
  const formatted = formatError(error);
  console.error(formatted);
  // 输出: [ConfigError] [CONFIG_INVALID_KEY] 配置键无效 { "key": "invalid.path" }
}
```

### createError()

创建错误实例：

```typescript
import { createError, ConfigError, ErrorCode } from "zhin-next";

const error = createError(
  ConfigError,
  ErrorCode.CONFIG_INVALID_KEY,
  "配置键无效",
  { key: "test.invalid" }
);

throw error;
```

## 最佳实践

### 1. 使用专用错误类

```typescript
// ✅ 好的做法
throw new ConfigError("配置无效", ErrorCode.CONFIG_INVALID_KEY);

// ❌ 不好的做法
throw new Error("配置无效");
```

### 2. 提供错误上下文

```typescript
// ✅ 提供详细上下文
throw new PluginError("插件加载失败", ErrorCode.PLUGIN_LOAD_FAILED, {
  pluginPath: path,
  error: originalError.message,
  timestamp: Date.now(),
});

// ❌ 缺少上下文
throw new PluginError("加载失败", ErrorCode.PLUGIN_LOAD_FAILED);
```

### 3. 不要吞掉错误

```typescript
// ✅ 记录并重新抛出
try {
  await operation();
} catch (error) {
  console.error("操作失败:", error);
  throw error; // 重新抛出
}

// ❌ 吞掉错误
try {
  await operation();
} catch (error) {
  // 什么都不做
}
```

### 4. 在服务边界处理错误

```typescript
// ✅ 在服务边界处理
class MyService extends Service {
  async doSomething() {
    try {
      // 内部实现
    } catch (error) {
      // 转换为服务特定错误
      throw new Error(`${this.name} 操作失败: ${error.message}`);
    }
  }
}

// 调用方
try {
  await service.doSomething();
} catch (error) {
  // 处理服务错误
}
```

### 5. 使用 ErrorManager

```typescript
// ✅ 全局错误处理
ErrorManager.onError((error, context) => {
  // 统一处理所有错误
  logger.error(error, context);
  monitor.captureException(error);
});

// 在关键位置触发
try {
  // ...
} catch (error) {
  await ErrorManager.handle(error, { source: "critical-operation" });
  throw error;
}
```

## 常见错误场景

### 配置错误

```typescript
try {
  const value = config.get("invalid.path");
} catch (error) {
  if (error instanceof ConfigError) {
    switch (error.code) {
      case ErrorCode.CONFIG_INVALID_KEY:
        console.error("配置键不存在");
        break;
      case ErrorCode.CONFIG_PARSE_FAILED:
        console.error("配置文件格式错误");
        break;
    }
  }
}
```

### 适配器错误

```typescript
try {
  await hooks.start();
} catch (error) {
  if (error instanceof AdapterError) {
    console.error("适配器启动失败:", error.details);
    // 尝试恢复或降级
  }
}
```

### 插件错误

```typescript
try {
  await hooks.plugin("./plugins/my-plugin.ts");
} catch (error) {
  if (error instanceof PluginError) {
    console.error("插件加载失败:", error.message);
    // 继续运行，但禁用该插件
  }
}
```

### 中间件错误

```typescript
hooks.middleware(async (event, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof MiddlewareError) {
      console.error("中间件错误:", error.code);
    }
    // 阻止错误传播
  }
});
```

## 调试技巧

### 启用详细日志

```typescript
ErrorManager.onError((error, context) => {
  console.error("=== 错误详情 ===");
  console.error("消息:", error.message);
  console.error("代码:", error.code);
  console.error("详情:", error.details);
  console.error("上下文:", context);
  console.error("堆栈:", error.stack);
});
```

### 错误统计

```typescript
const errorStats = new Map<string, number>();

ErrorManager.onError((error) => {
  if (isZhinError(error)) {
    const count = errorStats.get(error.code) || 0;
    errorStats.set(error.code, count + 1);
  }
});

// 定期输出统计
setInterval(() => {
  console.log("错误统计:", Object.fromEntries(errorStats));
}, 60000);
```

### 错误报警

```typescript
ErrorManager.onError(async (error, context) => {
  // 严重错误发送报警
  if (error.code === ErrorCode.ACCOUNT_START_FAILED) {
    await sendAlert({
      level: "critical",
      message: error.message,
      details: error.details,
    });
  }
});
```

## 下一步

- [服务系统](./service-system.md) - 服务中的错误处理
- [配置管理](./configuration.md) - 配置错误处理
- [测试](./testing.md) - 错误场景测试
