# 贡献指南

感谢你对 Zhin Next 的关注！我们欢迎各种形式的贡献。

## 开始之前

在提交贡献之前，请：

1. 搜索现有的 [Issues](https://github.com/zhinjs/next/issues) 和 [Pull Requests](https://github.com/zhinjs/next/pulls)
2. 对于新功能，先创建 Issue 讨论
3. 对于 Bug 修复，可以直接提交 PR

## 开发环境

### 前置要求

- Node.js >= 18.0.0
- pnpm >= 9.0.0

### 克隆项目

```bash
git clone https://github.com/zhinjs/next.git
cd next
```

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

### 运行测试

```bash
# 运行所有测试
pnpm test

# 监听模式
pnpm test:watch

# 覆盖率报告
pnpm test:coverage

# 测试 UI
pnpm test:ui
```

### 代码检查

```bash
# TypeScript 类型检查
pnpm lint

# 代码格式化
pnpm format
```

### 构建

```bash
pnpm build
```

## 提交规范

### Commit Message

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 重构（既不是新功能也不是修复）
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关

#### Scope

- `hooks`: Hooks 系统
- `service`: 服务系统
- `config`: 配置管理
- `adapter`: 适配器
- `command`: 指令系统
- `middleware`: 中间件
- `error`: 错误处理
- `plugin`: 插件系统
- `test`: 测试
- `docs`: 文档
- `deps`: 依赖

#### 示例

```bash
feat(service): add Service base class with lifecycle

- Add Service abstract class
- Implement start() and stop() methods
- Add state protection with ensureInitialized()

Closes #123
```

```bash
fix(config): fix environment variable replacement

Fix regex pattern to support ${VAR:-default} syntax

Fixes #456
```

## Pull Request

### 创建 PR

1. Fork 项目
2. 创建特性分支：`git checkout -b feature/my-feature`
3. 提交更改：`git commit -m 'feat: add something'`
4. 推送分支：`git push origin feature/my-feature`
5. 创建 Pull Request

### PR 要求

- ✅ 所有测试通过
- ✅ 代码覆盖率不下降
- ✅ TypeScript 类型检查通过
- ✅ 代码格式化
- ✅ 更新相关文档
- ✅ 添加测试用例（新功能必须）

### PR 描述

```markdown
## 描述

简要描述此 PR 的目的

## 变更类型

- [ ] Bug 修复
- [ ] 新功能
- [ ] 重构
- [ ] 文档更新
- [ ] 性能优化

## 相关 Issue

Closes #123

## 变更内容

- 添加了 XXX 功能
- 修复了 XXX 问题
- 重构了 XXX 模块

## 测试

- [ ] 添加了单元测试
- [ ] 添加了集成测试
- [ ] 手动测试通过

## 文档

- [ ] 更新了 README
- [ ] 更新了 API 文档
- [ ] 添加了示例代码

## 截图（如适用）
```

## 代码规范

### TypeScript

```typescript
// ✅ 使用明确的类型
function greet(name: string): string {
  return `Hello, ${name}`;
}

// ❌ 避免使用 any
function process(data: any) {}

// ✅ 使用接口定义复杂类型
interface User {
  id: number;
  name: string;
}

// ✅ 使用泛型提高复用性
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}
```

### 命名规范

```typescript
// 类名：PascalCase
class UserService extends Service {}

// 接口：PascalCase
interface UserConfig {}

// 函数/变量：camelCase
const userName = "Alice";
function getUserById(id: number) {}

// 常量：UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;

// 私有属性：#prefix
class MyClass {
  #privateField = 0;
}
```

### 注释规范

```typescript
/**
 * 用户服务
 * 提供用户相关的业务逻辑
 */
class UserService extends Service {
  /**
   * 获取用户信息
   * @param id - 用户 ID
   * @returns 用户对象
   * @throws {UserNotFoundError} 用户不存在时抛出
   */
  async getUser(id: number): Promise<User> {
    // 实现
  }
}
```

## 测试规范

### 测试结构

```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("UserService", () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
  });

  describe("getUser", () => {
    it("should return user when exists", async () => {
      const user = await service.getUser(1);
      expect(user).toBeDefined();
      expect(user.id).toBe(1);
    });

    it("should throw error when not exists", async () => {
      await expect(service.getUser(999)).rejects.toThrow("User not found");
    });
  });
});
```

### 测试覆盖

- 所有公共方法都应该有测试
- 边界情况都应该覆盖
- 错误路径都应该测试
- 目标覆盖率 >= 80%

## 文档规范

### API 文档

对于公共 API，必须提供完整的文档：

````typescript
/**
 * 服务基类
 *
 * 提供统一的服务生命周期管理和状态保护。
 * 所有自定义服务都应该继承此类。
 *
 * @example
 * ```typescript
 * class MyService extends Service {
 *   readonly name = 'my-service';
 *
 *   async start() {
 *     await super.start();
 *     // 初始化逻辑
 *   }
 * }
 * ```
 */
export abstract class Service {
  // ...
}
````

### 用户文档

在 `docs/` 目录下添加或更新相关文档：

- 新功能需要添加使用说明
- API 变更需要更新文档
- 提供代码示例
- 说明注意事项

## 版本发布

版本发布由维护者负责，遵循语义化版本：

- **Major (x.0.0)** - 破坏性变更
- **Minor (0.x.0)** - 新功能（向后兼容）
- **Patch (0.0.x)** - Bug 修复（向后兼容）

## 行为准则

- 尊重所有贡献者
- 建设性地讨论问题
- 专注于代码质量
- 及时响应反馈
- 保持友好和专业

## 问题反馈

### Bug 报告

提交 Bug 时请包含：

- 问题描述
- 复现步骤
- 预期行为
- 实际行为
- 环境信息（Node 版本、OS 等）
- 相关代码或截图

### 功能请求

提交功能请求时请说明：

- 功能描述
- 使用场景
- 预期效果
- 可能的实现方案

## 获取帮助

- [GitHub Issues](https://github.com/zhinjs/next/issues) - 问题反馈
- [GitHub Discussions](https://github.com/zhinjs/next/discussions) - 讨论交流

## 致谢

感谢所有为 Zhin Next 做出贡献的开发者！

---

再次感谢你的贡献！ 🎉
