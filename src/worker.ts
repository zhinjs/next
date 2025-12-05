import { LogLevel, setLevel } from "@zhin.js/logger";
import process from "node:process";
import { TerminalAdapter } from "./adapters/terminal";
import {
  builtinPluginsDir,
  defaultConfig,
  modulesPluginsDir,
} from "./constanse";
import { useHooks, useService } from "./hooks";
import { Config } from "./types";
import { resolveEntry } from "./utils";

const plugin = useHooks();
// 1. 加载配置服务插件
await plugin.import("./plugins/config");
// 2. 加载配置
const configService = useService("config");
configService.load("zhin.config", defaultConfig);
const config = configService.get<Config>();
const pluginDirs = [
  ...(config.plugin_dirs || []),
  builtinPluginsDir,
  modulesPluginsDir,
];
// 3. 基于配置启动 Zhin
// 设置日志等级
setLevel(config.log_level || LogLevel.INFO);
// 加载插件
for (const pluginName of config.plugins || []) {
  const entry = resolveEntry(pluginName, pluginDirs);
  await plugin.import(entry);
}
plugin.logger.info(`${plugin.children.length} plugins loaded`);
// 判断当前环境是否需要启用热重载
if (process.env.NODE_ENV !== "production") {
  plugin.logger.info("enabling hot reload for plugins");
  plugin.watch((p) => p.reload(), true);
}
// 加载内置适配器
plugin.adapter(TerminalAdapter, [{ title: "terminal-bot" }]);
// 启动插件
await plugin.start();
plugin.logger.info(`${plugin.accounts.length} accounts started`);
