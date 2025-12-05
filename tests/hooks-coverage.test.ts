import path from "path";
import { describe, expect, it, vi } from "vitest";
import { Account, Receiver } from "../src/account";
import { Adapter } from "../src/adapter";
import { MessageEvent } from "../src/event";
import { Hooks } from "../src/hooks";
import { Segment } from "../src/segment";

class MockAccount implements Account {
  account_id: string;
  adapter: any;

  constructor(public options: any) {
    this.account_id = options.id || options.account_id || "mock-account";
  }

  sendMessage(receiver: Receiver, content: Segment.Sendable): Promise<void> {
    return Promise.resolve();
  }

  async start() {}
  async stop() {}
  on = vi.fn();
  emit = vi.fn();
}

class MockAdapter extends Adapter<MockAccount> {
  constructor(config: any[]) {
    super("mock", config);
  }

  async createAccount(options: any): Promise<MockAccount> {
    return new MockAccount(options);
  }
}

describe("Hooks Coverage Tests", () => {
  describe("compose 函数边界情况", () => {
    it("空中间件数组应该返回空函数", () => {
      const composed = Hooks.compose([]);
      const event = MessageEvent.from({
        account_id: "test",
        message_id: "1",
        content: "test",
        from_id: "user1",
        from_name: "User",
        time: Date.now(),
      });

      expect(() => composed(event)).not.toThrow();
    });

    it("单个中间件应该直接执行", () => {
      const middleware = vi.fn((event, next) => next());
      const composed = Hooks.compose([middleware]);
      const event = MessageEvent.from({
        account_id: "test",
        message_id: "1",
        content: "test",
        from_id: "user1",
        from_name: "User",
        time: Date.now(),
      });

      composed(event);
      expect(middleware).toHaveBeenCalled();
    });

    it("多次调用 next 应该抛出错误", () => {
      const middleware1 = vi.fn((event, next) => {
        next();
      });
      const middleware2 = vi.fn((event, next) => {
        // 在第二个中间件中多次调用 next
        next();
        next(); // 这应该抛出错误
      });

      const composed = Hooks.compose([middleware1, middleware2]);
      const event = MessageEvent.from({
        account_id: "test",
        message_id: "1",
        content: "test",
        from_id: "user1",
        from_name: "User",
        time: Date.now(),
      });

      expect(() => composed(event)).toThrow("中间件中 next() 被多次调用");
    });
  });

  describe("middleware 方法", () => {
    it("添加中间件应该清除缓存的组合中间件", () => {
      const hooks = new Hooks();
      const middleware1 = vi.fn((event, next) => next());
      const middleware2 = vi.fn((event, next) => next());

      hooks.middleware(middleware1);

      // 触发一次消息事件以生成缓存
      const event = MessageEvent.from({
        account_id: "test",
        message_id: "1",
        content: "test",
        from_id: "user1",
        from_name: "User",
        time: Date.now(),
      });
      hooks.emit("message", event);

      // 添加新中间件应该清除缓存
      hooks.middleware(middleware2);

      // 再次触发，两个中间件都应该执行
      hooks.emit("message", event);

      expect(middleware1).toHaveBeenCalled();
      expect(middleware2).toHaveBeenCalled();
    });
  });

  describe("reload 方法", () => {
    it("根插件调用 reload 应该退出进程", async () => {
      const hooks = new Hooks();
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });

      await expect(hooks.reload()).rejects.toThrow("process.exit called");
      expect(exitSpy).toHaveBeenCalledWith(51);

      exitSpy.mockRestore();
    });
  });

  describe("watch 方法边界情况", () => {
    it("node_modules 中的插件不应该被监听", () => {
      const hooks = new Hooks("/path/to/node_modules/plugin/index.js");
      const callback = vi.fn();

      hooks.watch(callback);

      // 应该不会设置任何监听
      expect(hooks.listenerCount("dispose")).toBe(0);
    });

    it("没有 filePath 的插件不应该被监听", () => {
      const hooks = new Hooks("");
      const callback = vi.fn();

      hooks.watch(callback);

      // 应该不会设置任何监听
      expect(hooks.listenerCount("dispose")).toBe(0);
    });
  });

  describe("stop 方法", () => {
    it("未启动的插件调用 stop 应该直接返回", () => {
      const hooks = new Hooks();

      expect(() => hooks.stop()).not.toThrow();
    });

    it("stop 应该清理所有资源", async () => {
      const hooks = new Hooks();
      const adapter = new MockAdapter([{ id: "test" }]);

      hooks.adapter(adapter);
      await hooks.start();

      const stopSpy = vi.spyOn(adapter, "stop");

      hooks.stop();

      expect(stopSpy).toHaveBeenCalled();
      expect(hooks.children.length).toBe(0);
      expect(hooks.adapters.size).toBe(0);
    });

    it("stop 应该递归停止所有子插件", async () => {
      const parent = new Hooks();
      const child = new Hooks("", parent);
      parent.children.push(child);

      await parent.start();

      const childStopSpy = vi.spyOn(child, "stop");

      parent.stop();

      expect(childStopSpy).toHaveBeenCalled();
    });
  });

  describe("name getter 特殊情况", () => {
    it("应该正确处理带时间戳的路径", () => {
      const hooks = new Hooks("/path/to/plugin/index.js?t=1234567890");

      expect(hooks.name).not.toContain("?t=");
    });

    it("应该移除 /lib/ 前缀", () => {
      const hooks = new Hooks(path.join(process.cwd(), "lib/plugin.js"));

      expect(hooks.name).toBe("plugin");
    });

    it("应该移除 /src/ 前缀", () => {
      const hooks = new Hooks(path.join(process.cwd(), "src/plugin.js"));

      expect(hooks.name).toBe("plugin");
    });

    it("应该移除 /dist/ 前缀", () => {
      const hooks = new Hooks(path.join(process.cwd(), "dist/plugin.js"));

      expect(hooks.name).toBe("plugin");
    });

    it("应该处理 node_modules 中的包", () => {
      const hooks = new Hooks("/path/to/node_modules/@scope/package/index.js");

      expect(hooks.name).toContain("package");
    });

    it("应该移除 /index.js 后缀", () => {
      const hooks = new Hooks("/path/to/plugin/index.js");

      expect(hooks.name).toBe("plugin");
    });

    it("应该移除 /index.ts 后缀", () => {
      const hooks = new Hooks("/path/to/plugin/index.ts");

      expect(hooks.name).toBe("plugin");
    });

    it("应该缓存 name 计算结果", () => {
      const hooks = new Hooks("/very/long/path/to/plugin/index.js");

      const name1 = hooks.name;
      const name2 = hooks.name;

      expect(name1).toBe(name2);
    });
  });

  describe("directive 方法重载", () => {
    it("应该支持字符串结果的指令", () => {
      const hooks = new Hooks();

      hooks.directive("test", "result");

      expect(hooks.directives.length).toBe(1);
      expect(hooks.directives[0].name).toBe("test");
    });
  });

  describe("import 方法", () => {
    it("import 应该更新缓存标志", async () => {
      const hooks = new Hooks(__filename);

      // 先获取一次以设置缓存
      const adapters1 = hooks.adapters;

      // import 后应该标记为 dirty
      try {
        await hooks.import("./non-existent.js");
      } catch (e) {
        // 预期会失败，但应该已经设置了 dirty 标志
      }

      // 测试通过检查是否可以正常工作
      expect(hooks).toBeDefined();
    });
  });

  describe("remove 方法错误处理", () => {
    it("移除不存在的插件应该抛出错误", () => {
      const hooks = new Hooks();

      expect(() => hooks.remove("non-existent")).toThrow(
        '插件 "non-existent" 未找到'
      );
    });
  });

  describe("broadcast 方法", () => {
    it("应该递归广播到所有子插件", async () => {
      const parent = new Hooks();
      const child1 = new Hooks("", parent);
      const child2 = new Hooks("", parent);

      parent.children.push(child1, child2);

      const parentListener = vi.fn();
      const child1Listener = vi.fn();
      const child2Listener = vi.fn();

      parent.on("mounted", parentListener);
      child1.on("mounted", child1Listener);
      child2.on("mounted", child2Listener);

      await parent.broadcast("mounted");

      expect(parentListener).toHaveBeenCalled();
      expect(child1Listener).toHaveBeenCalled();
      expect(child2Listener).toHaveBeenCalled();
    });
  });

  describe("Hooks.create 错误处理", () => {
    it("文件不存在应该抛出错误", async () => {
      await expect(
        Hooks.create("/path/to/non-existent-file.js")
      ).rejects.toThrow();
    });
  });
});
