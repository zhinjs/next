import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AccountError,
  AdapterError,
  ConfigError,
  createError,
  ErrorCode,
  ErrorManager,
  formatError,
  isZhinError,
  MiddlewareError,
  PluginError,
  ZhinError,
} from "../src/error";

describe("错误处理系统", () => {
  beforeEach(() => {
    ErrorManager.clear();
  });

  describe("ZhinError 基类", () => {
    it("应该正确创建错误实例", () => {
      const error = new ZhinError("测试错误", "TEST_ERROR", { foo: "bar" });

      expect(error.message).toBe("测试错误");
      expect(error.code).toBe("TEST_ERROR");
      expect(error.details).toEqual({ foo: "bar" });
      expect(error.name).toBe("ZhinError");
    });

    it("应该能序列化为 JSON", () => {
      const error = new ZhinError("测试错误", "TEST_ERROR", { foo: "bar" });
      const json = error.toJSON();

      expect(json.name).toBe("ZhinError");
      expect(json.code).toBe("TEST_ERROR");
      expect(json.message).toBe("测试错误");
      expect(json.details).toEqual({ foo: "bar" });
      expect(json.stack).toBeDefined();
    });
  });

  describe("特定错误类型", () => {
    it("AdapterError 应该有正确的名称", () => {
      const error = new AdapterError("适配器错误", "ADAPTER_ERROR");
      expect(error.name).toBe("AdapterError");
      expect(error instanceof ZhinError).toBe(true);
    });

    it("PluginError 应该有正确的名称", () => {
      const error = new PluginError("插件错误", "PLUGIN_ERROR");
      expect(error.name).toBe("PluginError");
      expect(error instanceof ZhinError).toBe(true);
    });

    it("ConfigError 应该有正确的名称", () => {
      const error = new ConfigError("配置错误", "CONFIG_ERROR");
      expect(error.name).toBe("ConfigError");
      expect(error instanceof ZhinError).toBe(true);
    });

    it("AccountError 应该有正确的名称", () => {
      const error = new AccountError("账号错误", "ACCOUNT_ERROR");
      expect(error.name).toBe("AccountError");
      expect(error instanceof ZhinError).toBe(true);
    });

    it("MiddlewareError 应该有正确的名称", () => {
      const error = new MiddlewareError("中间件错误", "MIDDLEWARE_ERROR");
      expect(error.name).toBe("MiddlewareError");
      expect(error instanceof ZhinError).toBe(true);
    });
  });

  describe("ErrorCode 常量", () => {
    it("应该包含适配器相关错误代码", () => {
      expect(ErrorCode.ADAPTER_NOT_BOUND).toBe("ADAPTER_NOT_BOUND");
      expect(ErrorCode.ADAPTER_NOT_FOUND).toBe("ADAPTER_NOT_FOUND");
      expect(ErrorCode.ACCOUNT_NOT_FOUND).toBe("ACCOUNT_NOT_FOUND");
    });

    it("应该包含插件相关错误代码", () => {
      expect(ErrorCode.PLUGIN_NOT_FOUND).toBe("PLUGIN_NOT_FOUND");
      expect(ErrorCode.PLUGIN_LOAD_FAILED).toBe("PLUGIN_LOAD_FAILED");
    });

    it("应该包含配置相关错误代码", () => {
      expect(ErrorCode.CONFIG_INVALID_KEY).toBe("CONFIG_INVALID_KEY");
      expect(ErrorCode.CONFIG_LOAD_FAILED).toBe("CONFIG_LOAD_FAILED");
    });

    it("应该包含中间件相关错误代码", () => {
      expect(ErrorCode.MIDDLEWARE_NEXT_CALLED_MULTIPLE).toBe(
        "MIDDLEWARE_NEXT_CALLED_MULTIPLE"
      );
    });
  });

  describe("ErrorManager", () => {
    it("应该能注册错误处理器", () => {
      const handler = vi.fn();
      ErrorManager.onError(handler);

      const error = new Error("test");
      ErrorManager.handle(error);

      expect(handler).toHaveBeenCalledWith(error, undefined);
    });

    it("应该能注册多个错误处理器", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      ErrorManager.onError(handler1);
      ErrorManager.onError(handler2);

      const error = new Error("test");
      await ErrorManager.handle(error);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it("应该能传递错误上下文", async () => {
      const handler = vi.fn();
      ErrorManager.onError(handler);

      const error = new Error("test");
      const context = {
        source: "test",
        operation: "testOp",
        metadata: { foo: "bar" },
      };

      await ErrorManager.handle(error, context);

      expect(handler).toHaveBeenCalledWith(error, context);
    });

    it("应该能取消注册错误处理器", async () => {
      const handler = vi.fn();
      const unsubscribe = ErrorManager.onError(handler);

      unsubscribe();

      const error = new Error("test");
      await ErrorManager.handle(error);

      expect(handler).not.toHaveBeenCalled();
    });

    it("处理器抛出错误时不应该中断其他处理器", async () => {
      const handler1 = vi.fn(() => {
        throw new Error("handler1 error");
      });
      const handler2 = vi.fn();

      ErrorManager.onError(handler1);
      ErrorManager.onError(handler2);

      const error = new Error("test");
      await ErrorManager.handle(error);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it("应该能清除所有处理器", async () => {
      const handler = vi.fn();
      ErrorManager.onError(handler);

      ErrorManager.clear();

      const error = new Error("test");
      await ErrorManager.handle(error);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("ErrorManager.wrap", () => {
    it("应该包装异步函数并处理错误", async () => {
      const handler = vi.fn();
      ErrorManager.onError(handler);

      const error = new Error("test error");
      const fn = ErrorManager.wrap(async () => {
        throw error;
      });

      await expect(fn()).rejects.toThrow("test error");
      expect(handler).toHaveBeenCalledWith(error, undefined);
    });

    it("应该传递错误上下文", async () => {
      const handler = vi.fn();
      ErrorManager.onError(handler);

      const error = new Error("test error");
      const context = { source: "test", operation: "testOp" };
      const fn = ErrorManager.wrap(async () => {
        throw error;
      }, context);

      await expect(fn()).rejects.toThrow("test error");
      expect(handler).toHaveBeenCalledWith(error, context);
    });

    it("成功时不应该触发错误处理", async () => {
      const handler = vi.fn();
      ErrorManager.onError(handler);

      const fn = ErrorManager.wrap(async () => {
        return "success";
      });

      const result = await fn();
      expect(result).toBe("success");
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("ErrorManager.wrapSync", () => {
    it("应该包装同步函数并处理错误", () => {
      const handler = vi.fn();
      ErrorManager.onError(handler);

      const error = new Error("test error");
      const fn = ErrorManager.wrapSync(() => {
        throw error;
      });

      expect(() => fn()).toThrow("test error");
      expect(handler).toHaveBeenCalledWith(error, undefined);
    });

    it("成功时不应该触发错误处理", () => {
      const handler = vi.fn();
      ErrorManager.onError(handler);

      const fn = ErrorManager.wrapSync(() => {
        return "success";
      });

      const result = fn();
      expect(result).toBe("success");
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("工具函数", () => {
    it("createError 应该创建指定类型的错误", () => {
      const error = createError(AdapterError, "TEST_CODE", "测试消息", {
        foo: "bar",
      });

      expect(error).toBeInstanceOf(AdapterError);
      expect(error.code).toBe("TEST_CODE");
      expect(error.message).toBe("测试消息");
      expect(error.details).toEqual({ foo: "bar" });
    });

    it("isZhinError 应该正确识别 Zhin 错误", () => {
      const zhinError = new ZhinError("test", "TEST");
      const normalError = new Error("test");

      expect(isZhinError(zhinError)).toBe(true);
      expect(isZhinError(normalError)).toBe(false);
      expect(isZhinError("not an error")).toBe(false);
    });

    it("formatError 应该格式化 Zhin 错误", () => {
      const error = new ZhinError("测试错误", "TEST_ERROR", { foo: "bar" });
      const formatted = formatError(error);

      expect(formatted).toContain("[ZhinError]");
      expect(formatted).toContain("[TEST_ERROR]");
      expect(formatted).toContain("测试错误");
      expect(formatted).toContain("foo");
      expect(formatted).toContain("bar");
    });

    it("formatError 应该格式化普通错误", () => {
      const error = new Error("普通错误");
      const formatted = formatError(error);

      expect(formatted).toBe("[Error] 普通错误");
    });
  });
});
