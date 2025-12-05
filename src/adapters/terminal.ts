import EventEmitter from "events";
import { Account, Receiver } from "../account";
import { Adapter } from "../adapter";
import { MessageEvent } from "../event";
import { Segment } from "../segment";
export interface TerminalOptions {
  title: string;
}
// @ts-ignore - 类型实例化过深但运行时正常
export class TerminalAdapter extends Adapter<TerminalAccount> {
  constructor(accountList: TerminalOptions[] = []) {
    super("terminal", accountList);
  }

  async createAccount(options: TerminalOptions) {
    return new TerminalAccount(this, options);
  }
}
export class TerminalAccount
  extends EventEmitter
  implements Account<TerminalOptions>
{
  #dataHandler?: (data: Buffer) => void;
  #receiverCache?: Receiver; // 缓存 receiver 对象

  get account_id(): string {
    return `terminal-${process.pid}`;
  }
  constructor(
    public adapter: TerminalAdapter,
    public options: TerminalOptions
  ) {
    super();
    // 预创建 receiver 对象
    this.#receiverCache = {
      from_id: "developer",
      from_type: "private",
      user_id: "developer",
      user_name: this.options.title,
      from_name: this.options.title,
    };
  }
  async start(): Promise<void> {
    this.#dataHandler = (data: Buffer) => {
      const content = data.toString().trim();
      const event = new MessageEvent(this, content, async (msg) => {
        await this.sendMessage(this.#receiverCache!, msg);
        return "";
      });
      this.adapter.logger.info(`[private:developer] ${content}`);
      this.adapter.emit("message", event);
    };
    process.stdin.on("data", this.#dataHandler);
  }
  async stop(): Promise<void> {
    if (this.#dataHandler) {
      process.stdin.off("data", this.#dataHandler);
      this.#dataHandler = undefined;
    }
    this.removeAllListeners();
  }
  async sendMessage(receiver: Receiver, content: Segment.Sendable) {
    this.adapter.logger.debug(
      `[${receiver.from_type}:${receiver.from_id}] ${content}`
    );
    process.stdout.write(`${content}\n`);
  }
}
declare module "../hooks" {
  namespace Hooks {
    interface Adapters {
      terminal: typeof TerminalAdapter;
    }
  }
}
Adapter.register("terminal", TerminalAdapter);
