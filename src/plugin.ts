import { EventEmitter } from "events";
import logger, { Logger } from "@zhin.js/logger";
import { AsyncLocalStorage } from "async_hooks";
import { watchFile, getFileHash } from "./utils";
import * as fs from "fs/promises";
import { MessageEvent } from "./event";
import { RequestEvent } from "./event";
import { Directive } from "@zhinjs/directive";
import { Account } from "./account";
import { Adapter } from "./adapter";
import path from "path";
import { Args, Key } from "./types";

export const storage = new AsyncLocalStorage<Plugin>();
export function usePlugin() {
  const plugin = storage.getStore();
  if (plugin) return plugin;
  const newPlugin = new Plugin();
  storage.enterWith(newPlugin);
  return newPlugin;
}
export class Plugin extends EventEmitter<Plugin.Lifecycle> {
  // 缓存优化
  #cachedAdapters?: Map<string, Adapter>;
  #cachedAccounts?: Account[];
  #cachedName?: string;
  #adaptersDirty = true;
  #accountsDirty = true;
  #isStarted = false;
  get adapters() {
    if (!this.#adaptersDirty && this.#cachedAdapters)
      return this.#cachedAdapters;
    const result = new Map(this.#adapters);
    for (const child of this.children) {
      for (const [key, value] of child.adapters) {
        result.set(key, value);
      }
    }
    this.#cachedAdapters = result;
    this.#adaptersDirty = false;
    return result;
  }
  children: Plugin[] = [];
  get root(): Plugin {
    if (!this.parent) return this;
    return this.parent.root;
  }
  get accounts() {
    if (!this.#accountsDirty && this.#cachedAccounts)
      return this.#cachedAccounts;
    const result: Account[] = [];
    for (const adapter of this.adapters.values()) {
      for (const account of adapter.accounts.values()) {
        result.push(account);
      }
    }
    this.#cachedAccounts = result;
    this.#accountsDirty = false;
    return result;
  }
  #adapters: Map<string, Adapter> = new Map<string, Adapter>();
  logger: Logger;
  #middleware: Plugin.Middleware[] = [];
  #composedMiddleware?: Plugin.Compose;
  get middlewares() {
    return this.children.reduce(
      (result: Plugin.Middleware[], plugin: Plugin): Plugin.Middleware[] => {
        return result.concat(plugin.middlewares);
      },
      this.#middleware
    );
  }
  #directives: Directive<[MessageEvent]>[] = [];
  get directives() {
    return this.children.reduce(
      (
        result: Directive<[MessageEvent]>[],
        plugin: Plugin
      ): Directive<[MessageEvent]>[] => {
        return result.concat(plugin.directives);
      },
      this.#directives
    );
  }
  async import(entry: string) {
    const plugin = await Plugin.create(
      path.resolve(path.dirname(this.filePath), entry),
      this
    );
    this.#adaptersDirty = true;
    this.#accountsDirty = true;
    return plugin;
  }
  filePath: string;
  fileHash: string = "";
  remove(name: string) {
    const index = this.children.findIndex((p) => p.name === name);
    if (index === -1) throw new Error(`Plugin "${name}" not found`);
    const [plugin] = this.children.splice(index, 1);
    plugin.stop();
    this.#adaptersDirty = true;
    this.#accountsDirty = true;
    return plugin;
  }
  async start(){
    if (this.#isStarted) return;
    this.#isStarted = true;
    for(const adapter of this.adapters.values()){
      await adapter.start();
    }
    return await this.broadcast("mounted");
  }
  adapter<K extends keyof Plugin.Adapters>(adapter: Plugin.Adapters[K]): this {
    this.#adapters.set(adapter.name, adapter);
    this.#adaptersDirty = true;
    this.#accountsDirty = true;
    this.logger.info(`Adapter "${adapter.name}" registered`);
    return this;
  }
  async dispatch<K>(
    name: Key<K, Plugin.Lifecycle>,
    ...args: Args<K, Plugin.Lifecycle>
  ): Promise<void> {
    if (this.parent) return this.parent.dispatch(name, ...args);
    return this.broadcast(name, ...args);
  }
  async broadcast<K>(
    name: Key<K, Plugin.Lifecycle>,
    ...args: Args<K, Plugin.Lifecycle>
  ): Promise<void> {
    const listeners = this.listeners(name);
    for (const listener of listeners) {
      await listener(...args);
    }
    for (const child of this.children) {
      await child.broadcast(name, ...args);
    }
  }
  get name(): string {
    if (this.#cachedName) return this.#cachedName;
    this.#cachedName = path
      .relative(process.cwd(), this.filePath)
      .replace(/\?t=\d+$/, "")
      .replace(/\\/g, "/")
      .replace(/\/index\.(js|ts)x?$/, "")
      .replace(/\/(lib|src|dist)$/, "")
      .replace(/.*\/node_modules\//, "")
      .replace(/.*\//, "")
      .replace(/\.(js|ts)x?$/, "");
    return this.#cachedName;
  }
  constructor(filePath: string = "", public parent?: Plugin) {
    super();
    this.filePath = filePath.replace(/\?t=\d+$/, "");
    this.logger = this.name ? logger.getLogger(this.name) : logger;
    this.middleware(async (event, next) => {
      await next();
      for (const directive of this.#directives) {
        const result = await directive.match(event.data, event);
        if (result) event.reply(result);
      }
    });
    this.on("message", (event: MessageEvent) => {
      if (!this.#composedMiddleware) {
        this.#composedMiddleware = Plugin.compose(this.#middleware);
      }
      this.#composedMiddleware(event);
    });
  }
  directive(name: string, result: string): this;
  directive(name: string, handle: Directive.Callback<[MessageEvent]>): this;
  directive(directive: Directive<[MessageEvent]>): this;
  directive(
    ...[input, handle]:
      | [Directive<[MessageEvent]>]
      | [string, string | Directive.Callback<[MessageEvent]>]
  ) {
    const directive =
      typeof input === "string" ? new Directive<[MessageEvent]>(input) : input;
    if (handle)
      directive.handle(typeof handle === "string" ? () => handle : handle);
    this.directives.push(directive);
    this.logger.info(`Directive "${directive.name}" added`);
    return this;
  }
  middleware(middleware: Plugin.Middleware) {
    this.middlewares.push(middleware);
    // 清除缓存，下次使用时重新编译
    this.#composedMiddleware = undefined;
    return this;
  }
  async reload(plugin: Plugin) {
    if (!plugin.parent) return process.exit(51);
    plugin.stop();
    plugin.parent.remove(plugin.name);
    await plugin.parent.import(plugin.filePath);
    await plugin.broadcast("mounted");
    this.logger.info(`Plugin "${plugin.name}" reloaded`);
  }
  watch() {
    if (!this.filePath || this.filePath.includes("node_modules")) return;
    const unwatch = watchFile(this.filePath, async () => {
      const newHash = getFileHash(this.filePath);
      if (newHash === this.fileHash) return;
      this.logger.info(`Plugin "${this.name}" file changed, reloading...`);
      await this.reload(this);
    });
    this.on("dispose", unwatch);
  }
  stop() {
    if(!this.#isStarted) return;
    this.#isStarted = false;
    this.emit("dispose");
    for(const adapter of this.adapters.values()){
      adapter.stop();
    }
    // 清理事件监听器
    this.removeAllListeners();
    // 清理子插件
    for (const child of this.children) {
      child.stop();
    }
    this.children = [];
    // 清理适配器
    this.#adapters.clear();
    // 清理中间件和指令
    this.#middleware = [];
    this.#directives = [];
    this.#composedMiddleware = undefined;
    // 清理缓存
    this.#cachedAdapters = undefined;
    this.#cachedAccounts = undefined;
    this.#cachedName = undefined;
  }
}
export namespace Plugin {
  export function watchAll(plugin: Plugin) {
    plugin.watch();
    for (const child of plugin.children) {
      watchAll(child);
    }
  }
  export async function create(
    entry: string,
    parent?: Plugin
  ): Promise<Plugin> {
    let entryPath = path.isAbsolute(entry)
      ? entry
      : path.join(path.dirname(import.meta.filename), entry);
    const isExist = await fs
      .access(entryPath)
      .then(() => true)
      .catch(() => false);
    if (!isExist) throw new Error(`Plugin entry file "${entry}" not found`);
    const stat = await fs.stat(entryPath);
    if (stat.isSymbolicLink()) entryPath = await fs.realpath(entryPath);
    const plugin = new Plugin(entryPath, parent);
    plugin.fileHash = getFileHash(entryPath);
    await storage.run(plugin, async () => {
      return await import(`${import.meta.resolve(entryPath)}?t=${Date.now()}`);
    });
    parent?.children.push(plugin);
    return plugin;
  }
  export interface Adapters {}
  export interface Bots {}
  export type LogLevel =
    | "trace"
    | "debug"
    | "info"
    | "warn"
    | "error"
    | "fatal"
    | "mark"
    | "off";
  export function compose(middlewares: Middleware[]): Compose {
    const length = middlewares.length;
    if (length === 0) return () => {};
    if (length === 1) return (message) => middlewares[0](message, () => {});

    return (message) => {
      let index = -1;
      const dispatch = (i: number): void => {
        if (i <= index) throw new Error("next() called multiple times");
        index = i;
        if (i >= length) return;
        middlewares[i](message, () => dispatch(i + 1));
      };
      dispatch(0);
    };
  }
  export type Middleware = (
    message: MessageEvent,
    next: (message?: MessageEvent) => void
  ) => void;
  export type Compose = (message: MessageEvent) => void;
  export interface Lifecycle {
    mounted: [];
    dispose: [];
    message: [MessageEvent];
    request: [RequestEvent];
  }
}
