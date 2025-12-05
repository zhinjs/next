/**
 * 配置服务插件
 * 提供统一的配置管理能力
 */

import * as fs from "fs";
import * as yaml from "js-yaml";
import * as path from "path";
import { ConfigError, ErrorCode } from "../error";
import { useHooks } from "../hooks";
import { Service } from "../service";
import { saveYaml } from "../utils";
const { provide } = useHooks();
/**
 * 配置加载器
 */
export class ConfigLoader<T extends object> {
  #data: T;

  constructor(public filePath: string) {
    this.#data = yaml.load(fs.readFileSync(this.filePath, "utf-8")) as T;
  }

  get data() {
    return this.#proxyData(this.#data);
  }

  #proxyData<D extends object>(data: D): D {
    const config = this;
    return new Proxy(data, {
      get: (target, p, receiver) => {
        const value = Reflect.get(target, p, receiver);
        if (value === null || typeof value !== "object")
          return config.repalceEnv(value);
        return this.#proxyData(value);
      },
      set: (target, p, value, receiver) => {
        const result = Reflect.set(target, p, value, receiver);
        config.save();
        return result;
      },
    });
  }

  repalceEnv(value: any) {
    if (typeof value === "string") {
      // 支持 ${VAR} 和 ${VAR:-default} 两种语法
      return value.replace(
        /\$\{([^}:]+)(?::(-)?([^}]*))?\}/g,
        (match, key, modifier, defaultValue) => {
          const envValue = process.env[key];
          // 如果环境变量存在，返回环境变量的值
          if (envValue !== undefined) {
            return envValue;
          }
          // 如果有默认值（:- 或 : 语法），返回默认值
          if (modifier === "-" || defaultValue !== undefined) {
            return defaultValue || "";
          }
          // 否则保持原样
          return match;
        }
      );
    }
    return value;
  }

  save() {
    fs.writeFileSync(this.filePath, yaml.dump(this.#data), "utf-8");
  }
}

export namespace ConfigLoader {
  export const map: Map<string, ConfigLoader<any>> = new Map();

  export type Path<T> = T extends object
    ? {
        [K in keyof T]: K extends string
          ? T[K] extends object
            ? K | `${K}.${Path<T[K]>}`
            : K
          : never;
      }[keyof T]
    : never;

  export type GetDataByPath<T, K> = K extends `${infer Key}.${infer Rest}`
    ? Key extends keyof T
      ? T[Key] extends object
        ? GetDataByPath<T[Key], Rest>
        : never
      : never
    : K extends keyof T
      ? T[K]
      : T;

  export function getDataByPath<T extends object, K>(
    data: T,
    key?: K
  ): ConfigLoader.GetDataByPath<T, K> {
    if (key === undefined) return data as ConfigLoader.GetDataByPath<T, K>;
    if (typeof key !== "string") {
      throw new ConfigError(
        "配置键必须是字符串类型",
        ErrorCode.CONFIG_INVALID_KEY,
        { key, type: typeof key }
      );
    }
    const parts = key.split(".");
    let current: any = data;
    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        return undefined as ConfigLoader.GetDataByPath<T, K>;
      }
    }
    return current as ConfigLoader.GetDataByPath<T, K>;
  }

  export function setDataByPath<T extends object, K>(
    data: T,
    key: K,
    value: ConfigLoader.GetDataByPath<T, K>
  ): void {
    if (key === undefined) return;
    if (typeof key !== "string") {
      throw new ConfigError(
        "配置键必须是字符串类型",
        ErrorCode.CONFIG_INVALID_KEY,
        { key, type: typeof key }
      );
    }
    const parts = key.split(".");
    let current: any = data;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current[part] = value;
      } else {
        if (!(part in current) || typeof current[part] !== "object") {
          current[part] = {};
        }
        current = current[part];
      }
    }
  }
}

/**
 * 配置服务
 */
export class ConfigService extends Service {
  readonly name = "config";

  private loaders = new Map<string, ConfigLoader<any>>();

  /**
   * 启动服务
   */
  async start(): Promise<void> {
    await super.start();
  }

  /**
   * 停止服务
   */
  async stop(): Promise<void> {
    this.loaders.clear();
    ConfigLoader.map.clear();
    await super.stop();
  }

  /**
   * 加载配置文件
   */
  load<T extends object>(
    filename: string,
    defaultOptions: Partial<T>
  ): ConfigLoader<T> {
    const fullPath = path.join(process.cwd(), `${filename}.yml`);
    if (this.loaders.has(fullPath)) {
      return this.loaders.get(fullPath) as ConfigLoader<T>;
    }

    if (!fs.existsSync(fullPath)) {
      saveYaml(defaultOptions, fullPath);
    }

    const loader = new ConfigLoader<T>(fullPath);
    this.loaders.set(fullPath, loader);
    ConfigLoader.map.set(fullPath, loader);
    return loader;
  }

  /**
   * 获取配置
   */
  get<T extends object, K extends ConfigLoader.Path<T>>(
    key: K,
    defaultOptions?: ConfigLoader.GetDataByPath<T, K>,
    filename?: string
  ): ConfigLoader.GetDataByPath<T, K>;
  get<T extends object>(): T;
  get<T extends object, K extends ConfigLoader.Path<T>>(
    key?: K,
    defaultData?: ConfigLoader.GetDataByPath<T, K>,
    filename: string = "zhin.config"
  ): ConfigLoader.GetDataByPath<T, K> {
    const fullPath = path.join(process.cwd(), `${filename}.yml`);

    if (!this.loaders.has(fullPath)) {
      const defaultOptions = this.createDefaultData(key, defaultData);
      this.load<T>(filename, defaultOptions);
    }

    const loader = this.loaders.get(fullPath) as ConfigLoader<T>;
    const result = ConfigLoader.getDataByPath(loader.data, key);

    if (result === undefined && defaultData) {
      ConfigLoader.setDataByPath(loader.data, key, defaultData);
    }

    return ConfigLoader.getDataByPath(loader.data, key);
  }

  /**
   * 创建默认配置数据
   */
  private createDefaultData<T extends object, K extends ConfigLoader.Path<T>>(
    key?: K,
    defaultData?: ConfigLoader.GetDataByPath<T, K>
  ): Partial<T> {
    if (key === undefined) return defaultData as Partial<T>;
    const parts = key.split(".");
    const result: any = {};
    let current = result;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current[part] = defaultData;
      } else {
        current[part] = {};
        current = current[part];
      }
    }
    return result;
  }

  /**
   * 清理所有配置
   */
  clear() {
    this.loaders.clear();
    ConfigLoader.map.clear();
  }
}

// 创建并注册配置服务
provide("config", new ConfigService());

// 类型声明扩展
declare module "../hooks" {
  namespace Hooks {
    export interface Services {
      config: ConfigService;
    }
  }
}
