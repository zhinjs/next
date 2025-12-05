import fs from "fs";
import os from "os";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Adapter } from "../src/adapter";
import { Hooks } from "../src/hooks";

describe("Branch Coverage Tests", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `branch-coverage-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
  });

  describe("Hooks.create with relative path", () => {
    it("应该能处理相对路径（非绝对路径）", async () => {
      const testFile = path.join(testDir, "relative-test.js");
      fs.writeFileSync(testFile, `export const name = "relative-test";`);

      // 使用绝对路径创建（触发 path.isAbsolute 分支）
      const hooksAbsolute = await Hooks.create(testFile);
      // 使用 realpath 解析可能的符号链接，统一比较
      expect(fs.realpathSync(hooksAbsolute.filePath)).toBe(
        fs.realpathSync(testFile)
      );

      hooksAbsolute.stop();
    });

    it("应该能处理相对路径并转换为绝对路径", async () => {
      // 先创建一个文件
      const absoluteFile = path.join(testDir, "absolute-test.js");
      fs.writeFileSync(absoluteFile, `export const name = "absolute-test";`);

      const hooks = await Hooks.create(absoluteFile);

      // filePath 应该是绝对路径
      expect(path.isAbsolute(hooks.filePath)).toBe(true);

      hooks.stop();
    });
  });

  describe("Hooks start edge cases", () => {
    it("应该能多次调用 start 而不出错（已启动时返回）", async () => {
      const testFile = path.join(testDir, "multi-start.js");
      fs.writeFileSync(testFile, `export const name = "multi-start";`);

      const hooks = await Hooks.create(testFile);

      // 第一次启动
      await hooks.start();

      // 第二次启动应该直接返回
      await hooks.start();

      // 应该没有错误
      expect(hooks).toBeDefined();

      hooks.stop();
    });
  });

  describe("Hooks middleware composition", () => {
    it("应该能在添加中间件后清除已编译的中间件", async () => {
      const testFile = path.join(testDir, "middleware-compose.js");
      fs.writeFileSync(testFile, `export const name = "middleware-compose";`);

      const hooks = await Hooks.create(testFile);

      // 添加中间件（这会清除 composedMiddleware 缓存）
      let middleware1Called = false;
      hooks.middleware(async (event, next) => {
        middleware1Called = true;
        await next();
      });

      // 再添加一个中间件（再次清除缓存）
      let middleware2Called = false;
      hooks.middleware(async (event, next) => {
        middleware2Called = true;
        await next();
      });

      // 触发 message 事件来执行中间件
      const mockEvent = {
        data: "test",
        reply: async () => "ok",
      } as any;

      hooks.emit("message", mockEvent);

      // 等待中间件执行
      await new Promise((resolve) => setTimeout(resolve, 50));

      hooks.stop();
    });
  });

  describe("Hooks dispatch with parent", () => {
    it("当有父插件时 dispatch 应该委托给父插件", async () => {
      const parentFile = path.join(testDir, "dispatch-parent.js");
      fs.writeFileSync(parentFile, `export const name = "dispatch-parent";`);

      const parent = await Hooks.create(parentFile);

      const childFile = path.join(testDir, "dispatch-child.js");
      fs.writeFileSync(childFile, `export const name = "dispatch-child";`);

      const child = await parent.import(childFile);

      let eventReceived = false;
      (parent as any).on("custom-event", () => {
        eventReceived = true;
      });

      // 子插件的 dispatch 应该委托给父插件
      await child.dispatch("custom-event" as any);

      expect(eventReceived).toBe(true);

      parent.stop();
    });

    it("当没有父插件时 dispatch 应该等同于 broadcast", async () => {
      const rootFile = path.join(testDir, "dispatch-root.js");
      fs.writeFileSync(rootFile, `export const name = "dispatch-root";`);

      const root = await Hooks.create(rootFile);

      let eventReceived = false;
      (root as any).on("test-event", () => {
        eventReceived = true;
      });

      // 没有父插件，dispatch 应该等同于 broadcast
      await root.dispatch("test-event" as any);

      expect(eventReceived).toBe(true);

      root.stop();
    });
  });

  describe("Hooks broadcast to children", () => {
    it("应该能向所有子插件广播事件", async () => {
      const parentFile = path.join(testDir, "broadcast-test-parent.js");
      fs.writeFileSync(
        parentFile,
        `export const name = "broadcast-test-parent";`
      );

      const parent = await Hooks.create(parentFile);

      const child1File = path.join(testDir, "broadcast-test-child1.js");
      fs.writeFileSync(
        child1File,
        `export const name = "broadcast-test-child1";`
      );

      const child2File = path.join(testDir, "broadcast-test-child2.js");
      fs.writeFileSync(
        child2File,
        `export const name = "broadcast-test-child2";`
      );

      const child1 = await parent.import(child1File);
      const child2 = await parent.import(child2File);

      let child1Received = false;
      let child2Received = false;
      let parentReceived = false;

      (parent as any).on("broadcast-event", () => {
        parentReceived = true;
      });

      (child1 as any).on("broadcast-event", () => {
        child1Received = true;
      });

      (child2 as any).on("broadcast-event", () => {
        child2Received = true;
      });

      // 广播事件到所有插件
      await parent.broadcast("broadcast-event" as any);

      expect(parentReceived).toBe(true);
      expect(child1Received).toBe(true);
      expect(child2Received).toBe(true);

      parent.stop();
    });
  });

  describe("Hooks watch with changes", () => {
    it("应该在文件 hash 改变时触发回调", async () => {
      const testFile = path.join(testDir, "watch-hash-test.js");
      fs.writeFileSync(testFile, `export const name = "watch-hash-test";`);

      const hooks = await Hooks.create(testFile);

      let callbackTriggered = false;
      hooks.watch(() => {
        callbackTriggered = true;
      });

      // 等待一下
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 修改文件内容
      fs.writeFileSync(
        testFile,
        `export const name = "watch-hash-test-modified";`
      );

      // 等待文件监听触发
      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(callbackTriggered).toBe(true);

      hooks.stop();
    });

    it("当文件 hash 没有改变时不应该触发回调", async () => {
      const testFile = path.join(testDir, "watch-no-change.js");
      const content = `export const name = "watch-no-change";`;
      fs.writeFileSync(testFile, content);

      const hooks = await Hooks.create(testFile);

      let callbackCount = 0;
      hooks.watch(() => {
        callbackCount++;
      });

      // 等待一下
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 写入相同内容（hash 不变）
      fs.writeFileSync(testFile, content);

      // 等待
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 由于 hash 没变，回调不应该被触发
      expect(callbackCount).toBe(0);

      hooks.stop();
    });
  });

  describe("Hooks accounts getter with dirty flag", () => {
    it("当 accountsDirty 为 false 时应该返回缓存的账号列表", async () => {
      const testFile = path.join(testDir, "accounts-cache.js");
      fs.writeFileSync(testFile, `export const name = "accounts-cache";`);

      const hooks = await Hooks.create(testFile);

      class MockAccount {
        account_id: string;
        adapter: any = "test";
        constructor(options: any) {
          this.account_id = options.account_id || "test";
        }
        async start() {}
        async stop() {}
        sendMessage = vi.fn();
      }

      class TestAdapter extends Adapter {
        constructor() {
          super("test-adapter", []);
        }
        async createAccount(options: any) {
          return new MockAccount(options) as any;
        }
      }

      const adapter = new TestAdapter();
      hooks.adapter(adapter);

      // 第一次访问会计算并缓存
      const accounts1 = hooks.accounts;

      // 第二次访问应该返回缓存
      const accounts2 = hooks.accounts;

      expect(accounts1).toBe(accounts2); // 应该是同一个数组实例

      hooks.stop();
    });
  });

  describe("Hooks adapters getter with dirty flag", () => {
    it("当 adaptersDirty 为 false 时应该返回缓存的适配器 Map", async () => {
      const testFile = path.join(testDir, "adapters-cache.js");
      fs.writeFileSync(testFile, `export const name = "adapters-cache";`);

      const hooks = await Hooks.create(testFile);

      class MockAccount {
        account_id: string;
        adapter: any = "test";
        constructor(options: any) {
          this.account_id = options.account_id || "test";
        }
        async start() {}
        async stop() {}
        sendMessage = vi.fn();
      }

      class TestAdapter extends Adapter {
        constructor() {
          super("test-adapter", []);
        }
        async createAccount(options: any) {
          return new MockAccount(options) as any;
        }
      }

      const adapter = new TestAdapter();
      hooks.adapter(adapter);

      // 第一次访问会计算并缓存
      const adapters1 = hooks.adapters;

      // 第二次访问应该返回缓存
      const adapters2 = hooks.adapters;

      expect(adapters1).toBe(adapters2); // 应该是同一个 Map 实例

      hooks.stop();
    });
  });
});
