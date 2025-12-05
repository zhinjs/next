import { describe, expect, it, vi } from "vitest";
import { Account, Receiver } from "../src/account";
import { Adapter } from "../src/adapter";
import { Hooks } from "../src/hooks";
import { Segment } from "../src/segment";

// 模拟账号类
class MockAccount implements Account {
  account_id: string;
  adapter: any;

  constructor(public options: any) {
    this.account_id = options.id || options.account_id || "test-account";
  }
  sendMessage(receiver: Receiver, content: Segment.Sendable): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async send(target: string, message: string) {
    return Promise.resolve();
  }

  async start() {
    return Promise.resolve();
  }

  async stop() {
    return Promise.resolve();
  }

  on = vi.fn();
  emit = vi.fn();
}

// 模拟适配器类
class MockAdapter extends Adapter<MockAccount> {
  constructor(config: any[]) {
    super("mock-adapter", config);
  }

  async createAccount(options: any): Promise<MockAccount> {
    return new MockAccount(options);
  }
}

describe("Adapter Coverage Tests", () => {
  describe("logger getter", () => {
    it("当未绑定 Hooks 时应该抛出错误", () => {
      const adapter = new MockAdapter([]);
      expect(() => adapter.logger).toThrow(
        "Adapter 未绑定 Hooks，无法获取 logger"
      );
    });

    it("当绑定 Hooks 后应该返回 logger", () => {
      const adapter = new MockAdapter([]);
      const hooks = new Hooks();
      adapter.binding = hooks;

      expect(() => adapter.logger).not.toThrow();
      expect(adapter.logger).toBeDefined();
    });
  });

  describe("事件转发", () => {
    it("message 事件应该转发到 binding.dispatch", async () => {
      const adapter = new MockAdapter([]);
      const hooks = new Hooks();
      adapter.binding = hooks;

      const dispatchSpy = vi.spyOn(hooks, "dispatch");

      // 触发 message 事件
      adapter.emit("message", { type: "text", content: "hello" });

      expect(dispatchSpy).toHaveBeenCalledWith("message", {
        type: "text",
        content: "hello",
      });
    });

    it("request 事件应该转发到 binding.dispatch", async () => {
      const adapter = new MockAdapter([]);
      const hooks = new Hooks();
      adapter.binding = hooks;

      const dispatchSpy = vi.spyOn(hooks, "dispatch");

      // 触发 request 事件
      adapter.emit("request", { type: "friend", user_id: "123" });

      expect(dispatchSpy).toHaveBeenCalledWith("request", {
        type: "friend",
        user_id: "123",
      });
    });

    it("当未绑定 Hooks 时事件不应该转发", async () => {
      const adapter = new MockAdapter([]);

      // 不应该抛出错误
      expect(() => {
        adapter.emit("message", { type: "text", content: "hello" });
      }).not.toThrow();
    });
  });

  describe("Adapter.Registry", () => {
    it("应该能够注册适配器工厂", () => {
      Adapter.register("test-adapter", MockAdapter);

      expect(Adapter.Registry.has("test-adapter")).toBe(true);
      expect(Adapter.Registry.get("test-adapter")).toBe(MockAdapter);
    });

    it("应该能够覆盖已注册的适配器", () => {
      class AnotherAdapter extends Adapter {
        constructor(config: any[]) {
          super("another", config);
        }
        async createAccount(options: any): Promise<Account> {
          return new MockAccount(options);
        }
      }

      Adapter.register("test-adapter", MockAdapter);
      Adapter.register("test-adapter", AnotherAdapter);

      expect(Adapter.Registry.get("test-adapter")).toBe(AnotherAdapter);
    });
  });
});
