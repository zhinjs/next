import { Adapter } from "../../adapter";
import { Account, Receiver } from "../../account";
import { usePlugin } from "../../plugin";
import { Segment } from "../../segment";
import { MessageEvent } from "../../event";
import EventEmitter from "events";
export interface TerminalOptions {
  title: string;
}
const plugin=usePlugin();
export class TerminalAdapter extends Adapter<TerminalAccount> {
  constructor(accountList: TerminalOptions[] = []) {
    super("terminal", accountList);
  }

  async createAccount(options: TerminalOptions) {
    return new TerminalAccount(options);
  }
}
export class TerminalAccount extends EventEmitter implements Account<TerminalOptions> {
  #dataHandler?: (data: Buffer) => void;
  #receiverCache?: Receiver; // 缓存 receiver 对象
  
  get account_id(): string {
    return `terminal-${process.pid}`;
  }
  get adapter(): "terminal" {
    return "terminal";
  }
  constructor(public options: TerminalOptions) {
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
        plugin.logger.info(`[private:developer] ${content}`);
        plugin.dispatch("message", event);
      };
      process.stdin.on("data", this.#dataHandler);
  }
  async stop(): Promise<void> {
    if(this.#dataHandler) {
      process.stdin.off("data", this.#dataHandler);
      this.#dataHandler = undefined;
    }
    this.removeAllListeners();
  }
  async sendMessage(receiver: Receiver, content: Segment.Sendable) {
    plugin.logger.debug(
      `[${receiver.from_type}:${receiver.from_id}] ${content}`
    );
    process.stdout.write(`${content}\n`);
  }
}
const adapter = new TerminalAdapter([{title: "Terminal Adapter" }]);
plugin.adapter(adapter);
declare module "../../plugin" {
  namespace Plugin {
    interface Adapters {
      terminal: TerminalAdapter;
    }
  }
}