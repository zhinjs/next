import { LogLevel } from "@zhin.js/logger";
export type WithPrefix<T extends Record<string, any>, P extends string> = {
  // @ts-ignore
  [K in keyof T as `${P}-${K}`]: T[K];
};

export type Options = {
  log_level: LogLevel;
  plugins: string[];
  plugin_dirs: string[];
};
export type Constructor<T> = new (...args: any[]) => T;

export interface ProcessMessage {
  type: string;
  pid?: number;
  body: any;
}
export type QueueItem = {
  action: string;
  payload: any;
};
export type DefaultEventMap = [never];
export type AnyRest = [...args: any[]];
export type Args<K, T> = T extends DefaultEventMap
  ? AnyRest
  : K extends keyof T
  ? T[K]
  : never;
export type Key<K, T> = T extends DefaultEventMap
  ? string | symbol
  : K | keyof T;
export type Param<T> = T extends new (...args: infer P) => any ? P :
T extends (...args: infer P) => any ? P : never;
