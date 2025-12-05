import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { readFileSync } from "fs";
import dts from "rollup-plugin-dts";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

// 外部依赖（不打包到输出中）
const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  "node:path",
  "node:fs",
  "node:url",
  "node:child_process",
  "node:crypto",
  "node:os",
  "node:process",
  "node:util",
  "node:events",
];

const input = {
  index: "src/index.ts",
  zhin: "src/zhin.ts",
  worker: "src/worker.ts",
  "plugins/config": "src/plugins/config.ts",
  "plugins/status": "src/plugins/status.ts",
  "adapters/icqq": "src/adapters/icqq.ts",
  "adapters/terminal": "src/adapters/terminal.ts",
};

export default [
  // ESM 构建
  {
    input,
    output: {
      dir: "lib",
      format: "esm",
      entryFileNames: "[name].js",
      sourcemap: true,
      preserveModules: true, // 保留模块结构
      preserveModulesRoot: "src", // 从 src 开始保留结构
    },
    external,
    plugins: [
      json(),
      resolve({
        preferBuiltins: true,
      }),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        declarationMap: false,
        sourceMap: true,
        outDir: "lib",
      }),
    ],
  },
  // 类型声明文件
  {
    input,
    output: {
      dir: "lib",
      format: "esm",
      entryFileNames: "[name].d.ts",
      preserveModules: true,
      preserveModulesRoot: "src",
    },
    external,
    plugins: [dts()],
  },
];
