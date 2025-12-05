# 配置管理

Zhin Next 提供强大的配置管理系统，支持类型安全、环境变量、嵌套访问等特性。

## ConfigService

`ConfigService` 是内置的配置管理服务。

### 基本用法

```typescript
import { useService } from "zhin-next";

const config = useService("config");

// 获取配置
const logLevel = config.get("log_level");

// 设置配置
config.set("log_level", "debug");

// 检查配置是否存在
if (config.has("database.host")) {
  const host = config.get("database.host");
}

// 删除配置
config.delete("temp.key");
```

## 配置文件

### 文件格式

支持 YAML 格式的配置文件：

```yaml
# zhin.config.yml
log_level: info

adapters:
  - name: icqq
    bots:
      - self_id: 123456789
        password: ${QQ_PASSWORD}
        platform: 5

database:
  host: localhost
  port: 5432
  name: mydb
```

### 文件位置

默认查找配置文件：

1. `zhin.config.yml`
2. `config.yml`
3. `.zhinrc.yml`

可以通过环境变量 `ZHIN_CONFIG` 指定配置文件路径：

```bash
ZHIN_CONFIG=/path/to/config.yml pnpm dev
```

## 环境变量

### 基本语法

配置文件支持环境变量替换：

```yaml
# ${VAR} - 使用环境变量，不存在则保持原样
api_key: ${API_KEY}

# ${VAR:-default} - 使用环境变量，不存在则使用默认值
password: ${QQ_PASSWORD:-123456}

# ${VAR:default} - 同上
host: ${DB_HOST:localhost}
```

### 使用示例

```yaml
# config.yml
database:
  host: ${DB_HOST:-localhost}
  port: ${DB_PORT:-5432}
  username: ${DB_USER}
  password: ${DB_PASSWORD}

redis:
  url: ${REDIS_URL:-redis://localhost:6379}
```

```bash
# .env
DB_HOST=prod-db.example.com
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=secret123
```

```typescript
// 配置会自动替换环境变量
const config = useService("config");
console.log(config.get("database.host")); // 'prod-db.example.com'
console.log(config.get("redis.url")); // 'redis://localhost:6379'
```

## 嵌套配置访问

### 点号路径

使用点号访问嵌套配置：

```yaml
server:
  http:
    host: localhost
    port: 3000
  https:
    enabled: false
```

```typescript
config.get("server.http.host"); // 'localhost'
config.get("server.http.port"); // 3000
config.get("server.https.enabled"); // false
```

### 数组索引

支持数组索引访问：

```yaml
adapters:
  - name: icqq
    bots:
      - self_id: 123
  - name: terminal
    bots:
      - self_id: term
```

```typescript
config.get("adapters.0.name"); // 'icqq'
config.get("adapters.0.bots.0.self_id"); // 123
config.get("adapters.1.name"); // 'terminal'
```

### 获取完整对象

```typescript
// 获取整个配置对象
const allConfig = config.get();

// 获取某个节点的完整对象
const serverConfig = config.get("server");
// { http: { host: 'localhost', port: 3000 }, https: { enabled: false } }
```

## 类型安全

### 类型推导

ConfigService 支持基于路径的类型推导：

```yaml
# config.yml
log_level: info
port: 3000
enabled: true
```

```typescript
const level = config.get("log_level"); // string
const port = config.get("port"); // number
const enabled = config.get("enabled"); // boolean
```

### 自定义类型

定义配置类型接口：

```typescript
interface AppConfig {
  log_level: "debug" | "info" | "warn" | "error";
  port: number;
  database: {
    host: string;
    port: number;
    name: string;
  };
  adapters: Array<{
    name: string;
    bots: Array<{
      self_id: number | string;
      password?: string;
    }>;
  }>;
}

// 使用类型
const config = useService("config");
const dbHost = config.get("database.host"); // 自动推导为 string
const firstAdapter = config.get("adapters.0.name"); // string
```

## ConfigLoader

底层配置加载器，提供更细粒度的控制。

### 基本用法

```typescript
import { ConfigLoader } from "zhin-next";

const loader = new ConfigLoader<MyConfig>("./config.yml");

// 获取数据（自动替换环境变量）
const data = loader.data;

// 手动保存
loader.save();
```

### 多配置文件

```typescript
import { ConfigLoader } from "zhin-next";

const mainConfig = new ConfigLoader("./config.yml");
const secretsConfig = new ConfigLoader("./secrets.yml");

// 合并配置
const config = {
  ...mainConfig.data,
  secrets: secretsConfig.data,
};
```

