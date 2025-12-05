import { beforeEach, describe, expect, it } from "vitest";
import { Account, Receiver } from "../src/account";
import { Adapter } from "../src/adapter";
import { Hooks } from "../src/hooks";
import { Segment } from "../src/segment";

class MockAccount implements Account {
  account_id: string;
  adapter: any = "test";

  constructor(public options: any) {
    this.account_id = options.account_id || options.id || "test-account";
  }

  sendMessage(receiver: Receiver, content: Segment.Sendable): Promise<void> {
    return Promise.resolve();
  }

  async start() {}
  async stop() {}
}

class TestAdapter extends Adapter<MockAccount> {
  constructor(accounts: any[] = []) {
    super("test", accounts);
  }

  async createAccount(options: any): Promise<MockAccount> {
    return new MockAccount(options);
  }
}

describe("Hooks 额外测试", () => {
  let hooks: Hooks;

  beforeEach(() => {
    hooks = new Hooks("/test/plugin.ts");
  });

  describe("账号管理", () => {
    it("accounts getter 应该返回所有适配器的账号", async () => {
      const mockAdapter = new TestAdapter([{ account_id: "acc1" }]);
      hooks.adapter(mockAdapter);
      await hooks.start();

      const accounts = hooks.accounts;
      expect(accounts.length).toBe(1);
      expect(accounts[0].account_id).toBe("acc1");
    });

    it("adapters 应该包含所有注册的适配器", () => {
      const mockAdapter = new TestAdapter();
      hooks.adapter(mockAdapter);

      expect(hooks.adapters.has("test")).toBe(true);
      expect(hooks.adapters.get("test")).toBe(mockAdapter);
    });
  });

  describe("缓存管理", () => {
    it("accounts getter 应该缓存结果", async () => {
      const mockAdapter = new TestAdapter([{ account_id: "acc1" }]);
      hooks.adapter(mockAdapter);

      const accounts1 = hooks.accounts;
      const accounts2 = hooks.accounts;

      expect(accounts1).toBe(accounts2);
    });
  });

  describe("插件名称", () => {
    it("应该从文件路径提取插件名称", () => {
      const hooks1 = new Hooks("/path/to/my-plugin.ts");
      expect(hooks1.name).toBe("my-plugin");
    });

    it("应该处理不同的文件扩展名", () => {
      const hooks1 = new Hooks("/path/to/plugin.js");
      expect(hooks1.name).toBe("plugin");
    });

    it("应该缓存名称", () => {
      const name1 = hooks.name;
      const name2 = hooks.name;
      expect(name1).toBe(name2);
    });
  });

  describe("根节点", () => {
    it("应该获取根节点", () => {
      const parent = new Hooks("/parent.ts");
      const child = new Hooks("/child.ts", parent);
      const grandchild = new Hooks("/grandchild.ts", child);

      expect(grandchild.root).toBe(parent);
      expect(child.root).toBe(parent);
      expect(parent.root).toBe(parent);
    });
  });

  describe("文件路径", () => {
    it("应该存储文件路径", () => {
      const filePath = "/test/custom-plugin.ts";
      const customHooks = new Hooks(filePath);
      expect(customHooks.filePath).toBe(filePath);
    });
  });
});
