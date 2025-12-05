import logger, { Logger } from "@zhin.js/logger";
import { Directive } from "@zhinjs/directive";
import { AsyncLocalStorage } from "async_hooks";
import { EventEmitter } from "events";
import * as fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { Account } from "./account";
import { Adapter } from "./adapter";
import {
  AdapterError,
  ErrorCode,
  ErrorManager,
  MiddlewareError,
  PluginError,
} from "./error";
import { MessageEvent, RequestEvent } from "./event";
import { Args, Key } from "./types";
import { currentFile, getFileHash, watchFile } from "./utils";

export const storage = new AsyncLocalStorage<Hooks>();
export function useHooks() {
  const plugin = storage.getStore();
  const callerFile = currentFile(import.meta.url);
  if (plugin && callerFile === plugin.filePath) return plugin;
  const newHooks = new Hooks(callerFile, plugin);
  storage.enterWith(newHooks);
  // 注意：构造函数已经将 newHooks 添加到 parent.children 了，不需要重复添加
  return newHooks;
}

export function useService<K extends keyof Hooks.Services>(
  name: K
): Hooks.Services[K] {
  const hooks = useHooks();
  let serviceCache: Hooks.Services[K] | undefined;
  let lookupPromise: Promise<Hooks.Services[K]> | undefined;

  // 同步查找服务
  const getServiceSync = (): Hooks.Services[K] => {
    if (serviceCache !== undefined) return serviceCache;

    const service = hooks.inject<Hooks.Services[K]>(name);
    if (service !== undefined) {
      serviceCache = service;
      return service;
    }

    throw new Error(
      `Service "${name}" not found. Make sure the service is provided before accessing it.\n` +
        `Hint: Import the plugin that provides "${name}" before using useService("${name}").`
    );
  };

  // 异步查找（等待微任务队列）
  const getServiceAsync = async (): Promise<Hooks.Services[K]> => {
    if (serviceCache !== undefined) return serviceCache;
    if (lookupPromise) return lookupPromise;

    lookupPromise = new Promise((resolve, reject) => {
      // 使用 queueMicrotask 而不是 setImmediate，更快且更符合 Promise 语义
      queueMicrotask(() => {
        try {
          const service = hooks.inject<Hooks.Services[K]>(name);
          if (service === undefined) {
            reject(
              new Error(
                `Service "${name}" not found. Make sure the service is provided before accessing it.\n` +
                  `Hint: Import the plugin that provides "${name}" before using useService("${name}").`
              )
            );
          } else {
            serviceCache = service;
            resolve(service);
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    return lookupPromise;
  };

  // 返回 Proxy 对象
  return new Proxy({} as Hooks.Services[K], {
    get(target, prop) {
      // 特殊属性：支持 await useService()
      if (prop === "then") {
        return (resolve: any, reject: any) =>
          getServiceAsync().then(resolve, reject);
      }

      const service = getServiceSync();
      const value = (service as any)[prop];
      return typeof value === "function" ? value.bind(service) : value;
    },
    set(target, prop, value) {
      const service = getServiceSync();
      (service as any)[prop] = value;
      return true;
    },
    has(target, prop) {
      const service = hooks.inject<Hooks.Services[K]>(name);
      return service !== undefined && prop in service;
    },
    ownKeys(target) {
      const service = hooks.inject<Hooks.Services[K]>(name);
      if (service === undefined) return [];
      return Reflect.ownKeys(service);
    },
    getOwnPropertyDescriptor(target, prop) {
      const service = hooks.inject<Hooks.Services[K]>(name);
      if (service === undefined) return undefined;
      return Reflect.getOwnPropertyDescriptor(service, prop);
    },
  });
}

export class Hooks extends EventEmitter<Hooks.Lifecycle> {
  // 缓存优化
  #cachedAdapters?: Map<string, Adapter>;
  #cachedAccounts?: Account[];
  #cachedName?: string;
  #adaptersDirty = true;
  #accountsDirty = true;
  #isStarted = false;
  // 服务存储
  #services: Map<string, any> = new Map();

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
  children: Hooks[] = [];
  get root(): Hooks {
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
  #middleware: Hooks.Middleware[] = [];
  #composedMiddleware?: Hooks.Compose;
  get middlewares() {
    return this.children.reduce(
      (result: Hooks.Middleware[], plugin: Hooks): Hooks.Middleware[] => {
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
        plugin: Hooks
      ): Directive<[MessageEvent]>[] => {
        return result.concat(plugin.directives);
      },
      this.#directives
    );
  }
  onMounted(callback: () => void | Promise<void>) {
    this.on("mounted", callback);
  }
  onDispose(callback: () => void | Promise<void>) {
    this.on("dispose", callback);
  }
  async import(entry: string) {
    const plugin = await Hooks.create(
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
    if (index === -1) {
      throw new PluginError(
        `插件 "${name}" 未找到`,
        ErrorCode.PLUGIN_NOT_FOUND,
        { pluginName: name }
      );
    }
    const [plugin] = this.children.splice(index, 1);
    plugin.stop();
    this.#adaptersDirty = true;
    this.#accountsDirty = true;
    return plugin;
  }
  async start() {
    if (this.#isStarted) return;
    this.#isStarted = true;
    for (const adapter of this.adapters.values()) {
      try {
        await adapter.start();
        this.#accountsDirty = true;
      } catch (error) {
        await ErrorManager.handle(error as Error, {
          source: "Hooks.start",
          operation: "adapter.start",
          metadata: { adapterName: adapter.name },
        });
        throw error;
      }
    }
    for (const service of this.#services.values()) {
      if (typeof service.start === "function") {
        await service.start();
      }
    }
    await this.broadcast("mounted");
    this.logger.info(`success started`);
  }
  adapter<T extends Adapter>(adapter: T): this;
  adapter<F extends Hooks.Adapters[keyof Hooks.Adapters]>(
    Factory: F,
    ...args: ConstructorParameters<F>
  ): this;
  adapter<T extends keyof Hooks.Adapters>(
    name: T,
    ...args: ConstructorParameters<Hooks.Adapters[T]>
  ): this;
  adapter<T extends Adapter>(
    input: T | Adapter.Factory<T> | keyof Hooks.Adapters,
    ...args: any[]
  ): this {
    const factory =
      typeof input === "string"
        ? Adapter.Registry.get(input)
        : (input as Adapter.Factory<T>);
    if (!factory) {
      throw new AdapterError(
        `适配器 "${input}" 未找到`,
        ErrorCode.ADAPTER_NOT_FOUND,
        { adapterName: input as string }
      );
    }
    const adapter =
      input instanceof Adapter
        ? input
        : new factory(...(args as ConstructorParameters<Adapter.Factory<T>>));
    this.#adapters.set(adapter.name, adapter);
    adapter.binding = this;
    this.#adaptersDirty = true;
    this.logger.info(`Adapter "${adapter.name}" registered`);
    return this;
  }
  async dispatch<K>(
    name: Key<K, Hooks.Lifecycle>,
    ...args: Args<K, Hooks.Lifecycle>
  ): Promise<void> {
    if (this.parent) return this.parent.dispatch(name, ...args);
    return this.broadcast(name, ...args);
  }
  async broadcast<K>(
    name: Key<K, Hooks.Lifecycle>,
    ...args: Args<K, Hooks.Lifecycle>
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
  constructor(
    filePath: string = "",
    public parent?: Hooks
  ) {
    super();
    this.filePath = filePath.replace(/\?t=\d+$/, "");
    this.logger = this.name ? logger.getLogger(this.name) : logger;

    // 自动将自己添加到父节点的 children（避免重复）
    if (parent && !parent.children.includes(this)) {
      parent.children.push(this);
      parent.#adaptersDirty = true;
      parent.#accountsDirty = true;
    }

    this.middleware(async (event, next) => {
      await next();
      for (const directive of this.#directives) {
        const result = await directive.match(event.data, event);
        if (result) event.reply(result);
      }
    });
    this.on("message", async (event: MessageEvent) => {
      if (!this.#composedMiddleware) {
        this.#composedMiddleware = Hooks.compose(this.#middleware);
      }
      try {
        this.#composedMiddleware(event);
      } catch (error) {
        await ErrorManager.handle(error as Error, {
          source: "Hooks.message",
          operation: "middleware.execute",
          metadata: { eventType: "message", data: event.data },
        });
        this.logger.error("Message middleware error:", error);
      }
    });
    // all methods bind this
    for (const key of Object.getOwnPropertyNames(Hooks.prototype)) {
      const value = (this as any)[key];
      if (typeof value === "function" && key !== "constructor") {
        (this as any)[key] = value.bind(this);
      }
    }
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
  middleware(middleware: Hooks.Middleware) {
    this.middlewares.push(middleware);
    // 清除缓存，下次使用时重新编译
    this.#composedMiddleware = undefined;
    return this;
  }

  /**
   * 提供服务给其他插件使用
   */
  provide<T>(name: string, value: T): this {
    this.#services.set(name, value);
    this.logger.info(`Service "${name}" provided`);
    return this;
  }

  /**
   * 注入服务（混合查找策略：向上继承 + 全局共享）
   */
  inject<T>(name: string, defaultValue?: T): T | undefined {
    // 1. 先从当前插件查找
    if (this.#services.has(name)) {
      return this.#services.get(name);
    }

    // 2. 向上遍历父插件查找（继承父级服务）
    let current = this.parent;
    while (current) {
      if (current.#services.has(name)) {
        return current.#services.get(name);
      }
      current = current.parent;
    }

    // 3. 从 root 开始全局查找（支持跨插件服务共享）
    const rootHooks = this.root;
    const found = this.#findServiceInTree<T>(rootHooks, name);
    if (found !== undefined) {
      return found;
    }

    return defaultValue;
  }

  /**
   * 在树中递归查找服务
   */
  #findServiceInTree<T>(hooks: Hooks, name: string): T | undefined {
    // 检查当前节点（但跳过已经检查过的祖先和自己）
    const shouldCheckCurrent = hooks !== this && !this.#isAncestor(hooks);

    if (shouldCheckCurrent && hooks.#services.has(name)) {
      return hooks.#services.get(name);
    }

    // 递归检查子节点
    for (const child of hooks.children) {
      // 如果当前节点是祖先，跳过从祖先到自己的路径
      if (this.#isAncestor(hooks) && this.#isDescendantOf(child)) {
        continue;
      }

      const found = this.#findServiceInTree<T>(child, name);
      if (found !== undefined) {
        return found;
      }
    }

    return undefined;
  }

  /**
   * 检查当前节点是否是指定节点的后代
   */
  #isDescendantOf(node: Hooks): boolean {
    let current: Hooks | undefined = this;
    while (current) {
      if (current === node) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * 检查指定节点是否是当前节点的祖先
   */
  #isAncestor(node: Hooks): boolean {
    let current = this.parent;
    while (current) {
      if (current === node) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  async reload(plugin: Hooks = this) {
    if (!plugin.parent) return process.exit(51);
    plugin.stop();
    plugin.parent.remove(plugin.name);
    await plugin.parent.import(plugin.filePath);
    await plugin.broadcast("mounted");
    this.logger.info(`Hooks "${plugin.name}" reloaded`);
  }
  watch(callback: (p: Hooks) => void | Promise<void>, recursive = false) {
    if (!this.filePath || this.filePath.includes("node_modules")) return;
    const unwatch = watchFile(this.filePath, () => {
      const newHash = getFileHash(this.filePath);
      if (newHash === this.fileHash) return;
      this.logger.info(`Hooks "${this.name}" file changed, reloading...`);
      callback(this);
      this.fileHash = newHash;
    });
    this.on("dispose", unwatch);
    if (recursive) {
      for (const child of this.children) {
        child.watch(callback, recursive);
      }
    }
  }
  stop() {
    if (!this.#isStarted) return;
    this.#isStarted = false;
    this.emit("dispose");
    for (const adapter of this.adapters.values()) {
      adapter.stop();
    }
    for (const service of this.#services.values()) {
      if (typeof service.stop === "function") {
        service.stop();
      }
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
    this.logger.info(`Hooks "${this.name}" stopped`);
  }
}
export namespace Hooks {
  export async function create(entry: string, parent?: Hooks): Promise<Hooks> {
    const entryFile = fileURLToPath(
      import.meta.resolve(
        entry,
        pathToFileURL(parent?.filePath || import.meta.url)
      )
    );
    const plugin = new Hooks(fs.realpathSync(entryFile), parent);
    plugin.fileHash = getFileHash(entryFile);
    await storage.run(plugin, async () => {
      return await import(`${import.meta.resolve(entryFile)}?t=${Date.now()}`);
    });
    // 注意：构造函数已经将 plugin 添加到 parent.children 了，不需要重复添加
    return plugin;
  }
  export interface Adapters {}
  export interface Services {}
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
        if (i <= index) {
          throw new MiddlewareError(
            "中间件中 next() 被多次调用",
            ErrorCode.MIDDLEWARE_NEXT_CALLED_MULTIPLE
          );
        }
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
