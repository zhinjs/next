import { Config, segment as icqqSegment, Client } from "@icqqjs/icqq";
import path from "node:path";
import { useConfig } from "../../config";
import { Account, Receiver } from "../../account";
import { Adapter } from "../../adapter";
import { segment, Segment } from "../../segment";
import { MessageEvent, RequestEvent } from "../../event";
import { usePlugin } from "../../plugin";
const plugin=usePlugin();
function fromSegment(data: Segment.Sendable) {
  return icqqSegment.fromCqcode(segment.toString(Segment.format(data)));
}
const accountList=useConfig('icqq.config',[] as IcqqOptions[]);
export interface IcqqOptions extends Config {
  uin: number;
  password?: string;
};
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
  get adapter(): "icqq" {
    return "icqq";
  }
  constructor(public options: IcqqOptions) {
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
      plugin.dispatch(
        "message",
        MessageEvent.from.call(
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
        )
      );
    });
    this.on("request", (event) => {
      plugin.dispatch(
        "request",
        RequestEvent.from.call(
          this,
          {
            from_id: `${
              event.request_type === "group" ? event.group_id : event.user_id
            }`,
            from_type: event.request_type,
            from_name:
              event.request_type === "group"
                ? event.group_name
                : event.nickname,
            user_id: `${event.user_id}`,
            user_name: event.nickname,
          },
          event.approve.bind(event),
          event.seq
        )
      );
    });
    await this.login(Number(this.#account), this.#password);
    return new Promise<void>((resolve, reject) => {
      this.once("system.online", () => {
        plugin.logger.info(`account ${this.#account} started`);
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
    super('icqq',accountList);
  }
  async createAccount(options: IcqqOptions): Promise<IcqqAccount> {
    return new IcqqAccount(options);
  }
}
declare module "../../plugin" {
  namespace Plugin {
    interface Adapters {
      icqq: IcqqAdapter;
    }
  }
}
const adapter=new IcqqAdapter(accountList);
plugin.adapter(adapter,);