import fs from "fs";
import os from "os";
import path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import { MessageEvent } from "../src/event";
import { Hooks } from "../src/hooks";

describe("Hooks Final Coverage", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `hooks-final-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
  });

  describe("dispatch vs broadcast", () => {
    it("子插件的 dispatch 应该委托给父插件", async () => {
      const parentFile = path.join(testDir, "parent.js");
      fs.writeFileSync(parentFile, `export const name = "parent";`);

      const parent = await Hooks.create(parentFile);

      const childFile = path.join(testDir, "child.js");
      fs.writeFileSync(childFile, `export const name = "child";`);

      const child = await parent.import(childFile);

      let parentMountedCalled = false;
      parent.on("mounted", () => {
        parentMountedCalled = true;
      });

      // 子插件的 dispatch 应该触发父插件的事件
      await child.dispatch("mounted");

      expect(parentMountedCalled).toBe(true);

      parent.stop();
    });

    it("没有父插件时 dispatch 应该等同于 broadcast", async () => {
      const rootFile = path.join(testDir, "root.js");
      fs.writeFileSync(rootFile, `export const name = "root";`);

      const root = await Hooks.create(rootFile);

      let mountedCalled = false;
      root.on("mounted", () => {
        mountedCalled = true;
      });

      await root.dispatch("mounted");

      expect(mountedCalled).toBe(true);

      root.stop();
    });
  });

  describe("middleware with directives", () => {
    it("应该能通过中间件处理指令匹配", async () => {
      const testFile = path.join(testDir, "middleware-test.js");
      fs.writeFileSync(testFile, `export const name = "middleware-test";`);

      const hooks = await Hooks.create(testFile);

      // 添加一个指令
      const mockDirective = {
        match: async (content: string) => {
          if (content === "test-command") {
            return "指令已触发";
          }
          return null;
        },
      };

      (hooks as any).directives.push(mockDirective);

      let replyMessage = "";
      const mockEvent = {
        data: "test-command",
        reply: async (msg: string) => {
          replyMessage = msg;
          return "msg-id";
        },
      } as any as MessageEvent;

      // 触发 message 事件
      hooks.emit("message", mockEvent);

      // 等待中间件执行
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(replyMessage).toBe("指令已触发");

      hooks.stop();
    });
  });

  describe("constructor edge cases", () => {
    it("当 filePath 包含查询参数时应该移除", async () => {
      const testFile = path.join(testDir, "query-test.js");
      fs.writeFileSync(testFile, `export const name = "query-test";`);

      const hooks = new Hooks(`${testFile}?t=123456`);

      expect(hooks.filePath).toBe(testFile);
    });

    it("当没有 name 时应该使用根 logger", () => {
      const hooks = new Hooks("");

      expect(hooks.logger).toBeDefined();
    });
  });

  describe("broadcast with children", () => {
    it("应该能向所有子插件广播事件", async () => {
      const parentFile = path.join(testDir, "broadcast-parent.js");
      fs.writeFileSync(parentFile, `export const name = "broadcast-parent";`);

      const parent = await Hooks.create(parentFile);

      const child1File = path.join(testDir, "broadcast-child1.js");
      fs.writeFileSync(child1File, `export const name = "broadcast-child1";`);

      const child2File = path.join(testDir, "broadcast-child2.js");
      fs.writeFileSync(child2File, `export const name = "broadcast-child2";`);

      const child1 = await parent.import(child1File);
      const child2 = await parent.import(child2File);

      let child1Called = false;
      let child2Called = false;

      (child1 as any).on("custom-event", () => {
        child1Called = true;
      });

      (child2 as any).on("custom-event", () => {
        child2Called = true;
      });

      await parent.broadcast("custom-event" as any);

      expect(child1Called).toBe(true);
      expect(child2Called).toBe(true);

      parent.stop();
    });
  });
});
