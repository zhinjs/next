import { LogLevel } from "@zhin.js/logger";
import * as path from "node:path";
import * as process from "node:process";
import { fileURLToPath } from "node:url";
import type { Config } from "./types";

// ESM 专用
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const defaultConfig: Config = {
  log_level: LogLevel.INFO,
  plugin_dirs: [path.join(process.cwd(), "plugins")],
  plugins: [],
};
export const defaultConfigPath = path.join(process.cwd(), "zhin.config.yml");
export const builtinPluginsDir = path.join(__dirname, "plugins");
export const modulesPluginsDir = path.join(process.cwd(), "node_modules");
export const supportedPluginExtensions = [
  ".js",
  ".ts",
  ".mjs",
  ".cjs",
  ".jsx",
  ".tsx",
  "",
];
