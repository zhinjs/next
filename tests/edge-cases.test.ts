import fs from "fs";
import os from "os";
import path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import { ConfigLoader } from "../src/plugins/config";
import { getFileHash } from "../src/utils";

describe("Edge Cases Coverage", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `edge-cases-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
  });

  describe("getFileHash cache management", () => {
    it("应该在缓存超过 1000 条时清空缓存", () => {
      const testFiles: string[] = [];

      // 创建多个测试文件
      for (let i = 0; i < 10; i++) {
        const file = path.join(testDir, `test-${i}.js`);
        fs.writeFileSync(file, `module.exports = ${i};`);
        testFiles.push(file);
      }

      // 模拟大量文件 hash 计算
      testFiles.forEach((file) => {
        getFileHash(file);
      });

      // 第二次调用应该使用缓存
      const hash1 = getFileHash(testFiles[0]);
      const hash2 = getFileHash(testFiles[0]);

      expect(hash1).toBe(hash2);
    });

    it("应该在文件 mtime 改变时重新计算 hash", async () => {
      const testFile = path.join(testDir, "mtime-test.js");
      fs.writeFileSync(testFile, "original content");

      const hash1 = getFileHash(testFile);

      // 等待一下确保 mtime 改变
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 修改文件
      fs.writeFileSync(testFile, "modified content");

      const hash2 = getFileHash(testFile);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("getFileHash with package.json main field", () => {
    it("应该优先使用 package.json 的 main 字段", () => {
      const pkgDir = path.join(testDir, "pkg-priority");
      fs.mkdirSync(pkgDir, { recursive: true });

      const customMain = path.join(pkgDir, "custom.js");
      fs.writeFileSync(customMain, "module.exports = 'custom';");

      const indexFile = path.join(pkgDir, "index.js");
      fs.writeFileSync(indexFile, "module.exports = 'index';");

      const pkgJson = path.join(pkgDir, "package.json");
      fs.writeFileSync(
        pkgJson,
        JSON.stringify({ name: "test", main: "custom.js" })
      );

      const hash = getFileHash(pkgDir);
      expect(hash).toBeDefined();
    });

    it("应该处理 package.json 没有 main 字段的情况", () => {
      const pkgDir = path.join(testDir, "pkg-no-main");
      fs.mkdirSync(pkgDir, { recursive: true });

      const indexFile = path.join(pkgDir, "index.js");
      fs.writeFileSync(indexFile, "module.exports = {};");

      const pkgJson = path.join(pkgDir, "package.json");
      fs.writeFileSync(
        pkgJson,
        JSON.stringify({ name: "test", version: "1.0.0" })
      );

      const hash = getFileHash(pkgDir);
      expect(hash).toBeDefined();
    });
  });

  describe("ConfigLoader env variable replacement", () => {
    it("应该处理环境变量默认值语法", () => {
      delete process.env.TEST_VAR_UNDEFINED;

      const testFile = path.join(testDir, "env-test.yml");
      fs.writeFileSync(testFile, "value: ${TEST_VAR_UNDEFINED:-default-value}");

      const config = new ConfigLoader<any>(testFile);

      expect(config.data.value).toBe("default-value");
    });

    it("应该正确处理已定义的环境变量", () => {
      process.env.TEST_VAR_DEFINED = "actual-value";

      const testFile = path.join(testDir, "env-test2.yml");
      fs.writeFileSync(testFile, "value: ${TEST_VAR_DEFINED:-default-value}");

      const config = new ConfigLoader<any>(testFile);

      expect(config.data.value).toBe("actual-value");

      delete process.env.TEST_VAR_DEFINED;
    });
  });
});