### 配置缓存

ConfigLoader 支持配置缓存：

```typescript
// 首次加载会缓存
const loader1 = ConfigLoader.map.get("./config.yml");

// 再次加载会使用缓存
const loader2 = ConfigLoader.map.get("./config.yml");

console.log(loader1 === loader2); // true
```

## 配置监听

### watch()

监听配置变化：

```typescript
const config = useService("config");

// 监听所有配置变化
const unwatch = config.watch((key, value) => {
  console.log(`配置变化: ${key} = ${JSON.stringify(value)}`);
});

// 修改配置会触发回调
config.set("log_level", "debug");
// 输出: 配置变化: log_level = "debug"

// 停止监听
unwatch();
```

### 监听特定键

```typescript
config.watch((key, value) => {
  if (key === "log_level") {
    console.log("日志级别变化:", value);
  }
});
```

## 自动保存

配置修改会自动保存到文件：

```typescript
const config = useService("config");

// 修改配置
config.set("new_key", "value");

// 自动写入文件
// zhin.config.yml 会更新
```

## 配置验证

### 自定义验证

```typescript
class ValidatedConfigService extends ConfigService {
  set(key: string, value: any) {
    // 验证逻辑
    if (key === "port") {
      if (typeof value !== "number" || value < 1 || value > 65535) {
        throw new Error("端口必须是 1-65535 之间的数字");
      }
    }

    // 调用父类方法
    super.set(key, value);
  }
}
```

### 使用 Schema

```typescript
import Joi from "joi";

const configSchema = Joi.object({
  log_level: Joi.string().valid("debug", "info", "warn", "error"),
  port: Joi.number().min(1).max(65535),
  database: Joi.object({
    host: Joi.string().required(),
    port: Joi.number().required(),
    name: Joi.string().required(),
  }),
});

class ValidatedConfigService extends ConfigService {
  async start() {
    await super.start();

    // 验证配置
    const { error } = configSchema.validate(this.get());
    if (error) {
      throw new ConfigError(
        `配置验证失败: ${error.message}`,
        ErrorCode.CONFIG_INVALID_KEY
      );
    }
  }
}
```

## 最佳实践

### 1. 使用环境变量保护敏感信息

```yaml
# ✅ 好的做法
database:
  password: ${DB_PASSWORD}
  api_key: ${API_KEY}

# ❌ 不好的做法
database:
  password: mypassword123
  api_key: sk-xxx
```

### 2. 提供默认值

```yaml
# ✅ 提供合理的默认值
log_level: ${LOG_LEVEL:-info}
port: ${PORT:-3000}
```

### 3. 结构化配置

```yaml
# ✅ 清晰的结构
server:
  host: localhost
  port: 3000

database:
  host: localhost
  port: 5432

# ❌ 扁平化不利于管理
server_host: localhost
server_port: 3000
database_host: localhost
database_port: 5432
```

### 4. 配置文件分层

```typescript
// 开发环境: config.dev.yml
// 生产环境: config.prod.yml
// 本地配置: config.local.yml (不提交到 git)

const env = process.env.NODE_ENV || "dev";
const configFile = `./config.${env}.yml`;
const config = new ConfigLoader(configFile);
```

### 5. 类型定义

始终为配置定义类型：

```typescript
// config.types.ts
export interface AppConfig {
  log_level: "debug" | "info" | "warn" | "error";
  port: number;
  // ...
}

// 使用
const config = useService("config");
const level: AppConfig["log_level"] = config.get("log_level");
```

## 常见问题

### 配置不生效？

1. 检查文件路径是否正确
2. 确认 YAML 语法正确
3. 查看是否有环境变量覆盖

### 环境变量不替换？

```yaml
# ❌ 错误：需要完整包裹
password: prefix${VAR}suffix

# ✅ 正确
password: ${VAR}

# ✅ 或使用默认值
password: ${VAR:-default}
```

### 如何重载配置？

```typescript
// 方法1：重新加载文件
const loader = new ConfigLoader("./config.yml");
hooks.provide("config", new ConfigService(loader));

// 方法2：监听文件变化
import { watchFile } from "fs";

watchFile("./config.yml", () => {
  // 重新加载配置
  const newLoader = new ConfigLoader("./config.yml");
  hooks.provide("config", new ConfigService(newLoader));
});
```

## 下一步

- [服务系统](./service-system.md) - 了解配置服务的基础
- [错误处理](./error-handling.md) - 处理配置错误
- [环境配置](./deployment.md) - 生产环境配置
