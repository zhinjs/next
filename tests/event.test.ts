import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageEvent, RequestEvent } from "../src/event";

describe("Event", () => {
  describe("基础事件类", () => {
    it("应该正确创建消息事件", () => {
      const mockReply = vi.fn();
      const mockAccount = { adapter: { name: "test" } } as any;
      const event = new MessageEvent(mockAccount, "data", mockReply);
      expect(event.name).toBe("message");
      expect(event.data).toBe("data");
    });

    it("应该正确创建请求事件", () => {
      const mockApprove = vi.fn();
      const mockAccount = {} as any;
      const event = new RequestEvent(mockAccount, "data", mockApprove);
      expect(event.name).toBe("request");
      expect(event.data).toBe("data");
    });

    it("应该能够设置位置信息", () => {
      const mockReply = vi.fn();
      const mockAccount = { adapter: { name: "test" } } as any;
      const event = new MessageEvent(mockAccount, "data", mockReply);
      Object.assign(event, {
        from_id: "from-1",
        from_type: "channel",
        user_id: "user-1",
      });

      expect(event.from_id).toBe("from-1");
      expect(event.from_type).toBe("channel");
      expect(event.user_id).toBe("user-1");
    });
  });

  describe("MessageEvent", () => {
    let mockAccount: any;
    let mockReply: any;

    beforeEach(() => {
      mockReply = vi.fn().mockResolvedValue("message-id");
      mockAccount = {
        account_id: "bot-123",
        adapter: {
          name: "test-adapter",
        },
      };
    });

    it("应该正确创建消息事件", () => {
      const event = new MessageEvent(mockAccount, "hello", mockReply);

      expect(event.name).toBe("message");
      expect(event.data).toBe("hello");
      expect(event.adapter).toBeDefined();
      expect(event.account).toBe(mockAccount);
    });

    it("reply 应该调用 reply 函数", async () => {
      const event = new MessageEvent(mockAccount, "hello", mockReply);

      await event.reply("response");

      expect(mockReply).toHaveBeenCalledWith("response");
    });

    it("reply 应该支持字符串消息", async () => {
      const event = new MessageEvent(mockAccount, "hello", mockReply);

      await event.reply("simple message");

      expect(mockReply).toHaveBeenCalledWith("simple message");
    });

    it("应该能够访问适配器", () => {
      const event = new MessageEvent(mockAccount, "hello", mockReply);
      expect(event.adapter).toBe(mockAccount.adapter);
    });
  });

  describe("RequestEvent", () => {
    let mockAccount: any;
    let mockApprove: any;

    beforeEach(() => {
      mockApprove = vi.fn().mockResolvedValue(true);
      mockAccount = {
        account_id: "bot-123",
      };
    });

    it("应该正确创建请求事件", () => {
      const requestData = { type: "friend", user_id: "user-1" };
      const event = new RequestEvent(mockAccount, requestData, mockApprove);

      expect(event.name).toBe("request");
      expect(event.data).toEqual(requestData);
      expect(event.account).toBe(mockAccount);
    });

    it("approve 应该调用 approve 函数", async () => {
      const event = new RequestEvent(mockAccount, {}, mockApprove);

      await event.approve(true, "test reason");
      expect(mockApprove).toHaveBeenCalledWith(true, "test reason");
    });

    it("approve 函数应该是可调用的", () => {
      const event = new RequestEvent(mockAccount, {}, mockApprove);
      expect(typeof event.approve).toBe("function");
    });
  });
});
