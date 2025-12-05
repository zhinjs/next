import { describe, expect, it, vi } from "vitest";
import { Hooks } from "../src/hooks";

describe("服务系统", () => {
  describe("Hooks provide/inject", () => {
    it("应该能提供和注入服务", () => {
      const parent = new Hooks();
      const child = new Hooks("", parent);

      const db = { query: vi.fn() };
      parent.provide("database", db);

      const injected = child.inject("database");
      expect(injected).toBe(db);
    });

    it("应该从最近的父级注入服务", () => {
      const root = new Hooks();
      const parent = new Hooks("", root);
      const child = new Hooks("", parent);

      const db1 = { id: 1 };
      const db2 = { id: 2 };

      root.provide("database", db1);
      parent.provide("database", db2);

      expect(child.inject("database")).toBe(db2);
    });

    it("服务不存在时应该返回默认值", () => {
      const hooks = new Hooks();
      const defaultDb = { id: "default" };

      expect(hooks.inject("database", defaultDb)).toBe(defaultDb);
    });

    it("服务不存在且无默认值时应该返回 undefined", () => {
      const hooks = new Hooks();
      expect(hooks.inject("database")).toBeUndefined();
    });
  });

  describe("集成场景", () => {
    it("应该支持插件间服务共享", () => {
      const root = new Hooks();

      // 数据库插件提供服务
      const dbPlugin = new Hooks("db-plugin", root);
      const database = {
        query: vi.fn(),
        users: { find: vi.fn(), create: vi.fn() },
      };
      dbPlugin.provide("database", database);

      // 用户插件使用数据库服务（注意：子插件需要从父插件的子插件获取）
      const userPlugin = new Hooks("user-plugin", dbPlugin);
      const db = userPlugin.inject("database");

      expect(db).toBe(database);
      expect(db?.users.find).toBeDefined();
    });

    it("应该支持服务覆盖", () => {
      const root = new Hooks();

      // 父插件提供默认服务
      const mockDb = { mock: true };
      root.provide("database", mockDb);

      // 子插件覆盖服务
      const child = new Hooks("child", root);
      const realDb = { mock: false, query: vi.fn() };
      child.provide("database", realDb);

      // 孙子插件应该获取到最近的服务
      const grandchild = new Hooks("grandchild", child);
      expect(grandchild.inject("database")).toBe(realDb);

      // 父插件仍然获取自己的服务
      expect(root.inject("database")).toBe(mockDb);
    });

    it("应该支持跨插件服务共享（兄弟节点）", () => {
      const root = new Hooks();

      // config 插件提供配置服务
      const configPlugin = new Hooks("config", root);
      const configService = { get: vi.fn(), load: vi.fn() };
      configPlugin.provide("config", configService);

      // worker 插件需要使用 config 服务（兄弟节点）
      const workerPlugin = new Hooks("worker", root);
      const config = workerPlugin.inject("config");

      expect(config).toBe(configService);
      expect(config?.get).toBeDefined();
    });

    it("应该优先使用继承的服务而非兄弟节点", () => {
      const root = new Hooks();

      // root 提供默认配置
      const defaultConfig = { name: "default" };
      root.provide("config", defaultConfig);

      // config 插件（兄弟节点）提供另一个配置
      const configPlugin = new Hooks("config", root);
      const siblingConfig = { name: "sibling" };
      configPlugin.provide("config", siblingConfig);

      // worker 插件应该优先获取父级的配置
      const workerPlugin = new Hooks("worker", root);
      const config = workerPlugin.inject("config");

      expect(config).toBe(defaultConfig); // 继承父级，而非兄弟节点
    });
  });
});
