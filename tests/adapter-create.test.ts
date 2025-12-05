import { beforeEach, describe, expect, it } from "vitest";
import { Account, Receiver } from "../src/account";
import { Adapter } from "../src/adapter";
import { Hooks } from "../src/hooks";
import { Segment } from "../src/segment";

class MockAccount implements Account {
  account_id: string;
  adapter: any = "test";

  constructor(public options: any) {
    this.account_id = options.id || "test-account";
  }

  sendMessage(receiver: Receiver, content: Segment.Sendable): Promise<void> {
    return Promise.resolve();
  }

  async start() {}
  async stop() {}
}

class TestAdapter extends Adapter<MockAccount> {
  constructor(config: any[]) {
    super("test", config);
  }

  async createAccount(options: any): Promise<MockAccount> {
    return new MockAccount(options);
  }
}

// 注册到全局 Registry
Adapter.register("test", TestAdapter);

describe("Adapter Factory Pattern", () => {
  let hooks: Hooks;

  beforeEach(() => {
    hooks = new (Hooks as any)("test-file.ts");
  });

  it("应该能通过实例注册适配器", () => {
    const adapter = new TestAdapter([{ id: "account1" }]);
    hooks.adapter(adapter);

    expect(hooks.adapters.has("test")).toBe(true);
    expect(hooks.adapters.get("test")).toBe(adapter);
  });

  it("应该能通过构造函数+参数注册适配器", () => {
    hooks.adapter(TestAdapter, [{ id: "account1" }]);

    expect(hooks.adapters.has("test")).toBe(true);
    const adapter = hooks.adapters.get("test");
    expect(adapter).toBeInstanceOf(TestAdapter);
    expect(adapter?.config).toEqual([{ id: "account1" }]);
  });

  it("应该能通过构造函数注册适配器（空参数）", () => {
    hooks.adapter(TestAdapter, []);

    expect(hooks.adapters.has("test")).toBe(true);
    const adapter = hooks.adapters.get("test");
    expect(adapter).toBeInstanceOf(TestAdapter);
    expect(adapter?.config).toEqual([]);
  });

  it("应该正确处理多个适配器", () => {
    class TestAdapter2 extends Adapter<MockAccount> {
      constructor(config: any[]) {
        super("test2", config);
      }
      async createAccount(options: any): Promise<MockAccount> {
        return new MockAccount(options);
      }
    }

    hooks.adapter(TestAdapter, [{ id: "account1" }]);
    hooks.adapter(TestAdapter2, [{ id: "account2" }]);

    expect(hooks.adapters.size).toBe(2);
    expect(hooks.adapters.has("test")).toBe(true);
    expect(hooks.adapters.has("test2")).toBe(true);
  });

  it("应该触发 adaptersDirty 标记", () => {
    const adapter1 = new TestAdapter([{ id: "account1" }]);
    hooks.adapter(adapter1);

    const adapters1 = hooks.adapters;

    hooks.adapter(TestAdapter, [{ id: "account2" }]);
    const adapters2 = hooks.adapters;

    // 由于 dirty 标记，应该返回新的 Map
    expect(adapters1).not.toBe(adapters2);
  });

  it("应该能通过字符串名称注册适配器", () => {
    hooks.adapter("test", [{ id: "test-account" }]);

    expect(hooks.adapters.has("test")).toBe(true);
    expect(hooks.adapters.get("test")).toBeInstanceOf(TestAdapter);
  });

  it("应该能通过字符串名称注册多个账号配置", () => {
    hooks.adapter("test", [{ id: "account1" }, { id: "account2" }]);

    const adapter = hooks.adapters.get("test");
    expect(adapter).toBeInstanceOf(TestAdapter);
    expect(adapter?.config).toEqual([{ id: "account1" }, { id: "account2" }]);
  });
});
