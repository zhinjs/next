import * as fs from "fs";
import * as yaml from "js-yaml";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  display_path,
  getFileHash,
  isClassConstructor,
  isExistDir,
  isExistFile,
  isSameObj,
  loadYaml,
  resolveEntry,
  saveYaml,
  watchFile,
  wrapExport,
} from "../src/utils";

describe("Utils", () => {
  const tmpDir = path.join(process.cwd(), "tmp-utils-test");

  beforeEach(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
  describe("display_path", () => {
    it("应该返回相对于 cwd 的路径", () => {
      const testPath = path.join(process.cwd(), "test", "file.ts");
      const result = display_path(testPath);
      expect(result).toBe("test/file.ts");
    });

    it("应该处理绝对路径", () => {
      const result = display_path("/absolute/path/file.ts");
      expect(typeof result).toBe("string");
    });
  });

  describe("isClassConstructor", () => {
    it("应该识别类构造函数", () => {
      class TestClass {}
      expect(isClassConstructor(TestClass)).toBe(true);
    });

    it("应该识别普通函数", () => {
      function testFunc() {}
      expect(isClassConstructor(testFunc)).toBe(false);
    });

    it("应该识别箭头函数", () => {
      const arrowFunc = () => {};
      expect(isClassConstructor(arrowFunc)).toBe(false);
    });
  });

  describe("isSameObj", () => {
    it("应该比较简单对象相等", () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 2 };
      expect(isSameObj(obj1, obj2)).toBe(true);
    });

    it("应该识别不相等的对象", () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 3 };
      expect(isSameObj(obj1, obj2)).toBe(false);
    });

    it("应该处理嵌套对象", () => {
      const obj1 = { a: { b: 1 } };
      const obj2 = { a: { b: 1 } };
      expect(isSameObj(obj1, obj2)).toBe(true);
    });

    it("应该处理数组", () => {
      const arr1 = [1, 2, 3];
      const arr2 = [1, 2, 3];
      expect(isSameObj(arr1, arr2)).toBe(true);
    });

    it("应该识别不同类型", () => {
      expect(isSameObj(null, undefined)).toBe(false);
      expect(isSameObj({}, [])).toBe(false);
    });
  });

  describe("getFileHash", () => {
    const testFile = path.join(process.cwd(), "test-hash-file.txt");

    beforeEach(() => {
      fs.writeFileSync(testFile, "test content", "utf-8");
    });

    afterEach(() => {
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });

    it("应该生成文件哈希", () => {
      const hash = getFileHash(testFile);
      expect(typeof hash).toBe("string");
      expect(hash.length).toBeGreaterThan(0);
    });

    it("相同内容应该生成相同哈希", () => {
      const hash1 = getFileHash(testFile);
      const hash2 = getFileHash(testFile);
      expect(hash1).toBe(hash2);
    });

    it("不同内容应该生成不同哈希", () => {
      const hash1 = getFileHash(testFile);

      fs.writeFileSync(testFile, "different content", "utf-8");
      const hash2 = getFileHash(testFile);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("watchFile", () => {
    const testFile = path.join(process.cwd(), "test-watch-file.txt");

    beforeEach(() => {
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
      fs.writeFileSync(testFile, "initial content", "utf-8");
    });

    afterEach(() => {
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });

    it("应该监听文件变化", async () => {
      const callback = vi.fn();
      const unwatch = watchFile(testFile, callback);

      // 等待一下确保监听器设置好
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 修改文件
      fs.writeFileSync(testFile, "modified content", "utf-8");

      // 等待回调触发
      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(callback).toHaveBeenCalled();
      unwatch();
    }, 10000);

    it("应该能够取消监听", async () => {
      const callback = vi.fn();
      const unwatch = watchFile(testFile, callback);

      await new Promise((resolve) => setTimeout(resolve, 100));
      unwatch();

      // 取消监听后修改文件
      fs.writeFileSync(testFile, "modified after unwatch", "utf-8");
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 回调不应该被触发
      expect(callback).not.toHaveBeenCalled();
    }, 10000);
  });

  describe("wrapExport", () => {
    it("应该包装默认导出", () => {
      const module = { default: { value: "test" } };
      const result = wrapExport(module);
      expect(result.value).toBe("test");
    });

    it("应该返回对象本身如果没有默认导出", () => {
      const module = { value: "test" };
      const result = wrapExport(module);
      expect(result).toEqual(module);
    });

    it("应该处理原始值", () => {
      expect(wrapExport(null)).toBe(null);
      expect(wrapExport(undefined)).toBe(undefined);
      expect(wrapExport(123)).toBe(123);
    });
  });

  describe("loadYaml", () => {
    it("应该加载 YAML 文件", () => {
      const testFile = path.join(tmpDir, "test.yaml");
      const data = { key: "value", num: 123 };
      fs.writeFileSync(testFile, yaml.dump(data));

      const result = loadYaml(testFile, {});
      expect(result).toEqual(data);
    });

    it("应该加载 YML 文件", () => {
      const testFile = path.join(tmpDir, "test.yml");
      const data = { key: "value" };
      fs.writeFileSync(testFile, yaml.dump(data));

      const result = loadYaml(testFile, {});
      expect(result).toEqual(data);
    });

    it("应该加载 JSON 文件", () => {
      const testFile = path.join(tmpDir, "test.json");
      const data = { key: "value", num: 456 };
      fs.writeFileSync(testFile, JSON.stringify(data));

      const result = loadYaml(testFile, {});
      expect(result).toEqual(data);
    });

    it("文件不存在时应该创建默认文件", () => {
      const testFile = path.join(tmpDir, "new.yaml");
      const defaultData = { default: true };

      const result = loadYaml(testFile, defaultData);
      expect(fs.existsSync(testFile)).toBe(true);
      expect(result).toEqual(defaultData);
    });

    it("不支持的文件格式应该抛出错误", () => {
      const testFile = path.join(tmpDir, "test.txt");
      fs.writeFileSync(testFile, "content");

      expect(() => loadYaml(testFile, {})).toThrow(
        "Unsupported options file format"
      );
    });
  });

  describe("saveYaml", () => {
    it("应该保存为 YAML 格式", () => {
      const testFile = path.join(tmpDir, "save.yaml");
      const data = { key: "value", num: 789 };

      saveYaml(data, testFile);

      expect(fs.existsSync(testFile)).toBe(true);
      const content = fs.readFileSync(testFile, "utf-8");
      expect(yaml.load(content)).toEqual(data);
    });

    it("应该保存为 JSON 格式", () => {
      const testFile = path.join(tmpDir, "save.json");
      const data = { key: "value", arr: [1, 2, 3] };

      saveYaml(data, testFile);

      expect(fs.existsSync(testFile)).toBe(true);
      const content = JSON.parse(fs.readFileSync(testFile, "utf-8"));
      expect(content).toEqual(data);
    });

    it("不支持的格式应该抛出错误", () => {
      const testFile = path.join(tmpDir, "save.txt");
      expect(() => saveYaml({}, testFile)).toThrow(
        "Unsupported options file format"
      );
    });
  });

  describe("resolveEntry", () => {
    it("应该解析插件入口文件", () => {
      const pluginDir = path.join(tmpDir, "plugins");
      fs.mkdirSync(pluginDir, { recursive: true });
      const entryFile = path.join(pluginDir, "test-plugin.ts");
      fs.writeFileSync(entryFile, "export default {}");

      const result = resolveEntry("test-plugin", [pluginDir]);
      expect(result).toBe(entryFile);
    });

    it("应该在多个目录中查找", () => {
      const dir1 = path.join(tmpDir, "dir1");
      const dir2 = path.join(tmpDir, "dir2");
      fs.mkdirSync(dir1, { recursive: true });
      fs.mkdirSync(dir2, { recursive: true });

      const entryFile = path.join(dir2, "plugin.js");
      fs.writeFileSync(entryFile, "module.exports = {}");

      const result = resolveEntry("plugin", [dir1, dir2]);
      expect(result).toBe(entryFile);
    });

    it("找不到插件应该抛出错误", () => {
      expect(() => resolveEntry("non-existent", [tmpDir])).toThrow(
        'Plugin entry for "non-existent" not found'
      );
    });
  });

  describe("isExistDir", () => {
    it("应该检测目录是否存在", () => {
      expect(isExistDir(tmpDir)).toBe(true);
      expect(isExistDir(path.join(tmpDir, "non-existent"))).toBe(false);
    });

    it("文件路径应该返回 false", () => {
      const file = path.join(tmpDir, "file.txt");
      fs.writeFileSync(file, "content");
      expect(isExistDir(file)).toBe(false);
    });
  });

  describe("isExistFile", () => {
    it("应该检测文件是否存在", () => {
      const file = path.join(tmpDir, "test-file.txt");
      fs.writeFileSync(file, "content");
      expect(isExistFile(file)).toBe(true);
      expect(isExistFile(path.join(tmpDir, "non-existent.txt"))).toBe(false);
    });

    it("目录路径应该返回 false", () => {
      expect(isExistFile(tmpDir)).toBe(false);
    });
  });

  describe("currentFile", () => {
    it("应该返回当前文件路径", async () => {
      // 动态导入以测试 currentFile
      const { currentFile } = await import("../src/utils");
      const result = currentFile();
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });
  });
});
