import * as process from "node:process";
import * as path from "node:path";
import {LogLevel} from '@zhin.js/logger'
import type { Options } from "./types";

export const defaultOptions: Options = {
  log_level: LogLevel.INFO,
  plugin_dirs: [path.join(process.cwd(), "plugins")],
  plugins: [],
};
export const defaultOptionsPath = path.join(process.cwd(), "zhin.config.yml");
export const builtinPluginsDir = path.join(import.meta.dirname, "plugins");
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
