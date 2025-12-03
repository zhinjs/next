import process from "node:process";
import {setLevel, LogLevel} from '@zhin.js/logger'
import {TerminalAdapter} from './plugins/adapter-terminal'
import {resolveEntry} from "./utils";
import {useConfig} from "./config";
import {
  defaultOptions,
  builtinPluginsDir,
  modulesPluginsDir,
} from "./constanse";
import {usePlugin, Plugin} from "./plugin";

const plugin = usePlugin();
const config = useConfig('zhin.config', defaultOptions);
const pluginDirs = [
  ...(config.plugin_dirs || []),
  builtinPluginsDir,
  modulesPluginsDir,
];
setLevel(config.log_level || LogLevel.INFO);

for (const pluginName of config.plugins || []) {
  const entry = resolveEntry(pluginName, pluginDirs);
  await plugin.import(entry);
}

plugin.logger.info(`${plugin.children.length} plugins loaded`);
plugin.logger.info(`${plugin.accounts.length} accounts started`);
plugin.adapter(new TerminalAdapter([{ title: 'Local Terminal' }]));
if(process.env.NODE_ENV !== 'production'){
    plugin.logger.info('enabling hot reload for plugins')
    Plugin.watchAll(plugin)
}
await plugin.start()