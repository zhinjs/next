# 快速开始

本指南将帮助你快速上手 Zhin Next 框架。

## 前置要求

- Node.js >= 18.0.0
- 包管理器：npm、pnpm 或 yarn

## 安装

```bash
pnpm add zhin-next
```

## 创建项目

### 1. 初始化项目

```bash
mkdir my-bot
cd my-bot
pnpm init
pnpm add zhin-next
```

### 2. 创建配置文件

创建 `zhin.config.yml`：

```yaml
log_level: info

adapters:
  - name: terminal
    bots:
      - self_id: terminal
```

### 3. 创建入口文件

创建 `index.ts`：

```typescript
import { useHooks } from "zhin-next";

const bot = useHooks();

// 注册一个简单的指令
bot.command("hello <name>").action((event, args) => {
  event.reply(`你好，${args.name}！`);
});

// 启动机器人
await bot.start();
```

**提示：** `bot.start()` 会自动启动所有已注册的服务（如配置服务）和适配器。

### 4. 添加启动脚本

在 `package.json` 中添加：

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

### 5. 运行

```bash
pnpm dev
```

在终端中输入 `hello World`，机器人会回复 `你好，World！`

## 下一步

- [核心概念](./core-concepts.md) - 了解框架的核心概念
- [服务系统](./service-system.md) - 学习如何创建和使用服务
- [指令系统](./command-system.md) - 掌握强大的指令功能
- [配置管理](./configuration.md) - 深入了解配置系统
