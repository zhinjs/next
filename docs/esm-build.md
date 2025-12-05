# Zhin Next - ESM 模块支持

## 📦 构建系统

本项目使用 **Rollup** 作为构建工具，专注于 **ESM (ECMAScript Modules)** 模块格式。

## 🏗️ 构建输出

```
lib/
├── index.js          # 主入口
├── index.d.ts        # TypeScript 类型声明
├── zhin.js           # Zhin 类
├── worker.js         # Worker 进程
├── plugins/          # 内置插件
│   ├── config.js     # 配置插件
│   ├── config.d.ts
│   ├── status.js     # 状态插件
│   └── status.d.ts
└── chunks/           # 共享代码块
    └── *.js
```

## 📥 使用方式

### ESM Import

```javascript
// 使用命名导入
import { createZhin, Hooks, useService } from "zhin-next";

// 使用子路径导入
import { Zhin } from "zhin-next/zhin";
import { ConfigService } from "zhin-next/plugins/config";
```

### TypeScript

```typescript
import { createZhin, Hooks, type Config } from "zhin-next";

const zhin = createZhin("./config.yml");
await zhin.start();
```

## 🔧 Package.json 配置

```json
{
  "type": "module", // 标记为 ESM 包
  "main": "lib/index.js", // 主入口
  "types": "lib/index.d.ts", // TypeScript 类型
  "exports": {
    ".": {
      "types": "./lib/index.d.ts",
      "default": "./lib/index.js"
    },
    "./zhin": "./lib/zhin.js",
    "./worker": "./lib/worker.js",
    "./plugins/*": "./lib/plugins/*.js"
  }
}
```

## ⚡ 特性

### Top-level Await

ESM 原生支持 top-level await，无需额外配置：

```typescript
// worker.ts
await plugin.import("./plugins/config");
await plugin.start();
```

### 内置模块处理

Node.js 内置模块被标记为外部依赖，不会打包到输出中：

```javascript
const external = [
  "node:path",
  "node:fs",
  "node:url",
  "node:child_process",
  "node:crypto",
  // ...
];
```

### Tree-shaking

Rollup 自动优化代码，移除未使用的导出，减小包体积。

### 代码分割

共享代码自动提取到 `chunks/` 目录，避免重复打包。

## 🚀 构建命令

```bash
# 清理输出目录
pnpm clean

# 运行 Rollup 构建
pnpm compile

# 完整构建（清理 + 编译）
pnpm build
```

## 📊 构建性能

- **ESM 构建**: ~1s
- **类型声明**: ~1s
- **总计**: ~2s

构建速度比原来的 tsc 快约 **30%**。

## ✅ 优势

1. **🚀 现代化**: 使用最新的 ESM 标准
2. **⚡ 性能优化**: Rollup 自动优化输出代码
3. **🌲 Tree-shaking**: 自动移除未使用的代码
4. **📦 代码分割**: 智能提取共享代码
5. **🔒 类型安全**: 完整的 TypeScript 类型声明
6. **⏱️ 快速构建**: 构建速度提升 30%
7. **📉 更小体积**: 优化后的代码体积更小

## 🎯 与 TypeScript 对比

### 之前 (tsc)

```bash
npm run compile  # tsc
# - 构建时间: ~3s
# - 输出: 未优化的 JS
# - 功能: ESM + 类型
```

### 现在 (Rollup)

```bash
npm run compile  # rollup -c
# - 构建时间: ~2s (快 30%)
# - 输出: 优化的 ESM 代码 + 代码分割
# - 功能: ESM + 类型 + Tree-shaking + 代码分割
```

## 🔧 Rollup 配置

### 入口文件

```javascript
const input = {
  index: "src/index.ts",
  zhin: "src/zhin.ts",
  worker: "src/worker.ts",
  "plugins/config": "src/plugins/config.ts",
  "plugins/status": "src/plugins/status.ts",
};
```

### 外部依赖

```javascript
const external = [
  ...Object.keys(pkg.dependencies || {}),
  "node:path",
  "node:fs",
  "node:url",
  // ...
];
```

### 插件配置

```javascript
plugins: [
  json(), // JSON 导入支持
  resolve({
    // 模块解析
    preferBuiltins: true,
  }),
  commonjs(), // CJS 转 ESM
  typescript({
    // TypeScript 编译
    tsconfig: "./tsconfig.json",
    sourceMap: true,
  }),
];
```

## 📝 相关文件

- `rollup.config.js` - Rollup 配置文件
- `tsconfig.json` - TypeScript 配置
- `package.json` - Package 配置 (exports 字段)

## 🌟 最佳实践

### 1. 使用命名导出

```typescript
// ✅ 推荐
export { createZhin, Hooks };

// ❌ 避免
export default createZhin;
```

### 2. 使用 node: 协议

```typescript
// ✅ 推荐
import path from "node:path";

// ❌ 避免
import path from "path";
```

### 3. 使用 .js 扩展名

```typescript
// ✅ 推荐
import { utils } from "./utils.js";

// ❌ 避免（但 TypeScript 编译时会自动处理）
import { utils } from "./utils";
```

## 🔄 迁移指南

### 从 tsc 迁移

1. **安装 Rollup 依赖**

   ```bash
   pnpm add -D rollup @rollup/plugin-typescript @rollup/plugin-node-resolve @rollup/plugin-commonjs @rollup/plugin-json rollup-plugin-dts tslib
   ```

2. **创建 rollup.config.js**

3. **更新 package.json**

   ```json
   {
     "scripts": {
       "compile": "rollup -c"
     }
   }
   ```

4. **测试构建**
   ```bash
   pnpm build
   ```

### 用户代码无需修改

```typescript
// 导入方式保持不变
import { createZhin } from "zhin-next";
```
