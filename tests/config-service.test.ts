import * as fs from "fs";
import * as path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import { useService } from "../src/hooks";
import { ConfigLoader } from "../src/plugins/config";

describe("配置服务插件", () => {
  const testConfigPath = path.join(process.cwd(), "test-service.config.yml");

  beforeEach(() => {
    // 清理测试配置文件
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
    // 清理配置缓存
    ConfigLoader.map.clear();
  });

  describe("ConfigService", () => {
    it("应该能通过 useService 获取配置服务", () => {
      const service = useService("config");
      // Proxy 对象不是 instanceof，但应该能正常工作
      expect(service).toBeDefined();
      expect(typeof service.load).toBe("function");
      expect(typeof service.get).toBe("function");
    });

    it("应该能加载配置文件", () => {
      const service = useService("config");
      const loader = service.load("test-service.config", { foo: "bar" });

      expect(loader).toBeInstanceOf(ConfigLoader);
      expect(loader.data.foo).toBe("bar");
    });

    it("应该能获取配置值", () => {
      const service = useService("config");
      const value = service.get<{ test: string }>(
        "test",
        "value",
        "test-service.config"
      );

      expect(value).toBe("value");
    });

    it("应该支持嵌套路径", () => {
      interface TestConfig {
        database: {
          host: string;
          port: number;
        };
      }

      const service = useService("config");
      const host = service.get<TestConfig>(
        "database.host",
        "localhost",
        "test-service.config"
      );

      expect(host).toBe("localhost");
    });

    it("应该缓存配置加载器", () => {
      const service = useService("config");
      const loader1 = service.load("test-service.config", { foo: "bar" });
      const loader2 = service.load("test-service.config", { foo: "baz" });

      expect(loader1).toBe(loader2);
      expect(loader1.data.foo).toBe("bar"); // 不会被覆盖
    });

    it("应该能获取完整配置", () => {
      const service = useService("config");
      service.load("test.config", { test: "value" });
      const config = service.get();
      expect(config.test).toBe("value");
    });
  });

  describe("服务集成", () => {
    it("应该能在插件中使用配置服务", () => {
      const service = useService("config");

      // 模拟插件配置
      const dbConfig = service.get<{ timeout: number }>(
        "plugin.database.timeout",
        5000,
        "test-service.config"
      );

      expect(dbConfig).toBe(5000);
    });

    it("配置修改应该自动保存", () => {
      const service = useService("config");
      const loader = service.load("test-service.config", { foo: "bar" });

      loader.data.foo = "baz";

      // 重新读取文件验证
      const content = fs.readFileSync(testConfigPath, "utf-8");
      expect(content).toContain("baz");
    });

    it("应该支持环境变量替换", () => {
      process.env.TEST_VAR = "test-value";

      const service = useService("config");

      // 创建带环境变量的配置
      const testPath = "test-env.config";
      const fullPath = path.join(process.cwd(), `${testPath}.yml`);

      // 清理可能存在的文件
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      const loader = service.load(testPath, {
        value: "${TEST_VAR}",
      });

      // 通过 loader.data 访问会触发环境变量替换
      const value = loader.data.value;
      expect(value).toBe("test-value");

      // 清理
      fs.unlinkSync(fullPath);
      delete process.env.TEST_VAR;
    });
  });

  describe("类型安全", () => {
    it("应该提供类型推断", () => {
      interface AppConfig {
        port: number;
        host: string;
        database: {
          url: string;
        };
      }

      const service = useService("config");

      // TypeScript 应该能正确推断类型
      const port = service.get<AppConfig>("port", 3000, "test-service.config");
      const dbUrl = service.get<AppConfig>(
        "database.url",
        "localhost",
        "test-service.config"
      );

      expect(typeof port).toBe("number");
      expect(typeof dbUrl).toBe("string");
    });
  });

  describe("ConfigLoader", () => {
    it("应该能处理环境变量默认值语法", () => {
      const service = useService("config");
      const testPath = "test-env-default.config";
      const fullPath = path.join(process.cwd(), `${testPath}.yml`);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      // 确保环境变量不存在
      delete process.env.NON_EXISTENT_VAR;

      const loader = service.load(testPath, {
        withDefault: "${NON_EXISTENT_VAR:-default-value}",
        withoutDefault: "${NON_EXISTENT_VAR}",
        withColonOnly: "${NON_EXISTENT_VAR:fallback}",
      });

      // 测试默认值语法
      expect(loader.data.withDefault).toBe("default-value");
      expect(loader.data.withoutDefault).toBe("${NON_EXISTENT_VAR}");
      expect(loader.data.withColonOnly).toBe("fallback");

      // 清理
      fs.unlinkSync(fullPath);
    });

    it("应该能处理非字符串值", () => {
      const service = useService("config");
      const testPath = "test-types.config";
      const fullPath = path.join(process.cwd(), `${testPath}.yml`);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      const loader = service.load(testPath, {
        number: 123,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        object: { nested: "value" },
      });

      // 非字符串值应该原样返回
      expect(loader.data.number).toBe(123);
      expect(loader.data.boolean).toBe(true);
      expect(loader.data.null).toBe(null);
      expect(loader.data.array).toEqual([1, 2, 3]);
      expect(loader.data.object.nested).toBe("value");

      // 清理
      fs.unlinkSync(fullPath);
    });

    it("应该能处理深层嵌套对象", () => {
      const service = useService("config");
      const testPath = "test-nested.config";
      const fullPath = path.join(process.cwd(), `${testPath}.yml`);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      const loader = service.load(testPath, {
        level1: {
          level2: {
            level3: {
              value: "deep",
            },
          },
        },
      });

      // 测试深层访问
      expect(loader.data.level1.level2.level3.value).toBe("deep");

      // 修改深层值应该触发保存
      loader.data.level1.level2.level3.value = "modified";

      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).toContain("modified");

      // 清理
      fs.unlinkSync(fullPath);
    });
  });

  describe("ConfigLoader 工具函数", () => {
    it("getDataByPath 应该能获取嵌套数据", () => {
      const data = {
        a: {
          b: {
            c: "value",
          },
        },
      };

      const result = ConfigLoader.getDataByPath(data, "a.b.c");
      expect(result).toBe("value");
    });

    it("getDataByPath 应该处理不存在的路径", () => {
      const data = {
        a: {
          b: "value",
        },
      };

      const result = ConfigLoader.getDataByPath(data, "a.c.d" as any);
      expect(result).toBeUndefined();
    });

    it("getDataByPath 应该处理 undefined key", () => {
      const data = { foo: "bar" };
      const result = ConfigLoader.getDataByPath(data, undefined as any);
      expect(result).toEqual(data);
    });

    it("getDataByPath 应该拒绝非字符串 key", () => {
      const data = { foo: "bar" };
      expect(() => {
        ConfigLoader.getDataByPath(data, 123 as any);
      }).toThrow("配置键必须是字符串类型");
    });

    it("setDataByPath 应该能设置嵌套数据", () => {
      const data: any = {};

      ConfigLoader.setDataByPath(data, "a.b.c", "value");
      expect(data.a.b.c).toBe("value");
    });

    it("setDataByPath 应该能覆盖已存在的路径", () => {
      const data: any = {
        a: {
          b: "old",
        },
      };

      ConfigLoader.setDataByPath(data, "a.b", "new");
      expect(data.a.b).toBe("new");
    });

    it("setDataByPath 应该处理 undefined key", () => {
      const data: any = { foo: "bar" };
      ConfigLoader.setDataByPath(data, undefined as any, "value");
      expect(data.foo).toBe("bar"); // 不应该改变
    });

    it("setDataByPath 应该拒绝非字符串 key", () => {
      const data: any = {};
      expect(() => {
        ConfigLoader.setDataByPath(data, 123 as any, "value");
      }).toThrow("配置键必须是字符串类型");
    });

    it("setDataByPath 应该能创建中间对象", () => {
      const data: any = {};

      ConfigLoader.setDataByPath(data, "a.b.c.d", "value");
      expect(data.a.b.c.d).toBe("value");
    });
  });

  describe("ConfigService 生命周期", () => {
    it("clear 方法应该清除所有加载器", () => {
      const service = useService("config");

      service.load("clear-test1.config", { foo: "bar" });
      service.load("clear-test2.config", { baz: "qux" });

      expect(ConfigLoader.map.size).toBeGreaterThan(0);

      (service as any).clear();

      expect(ConfigLoader.map.size).toBe(0);
    });

    it("多次加载同一配置应该返回缓存实例", () => {
      const service = useService("config");
      const testPath = "cache-test.config";

      const loader1 = service.load(testPath, { foo: "bar" });
      const loader2 = service.load(testPath, { baz: "qux" });

      // 应该返回同一个实例
      expect(loader1).toBe(loader2);

      // 清理
      const fullPath = path.join(process.cwd(), `${testPath}.yml`);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });
  });

  describe("边界情况", () => {
    it("应该处理空配置文件", () => {
      const service = useService("config");
      const testPath = "empty.config";
      const fullPath = path.join(process.cwd(), `${testPath}.yml`);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      const loader = service.load(testPath, {});
      expect(loader.data).toEqual({});

      // 清理
      fs.unlinkSync(fullPath);
    });

    it("应该处理包含特殊字符的配置键", () => {
      const service = useService("config");
      const testPath = "special-chars.config";
      const fullPath = path.join(process.cwd(), `${testPath}.yml`);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      const loader = service.load(testPath, {
        "key-with-dash": "value1",
        key_with_underscore: "value2",
        "key.with.dots": "value3",
      });

      expect(loader.data["key-with-dash"]).toBe("value1");
      expect(loader.data["key_with_underscore"]).toBe("value2");
      expect(loader.data["key.with.dots"]).toBe("value3");

      // 清理
      fs.unlinkSync(fullPath);
    });

    it("应该处理循环引用的环境变量", () => {
      const service = useService("config");
      const testPath = "circular-env.config";
      const fullPath = path.join(process.cwd(), `${testPath}.yml`);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      // 设置环境变量
      process.env.VAR1 = "${VAR2}";
      process.env.VAR2 = "${VAR1}";

      const loader = service.load(testPath, {
        value: "${VAR1}",
      });

      // 应该返回环境变量的原始值（不进行递归替换）
      expect(loader.data.value).toBe("${VAR2}");

      // 清理
      fs.unlinkSync(fullPath);
      delete process.env.VAR1;
      delete process.env.VAR2;
    });

    it("应该处理默认值为空字符串的情况", () => {
      const service = useService("config");
      const testPath = "empty-default.config";
      const fullPath = path.join(process.cwd(), `${testPath}.yml`);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      delete process.env.EMPTY_VAR;

      const loader = service.load(testPath, {
        emptyDefault: "${EMPTY_VAR:-}",
      });

      expect(loader.data.emptyDefault).toBe("");

      // 清理
      fs.unlinkSync(fullPath);
    });

    it("应该处理 get 方法不同的参数组合", () => {
      const service = useService("config");
      const testPath = "get-variations.config";
      const fullPath = path.join(process.cwd(), `${testPath}.yml`);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      // 先加载配置
      service.load(testPath, {
        existing: "value",
        nested: { key: "nested-value" },
      });

      // 测试不同的 get 调用方式
      const val1 = service.get("existing", undefined, testPath);
      expect(val1).toBe("value");

      const val2 = service.get("nested.key", undefined, testPath);
      expect(val2).toBe("nested-value");

      // 测试不存在的键使用默认值
      const val3 = service.get("nonexistent", "default", testPath);
      expect(val3).toBe("default");

      // 清理
      fs.unlinkSync(fullPath);
    });

    it("应该处理 get 方法返回默认值结构", () => {
      const service = useService("config");
      const testPath = "default-structure.config";
      const fullPath = path.join(process.cwd(), `${testPath}.yml`);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      // 加载空配置
      service.load(testPath, {});

      // 获取不存在的嵌套键，应该创建默认值结构
      const defaultValue = service.get(
        "nested.deep.value",
        "default-value",
        testPath
      );

      expect(defaultValue).toBe("default-value");

      // 清理
      fs.unlinkSync(fullPath);
    });

    it("应该处理 get 方法 key 为 undefined 的情况", () => {
      const service = useService("config");
      const testPath = "undefined-key.config";
      const fullPath = path.join(process.cwd(), `${testPath}.yml`);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      // 加载配置
      service.load(testPath, { foo: "bar" });

      // key 为 undefined 应该返回整个配置对象
      const result = service.get(undefined as any, undefined, testPath);

      expect(result).toEqual({ foo: "bar" });

      // 清理
      fs.unlinkSync(fullPath);
    });

    it("应该处理配置文件不存在时创建默认配置", () => {
      const service = useService("config");
      const testPath = "auto-create.config";
      const fullPath = path.join(process.cwd(), `${testPath}.yml`);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      // 获取不存在的配置，应该自动创建
      const result = service.get("newKey", "default-value", testPath);

      // 应该返回默认值
      expect(result).toBe("default-value");

      // 文件应该被创建
      expect(fs.existsSync(fullPath)).toBe(true);

      // 清理
      fs.unlinkSync(fullPath);
    });

    it("应该处理配置文件不存在时创建嵌套默认配置", () => {
      const service = useService("config");
      const testPath = "auto-create-nested.config";
      const fullPath = path.join(process.cwd(), `${testPath}.yml`);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      // 获取深层嵌套的不存在的配置，应该自动创建
      const result = service.get(
        "level1.level2.level3",
        "nested-default",
        testPath
      );

      // 应该返回默认值
      expect(result).toBe("nested-default");

      // 文件应该被创建
      expect(fs.existsSync(fullPath)).toBe(true);

      // 验证创建的结构
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).toContain("level1");
      expect(content).toContain("level2");
      expect(content).toContain("level3");
      expect(content).toContain("nested-default");

      // 清理
      fs.unlinkSync(fullPath);
    });
  });
});
