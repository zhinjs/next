import { Directive } from "@zhinjs/directive";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Account, Receiver } from "../src/account";
import { Adapter } from "../src/adapter";
import { Hooks, useHooks } from "../src/hooks";
import { Segment } from "../src/segment";

// 模拟账号类
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

describe("Hooks", () => {
  let hooks: Hooks;

  beforeEach(() => {
    hooks = new Hooks("/test/plugin.ts");
  });

  describe("基础功能", () => {
    it("应该正确创建 Hooks 实例", () => {
      expect(hooks).toBeInstanceOf(Hooks);
      expect(hooks.filePath).toBe("/test/plugin.ts");
    });

    it("应该有正确的 name", () => {
      const testHooks = new Hooks("/test/my-plugin/index.ts");
      expect(testHooks.name).toBe("my-plugin");
    });

    it("应该能够获取 root", () => {
      const child = new Hooks("/test/child.ts", hooks);
      expect(child.root).toBe(hooks);
      expect(hooks.root).toBe(hooks);
    });
  });

  describe("适配器管理", () => {
    it("应该能够注册适配器", () => {
      class TestAdapter extends Adapter<MockAccount> {
        constructor() {
          super("test-adapter", []);
        }
        async createAccount(options: any): Promise<MockAccount> {
          return new MockAccount(options);
        }
      }

      const mockAdapter = new TestAdapter();
      hooks.adapter(mockAdapter);
      expect(hooks.adapters.has("test-adapter")).toBe(true);
      expect(hooks.adapters.get("test-adapter")).toBe(mockAdapter);
    });
  });

  describe("指令系统", () => {
    it("应该能够注册简单字符串指令", () => {
      hooks.directive("test", "response");
      expect(hooks.directives.length).toBe(1);
      expect(hooks.directives[0].name).toBe("test");
    });

    it("应该能够注册函数指令", () => {
      const handler = vi.fn(() => "result");
      hooks.directive("func", handler);
      expect(hooks.directives.length).toBeGreaterThan(0);
    });

    it("应该能够注册 Directive 对象", () => {
      const directive = new Directive("cmd <arg>").handle(() => "ok");
      (hooks as any).directive(directive);
      expect(hooks.directives.some((d) => d === directive)).toBe(true);
    });
  });

  describe("中间件系统", () => {
    it("应该能够添加中间件", () => {
      const middleware = vi.fn((event, next) => next());
      hooks.middleware(middleware);
      expect(hooks.middlewares.length).toBeGreaterThan(0);
    });

    it("中间件应该按顺序执行", async () => {
      const order: number[] = [];

      hooks.middleware(async (event, next) => {
        order.push(1);
        await next();
        order.push(4);
      });

      hooks.middleware(async (event, next) => {
        order.push(2);
        await next();
        order.push(3);
      });

      const mockEvent = {
        data: "test",
        reply: vi.fn(),
      } as any;

      await new Promise<void>((resolve) => {
        hooks.on("message", () => {
          // 中间件执行完成后检查顺序
          setTimeout(() => {
            expect(order).toEqual([1, 2, 3, 4]);
            resolve();
          }, 10);
        });
        hooks.emit("message", mockEvent);
      });
    });
  });

  describe("生命周期", () => {
    it("应该支持 onMounted 钩子", async () => {
      const callback = vi.fn();
      hooks.onMounted(callback);

      await hooks.broadcast("mounted");
      expect(callback).toHaveBeenCalled();
    });

    it("应该支持 onDispose 钩子", () => {
      const callback = vi.fn();
      hooks.onDispose(callback);

      hooks.emit("dispose");
      expect(callback).toHaveBeenCalled();
    });

    it("broadcast 应该触发所有监听器", async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      hooks.on("mounted", callback1);
      hooks.on("mounted", callback2);

      await hooks.broadcast("mounted");

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it("broadcast 应该传播到子 Hooks", async () => {
      const child = new Hooks("/test/child.ts", hooks);
      hooks.children.push(child);

      const childCallback = vi.fn();
      child.on("mounted", childCallback);

      await hooks.broadcast("mounted");
      expect(childCallback).toHaveBeenCalled();
    });
  });

  describe("子 Hooks 管理", () => {
    it("应该能够添加子 Hooks", () => {
      const child = new Hooks("/test/child.ts", hooks);
      // 构造函数自动添加到 parent.children

      expect(hooks.children.length).toBe(1);
      expect(child.parent).toBe(hooks);
    });

    it("应该能够移除子 Hooks", () => {
      const child = new Hooks("/test/child.ts", hooks);
      (child as any)["#cachedName"] = "child";
      // 构造函数自动添加到 parent.children

      const removed = hooks.remove("child");

      expect(removed).toBe(child);
      expect(hooks.children.length).toBe(0);
    });

    it("移除不存在的 Hooks 应该抛出错误", () => {
      expect(() => hooks.remove("non-existent")).toThrow();
    });
  });

  describe("启动和停止", () => {
    it("应该能够启动", async () => {
      class TestAdapter extends Adapter<MockAccount> {
        constructor() {
          super("test", []);
        }
        async createAccount(options: any): Promise<MockAccount> {
          return new MockAccount(options);
        }
      }

      const mockAdapter = new TestAdapter();
      const startSpy = vi.spyOn(mockAdapter, "start");
      hooks.adapter(mockAdapter);
      await hooks.start();

      expect(startSpy).toHaveBeenCalled();
    });

    it("重复启动不应该重复执行", async () => {
      class TestAdapter extends Adapter<MockAccount> {
        constructor() {
          super("test", []);
        }
        async createAccount(options: any): Promise<MockAccount> {
          return new MockAccount(options);
        }
      }

      const mockAdapter = new TestAdapter();
      const startSpy = vi.spyOn(mockAdapter, "start");
      hooks.adapter(mockAdapter);
      await hooks.start();
      await hooks.start();

      expect(startSpy).toHaveBeenCalledTimes(1);
    });

    it("应该能够停止", async () => {
      class TestAdapter extends Adapter<MockAccount> {
        constructor() {
          super("test", []);
        }
        async createAccount(options: any): Promise<MockAccount> {
          return new MockAccount(options);
        }
      }

      const mockAdapter = new TestAdapter();
      const stopSpy = vi.spyOn(mockAdapter, "stop");
      hooks.adapter(mockAdapter);
      await hooks.start();
      hooks.stop();

      expect(stopSpy).toHaveBeenCalled();
    });

    it("停止时应该清理所有资源", async () => {
      hooks.directive("test", "test");
      hooks.middleware((e, n) => n());

      const child = new Hooks("/test/child.ts", hooks);
      hooks.children.push(child);

      await hooks.start();
      hooks.stop();

      // stop 会清理 children
      expect(hooks.children.length).toBe(0);
    });
  });

  describe("adapter 工厂模式", () => {
    it("应该能通过实例注册适配器", () => {
      class TestAdapter extends Adapter<MockAccount> {
        constructor() {
          super("test", []);
        }
        async createAccount(options: any): Promise<MockAccount> {
          return new MockAccount(options);
        }
      }

      const mockAdapter = new TestAdapter();
      hooks.adapter(mockAdapter);
      expect(hooks.adapters.get("test")).toBe(mockAdapter);
    });

    it("应该能通过构造函数+参数注册适配器", () => {
      class TestAdapter extends Adapter<MockAccount> {
        constructor(config: any[]) {
          super("factory-test", config);
        }
        async createAccount(options: any): Promise<MockAccount> {
          return new MockAccount(options);
        }
      }

      hooks.adapter(TestAdapter, [{ account_id: "test" }]);

      expect(hooks.adapters.has("factory-test")).toBe(true);
      const adapter = hooks.adapters.get("factory-test");
      expect(adapter).toBeInstanceOf(TestAdapter);
      expect(adapter?.config).toEqual([{ account_id: "test" }]);
    });

    it("应该能通过构造函数注册适配器（空参数）", () => {
      class EmptyAdapter extends Adapter<MockAccount> {
        constructor(config: any[]) {
          super("empty-test", config);
        }
        async createAccount(options: any): Promise<MockAccount> {
          return new MockAccount(options);
        }
      }

      hooks.adapter(EmptyAdapter, []);

      expect(hooks.adapters.has("empty-test")).toBe(true);
      const adapter = hooks.adapters.get("empty-test");
      expect(adapter?.config).toEqual([]);
    });
  });

  describe("缓存优化", () => {
    it("适配器缓存应该工作", () => {
      class TestAdapter extends Adapter<MockAccount> {
        constructor() {
          super("test", []);
        }
        async createAccount(options: any): Promise<MockAccount> {
          return new MockAccount(options);
        }
      }

      const mockAdapter = new TestAdapter();
      hooks.adapter(mockAdapter);

      const adapters1 = hooks.adapters;
      const adapters2 = hooks.adapters;

      // 应该返回相同的缓存对象
      expect(adapters1).toBe(adapters2);
    });

    it("添加适配器后缓存应该失效", () => {
      class TestAdapter1 extends Adapter<MockAccount> {
        constructor() {
          super("test1", []);
        }
        async createAccount(options: any): Promise<MockAccount> {
          return new MockAccount(options);
        }
      }
      class TestAdapter2 extends Adapter<MockAccount> {
        constructor() {
          super("test2", []);
        }
        async createAccount(options: any): Promise<MockAccount> {
          return new MockAccount(options);
        }
      }

      const mockAdapter1 = new TestAdapter1();
      const mockAdapter2 = new TestAdapter2();

      hooks.adapter(mockAdapter1);
      const adapters1 = hooks.adapters;

      hooks.adapter(mockAdapter2);
      const adapters2 = hooks.adapters;

      // 应该返回新的对象
      expect(adapters1).not.toBe(adapters2);
      expect(adapters2.size).toBe(2);
    });
  });
});

describe("useHooks", () => {
  it("应该创建新的 Hooks 实例", () => {
    const hooks1 = useHooks();
    const hooks2 = useHooks();

    // 每次调用都可能创建新实例（取决于调用上下文）
    expect(hooks1).toBeInstanceOf(Hooks);
    expect(hooks2).toBeInstanceOf(Hooks);
  });
});
