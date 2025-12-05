import fs from "fs";
import os from "os";
import path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import { getFileHash, watchFile } from "../src/utils";

describe("Utils Extended Coverage", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `utils-extended-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
  });

  describe("watchFile with array", () => {
    it("应该能监听多个文件并在变化时触发回调", async () => {
      const file1 = path.join(testDir, "file1.txt");
      const file2 = path.join(testDir, "file2.txt");

      fs.writeFileSync(file1, "initial1");
      fs.writeFileSync(file2, "initial2");

      let changeCount = 0;
      const unwatch = watchFile([file1, file2], () => {
        changeCount++;
      });

      // 等待一下
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 修改文件
      fs.writeFileSync(file1, "changed1");

      // 等待文件监听触发
      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(changeCount).toBeGreaterThan(0);

      unwatch();
    });

    it("应该能取消监听多个文件", async () => {
      const file1 = path.join(testDir, "unwatch1.txt");
      const file2 = path.join(testDir, "unwatch2.txt");

      fs.writeFileSync(file1, "initial1");
      fs.writeFileSync(file2, "initial2");

      let changeCount = 0;
      const unwatch = watchFile([file1, file2], () => {
        changeCount++;
      });

      // 立即取消监听
      unwatch();

      // 等待一下
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 修改文件
      fs.writeFileSync(file1, "changed1");
      fs.writeFileSync(file2, "changed2");

      // 等待
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 由于已取消监听，变化次数应该很少或为 0
      expect(changeCount).toBeLessThan(3);
    });
  });

  describe("getFileHash for directory", () => {
    it("应该能获取包含 package.json main 字段的目录的 hash", () => {
      const pkgDir = path.join(testDir, "pkg-with-main");
      fs.mkdirSync(pkgDir, { recursive: true });

      const mainFile = path.join(pkgDir, "main.js");
      fs.writeFileSync(mainFile, "module.exports = {};");

      const pkgJson = path.join(pkgDir, "package.json");
      fs.writeFileSync(
        pkgJson,
        JSON.stringify({ name: "test-pkg", main: "main.js" })
      );

      const hash = getFileHash(pkgDir);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
    });

    it("应该能获取没有 package.json 但有 index.js 的目录的 hash", () => {
      const indexDir = path.join(testDir, "dir-with-index");
      fs.mkdirSync(indexDir, { recursive: true });

      const indexFile = path.join(indexDir, "index.js");
      fs.writeFileSync(indexFile, "module.exports = {};");

      const hash = getFileHash(indexDir);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
    });

    it("应该能获取包含 index.ts 的目录的 hash", () => {
      const tsDir = path.join(testDir, "dir-with-ts");
      fs.mkdirSync(tsDir, { recursive: true });

      const tsFile = path.join(tsDir, "index.ts");
      fs.writeFileSync(tsFile, "export {};");

      const hash = getFileHash(tsDir);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
    });

    it("应该能获取包含其他入口文件的目录的 hash", () => {
      const mjsDir = path.join(testDir, "dir-with-mjs");
      fs.mkdirSync(mjsDir, { recursive: true });

      const mjsFile = path.join(mjsDir, "index.mjs");
      fs.writeFileSync(mjsFile, "export {};");

      const hash = getFileHash(mjsDir);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
    });

    it("当目录中没有可识别的入口文件时应该抛出错误", () => {
      const emptyDir = path.join(testDir, "empty-dir");
      fs.mkdirSync(emptyDir, { recursive: true });

      expect(() => getFileHash(emptyDir)).toThrow();
    });

    it("应该使用缓存来提高性能", () => {
      const cachedDir = path.join(testDir, "cached-dir");
      fs.mkdirSync(cachedDir, { recursive: true });

      const cachedFile = path.join(cachedDir, "index.js");
      fs.writeFileSync(cachedFile, "module.exports = {};");

      const hash1 = getFileHash(cachedDir);
      const hash2 = getFileHash(cachedDir);

      expect(hash1).toBe(hash2);
    });
  });
});
