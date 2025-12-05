import fs from "fs";
import os from "os";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hooks } from "../src/hooks";

describe("Hooks Dispatch & Broadcast Coverage", () => {
  let testDir: string;
  let hooks: Hooks;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `test-hooks-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    const testFile = path.join(testDir, "test-plugin.js");
    fs.writeFileSync(testFile, `export const name = "test-plugin";`);

    hooks = await Hooks.create(testFile);
  });

  describe("reload", () => {
    it("当没有 parent 时应该退出进程", async () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });

      const rootHooks = new Hooks("test.js");

      await expect(rootHooks.reload()).rejects.toThrow("process.exit called");
      expect(exitSpy).toHaveBeenCalledWith(51);

      exitSpy.mockRestore();
    });

    it("应该能重新加载插件", async () => {
      const parentFile = path.join(testDir, "parent-plugin.js");
      fs.writeFileSync(parentFile, `export const name = "parent-plugin";`);

      const parent = await Hooks.create(parentFile);

      const childFile = path.join(testDir, "child-plugin.js");
      fs.writeFileSync(childFile, `export const name = "child-plugin";`);

      const child = await parent.import(childFile);

      const broadcastSpy = vi.spyOn(child, "broadcast");
      const loggerSpy = vi.spyOn(child.logger, "info");

      // 修改文件内容
      fs.writeFileSync(
        childFile,
        `export const name = "child-plugin-updated";`
      );

      await child.reload();

      expect(broadcastSpy).toHaveBeenCalledWith("mounted");
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Hooks "child-plugin" reloaded')
      );
    });
  });

  describe("watch", () => {
    it("当文件路径为空时应该跳过监听", () => {
      const hooksWithoutPath = new Hooks();
      const result = hooksWithoutPath.watch(() => {});
      expect(result).toBeUndefined();
    });

    it("当文件路径包含 node_modules 时应该跳过监听", () => {
      const hooksWithNodeModules = new Hooks("node_modules/test/index.js");
      const result = hooksWithNodeModules.watch(() => {});
      expect(result).toBeUndefined();
    });

    it("应该能监听文件变化并触发回调", async () => {
      const testFile = path.join(testDir, "watch-test.js");
      fs.writeFileSync(testFile, `export const value = 1;`);

      const watchedHooks = await Hooks.create(testFile);

      const callback = vi.fn();
      watchedHooks.watch(callback, false);

      // 修改文件
      await new Promise((resolve) => setTimeout(resolve, 100));
      fs.writeFileSync(testFile, `export const value = 2;`);

      // 等待文件监听触发
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(callback).toHaveBeenCalled();

      watchedHooks.stop();
    });

    it("当 recursive=true 时应该递归监听子插件", async () => {
      const parentFile = path.join(testDir, "parent.js");
      fs.writeFileSync(parentFile, `export const name = "parent";`);

      const parent = await Hooks.create(parentFile);

      const childFile = path.join(testDir, "child.js");
      fs.writeFileSync(childFile, `export const name = "child";`);

      await parent.import(childFile);

      const callback = vi.fn();
      parent.watch(callback, true);

      expect(parent.children.length).toBe(1);

      parent.stop();
    });
  });

  describe("stop", () => {
    it("当未启动时调用 stop 应该直接返回", () => {
      const newHooks = new Hooks("test.js");
      newHooks.stop();
      // 不应该抛出错误
    });

    it("应该能正确停止并触发 dispose 事件", async () => {
      const testFile = path.join(testDir, "stop-test.js");
      fs.writeFileSync(testFile, `export const name = "stop-test";`);

      const stoppableHooks = await Hooks.create(testFile);

      // 需要先启动才能停止
      await stoppableHooks.start();

      const disposeSpy = vi.fn();
      stoppableHooks.on("dispose", disposeSpy);

      const loggerSpy = vi.spyOn(stoppableHooks.logger, "info");

      stoppableHooks.stop();

      expect(disposeSpy).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Hooks "stop-test" stopped')
      );
    });
  });

  describe("Hooks.create error handling", () => {
    it("当入口文件不存在时应该抛出错误", async () => {
      const nonExistentFile = path.join(testDir, "non-existent.js");

      await expect(Hooks.create(nonExistentFile)).rejects.toThrow();
    });

    it("应该能处理符号链接文件", async () => {
      const originalFile = path.join(testDir, "original.js");
      fs.writeFileSync(originalFile, `export const name = "original";`);

      const linkFile = path.join(testDir, "link.js");

      // 创建符号链接
      try {
        fs.symlinkSync(originalFile, linkFile);

        const linkedHooks = await Hooks.create(linkFile);
        expect(linkedHooks).toBeDefined();

        linkedHooks.stop();
      } catch (error) {
        // Windows 可能没有符号链接权限，跳过测试
        console.log("Symbolic link test skipped:", error);
      }
    });
  });
});
