import { Client, Config, segment as icqqSegment } from "@icqqjs/icqq";
import path from "node:path";
import { Account, Receiver } from "../account";
import { Adapter } from "../adapter";
import { MessageEvent, RequestEvent } from "../event";
import { segment, Segment } from "../segment";
// const plugin=useHooks();
function fromSegment(data: Segment.Sendable) {
  return icqqSegment.fromCqcode(segment.toString(Segment.format(data)));
}
declare module "../types" {
  interface Config {
    icqq?: IcqqOptions[];
  }
}
export interface IcqqOptions extends Config {
  uin: number;
  password?: string;
}
// @ts-ignore - 类型实例化过深但运行时正常
export class IcqqAccount extends Client implements Account<IcqqOptions> {
  #account: string;
  #password?: string;
  async sendMessage(
    receiver: Receiver,
    content: Segment.Sendable
  ): Promise<void> {
    switch (receiver.from_type) {
      case "group":
        await this.sendGroupMsg(
          Number(receiver.from_id),
          icqqSegment.fromCqcode(segment.toString(Segment.format(content)))
        );
        break;
      case "private":
        await this.sendPrivateMsg(
          Number(receiver.from_id),
          icqqSegment.fromCqcode(segment.toString(Segment.format(content)))
        );
        break;
    }
  }
  get account_id(): string {
    return this.#account;
  }
  constructor(
    public adapter: IcqqAdapter,
    public options: IcqqOptions
  ) {
    const { uin, password, ...other } = {
      ...defaultOptions,
      ...options,
    };
    super(options);
    this.#account = `${uin}`;
    this.#password = password;
  }
  async start(): Promise<void> {
    this.on("system.login.qrcode", (e) => {
      this.logger.info(`please scan the qrcode, then press enter`);
      process.stdin.once("data", () => {
        this.login();
      });
    });
    this.on("system.login.slider", (e) => {
      this.logger.info(
        `please get ticket from ${e.url}, press ticket to login`
      );
      process.stdin.once("data", (input) => {
        this.submitSlider(input.toString().trim());
      });
    });
    this.on("system.login.device", (e) => {
      this.logger.info(`please choose verify type:\n 1. sms code\n 2. url\n`);
      process.stdin.once("data", (input) => {
        if (input.toString().trim() === "1") {
          this.deviceVerifyBySms(e.phone);
        } else {
          this.deviceVerifyByUrl(e.url);
        }
      });
    });
    this.on("message", (event) => {
      const messageEvent = MessageEvent.from(
        this,
        {
          from_id: `${
            event.message_type === "group"
              ? event.group_id
              : event.sender.user_id
          }`,
          from_type: event.message_type,
          from_name:
            event.message_type === "group"
              ? event.group_name
              : event.sender.nickname,
          user_id: `${event.sender.user_id}`,
          user_name: event.sender.nickname,
        },
        async (data) => {
          const result = await event.reply(fromSegment(data));
          return result.message_id;
        },
        event.toCqcode()
      );
      this.adapter.emit("message", messageEvent);
    });
    this.on("request", (event) => {
      const requestEvent = RequestEvent.from(
        this,
        {
          from_id: `${
            event.request_type === "group" ? event.group_id : event.user_id
          }`,
          from_type: event.request_type,
          from_name:
            event.request_type === "group" ? event.group_name : event.nickname,
          user_id: `${event.user_id}`,
          user_name: event.nickname,
        },
        event.approve.bind(event),
        event.seq
      );
      this.adapter.emit("request", requestEvent);
    });
    await this.login(Number(this.#account), this.#password);
    return new Promise<void>((resolve, reject) => {
      this.once("system.online", () => {
        this.logger.info(`account ${this.#account} started`);
        resolve();
      });
      this.once("system.error", (e) => reject(e));
    });
  }
  async stop() {
    // 清理所有事件监听器，防止内存泄露
    await this.terminate();
  }
  async deviceVerifyBySms(phone: string) {
    await this.sendSmsCode();
    this.logger.info(`please input the sms code which sent to ${phone}:`);
    process.stdin.once("data", (input) => {
      this.submitSmsCode(input.toString().trim());
    });
  }

  async deviceVerifyByUrl(url: string) {
    this.logger.info(`please open url ${url} to verify`);
    this.logger.info(`please press enter after verify`);
    process.stdin.once("data", () => {
      this.login();
    });
  }
}

export const defaultOptions: Partial<IcqqOptions> = {
  data_dir: path.join(process.cwd(), "data"),
};
export class IcqqAdapter extends Adapter<IcqqAccount> {
  constructor(accountList: IcqqOptions[] = []) {
    super("icqq", accountList);
  }
  async createAccount(options: IcqqOptions): Promise<IcqqAccount> {
    return new IcqqAccount(this, options);
  }
}
declare module "../hooks" {
  namespace Hooks {
    interface Adapters {
      icqq: typeof IcqqAdapter;
    }
  }
}
Adapter.register("icqq", IcqqAdapter);
