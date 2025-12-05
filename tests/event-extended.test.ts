import { describe, expect, it } from "vitest";
import { Account, Receiver } from "../src/account";
import { Adapter } from "../src/adapter";
import { MessageEvent, RequestEvent } from "../src/event";
import { Segment } from "../src/segment";

class MockAccount implements Account {
  account_id = "test-123";
  adapter = {} as Adapter;

  async sendMessage(
    receiver: Receiver,
    content: Segment.Sendable
  ): Promise<void> {}
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
}

describe("Event Extended Coverage", () => {
  describe("MessageEvent.from", () => {
    it("应该能通过 from 方法创建 MessageEvent 并合并 sender 属性", () => {
      const mockAccount = new MockAccount();

      const sender = {
        from_type: "private",
        from_id: "456",
        from_name: "Test User",
        user_id: "user-123",
        user_name: "User Name",
      };

      const reply = async (message: any) => {
        return "msg-001";
      };

      const messageEvent = MessageEvent.from(
        mockAccount,
        sender,
        reply,
        "测试消息"
      );

      expect(messageEvent.account).toBe(mockAccount);
      expect(messageEvent.data).toBe("测试消息");
      expect(messageEvent.reply).toBe(reply);
      expect(messageEvent.user_id).toBe("user-123");
      expect(messageEvent.from_id).toBe("456");
      expect(messageEvent.from_type).toBe("private");
      expect(messageEvent.name).toBe("message");
    });
  });

  describe("RequestEvent.from", () => {
    it("应该能通过 from 方法创建 RequestEvent 并合并 sender 属性", () => {
      const mockAccount = new MockAccount();

      const sender = {
        from_type: "group",
        from_id: "group-789",
        from_name: "Test Group",
        user_id: "requester-123",
        user_name: "Requester Name",
      };

      const approve = async (approved: boolean) => {
        return approved;
      };

      const requestData = { type: "friend", comment: "加个好友" };

      const requestEvent = RequestEvent.from(
        mockAccount,
        sender,
        approve,
        requestData
      );

      expect(requestEvent.account).toBe(mockAccount);
      expect(requestEvent.data).toEqual(requestData);
      expect(requestEvent.approve).toBe(approve);
      expect(requestEvent.user_id).toBe("requester-123");
      expect(requestEvent.from_id).toBe("group-789");
      expect(requestEvent.from_type).toBe("group");
      expect(requestEvent.name).toBe("request");
    });
  });
});
