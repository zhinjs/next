import { beforeEach, describe, expect, it } from "vitest";
import { Service } from "../src/service";

describe("Service 基类", () => {
  class TestService extends Service {
    readonly name = "test";
    public initCount = 0;
    public stopCount = 0;

    async start(): Promise<void> {
      await super.start();
      this.initCount++;
    }

    async stop(): Promise<void> {
      this.stopCount++;
      await super.stop();
    }
  }

  let service: TestService;

  beforeEach(() => {
    service = new TestService();
  });

  describe("生命周期管理", () => {
    it("应该正确初始化服务", async () => {
      expect(service.initialized).toBe(false);
      expect(service.disposed).toBe(false);

      await service.start();

      expect(service.initialized).toBe(true);
      expect(service.disposed).toBe(false);
      expect(service.initCount).toBe(1);
    });

    it("应该正确停止服务", async () => {
      await service.start();
      await service.stop();

      expect(service.initialized).toBe(false);
      expect(service.disposed).toBe(true);
      expect(service.stopCount).toBe(1);
    });

    it("不能重复初始化", async () => {
      await service.start();

      await expect(service.start()).rejects.toThrow(
        'Service "test" already initialized'
      );
    });

    it("不能在未初始化时停止", async () => {
      await expect(service.stop()).rejects.toThrow(
        'Service "test" not initialized'
      );
    });

    it("不能重复停止", async () => {
      await service.start();
      await service.stop();

      await expect(service.stop()).rejects.toThrow(
        'Service "test" already disposed'
      );
    });

    it("不能在已停止后再次启动", async () => {
      await service.start();
      await service.stop();

      await expect(service.start()).rejects.toThrow(
        'Service "test" already disposed'
      );
    });
  });

  describe("ensureInitialized", () => {
    class ProtectedService extends Service {
      readonly name = "protected";

      public testMethod() {
        this.ensureInitialized();
        return "success";
      }
    }

    it("应该在未初始化时抛出错误", () => {
      const svc = new ProtectedService();
      expect(() => svc.testMethod()).toThrow(
        'Service "protected" not initialized'
      );
    });

    it("应该在已初始化时正常执行", async () => {
      const svc = new ProtectedService();
      await svc.start();
      expect(svc.testMethod()).toBe("success");
    });

    it("应该在已停止时抛出错误", async () => {
      const svc = new ProtectedService();
      await svc.start();
      await svc.stop();
      expect(() => svc.testMethod()).toThrow(
        'Service "protected" already disposed'
      );
    });
  });
});
