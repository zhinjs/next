import { EventEmitter } from "events";
import { Account } from "./account";
import { AccountError, AdapterError, ErrorCode } from "./error";
import { Hooks } from "./hooks";

export abstract class Adapter<
  A extends Account = Account,
> extends EventEmitter<Adapter.LifeCycle> {
  accounts: Map<string, A> = new Map<string, A>();
  #cachedAccountList?: A[];
  #accountsDirty = true;
  public binding?: Hooks;
  get logger() {
    if (!this.binding) {
      throw new AdapterError(
        "Adapter 未绑定 Hooks，无法获取 logger",
        ErrorCode.ADAPTER_NOT_BOUND,
        { adapterName: this.name }
      );
    }
    return this.binding.logger;
  }
  get accountList() {
    if (!this.#accountsDirty && this.#cachedAccountList)
      return this.#cachedAccountList;
    this.#cachedAccountList = Array.from(this.accounts.values());
    this.#accountsDirty = false;
    return this.#cachedAccountList;
  }
  protected constructor(
    public name: string,
    public config: Account.IOptions<A>[]
  ) {
    super();
    this.on("message", (...args) => {
      this.binding?.dispatch("message", ...args);
    });
    this.on("request", (...args) => {
      this.binding?.dispatch("request", ...args);
    });
  }
  abstract createAccount(options: Account.IOptions<A>): Promise<A>;
  pickAccount(account: string) {
    const acc = this.accounts.get(account);
    if (!acc) {
      throw new AccountError(
        `账号 ${account} 未找到`,
        ErrorCode.ACCOUNT_NOT_FOUND,
        { accountId: account, adapterName: this.name }
      );
    }
    return acc;
  }
  async start() {
    for (const config of this.config) {
      const account = await this.createAccount(config);
      this.accounts.set(account.account_id, account);
      this.#accountsDirty = true;
      await account.start();
    }
  }
  async stop() {
    const stopPromises = this.accountList.map(async (account) => {
      await account.stop();
      this.removeAccount(account.account_id);
    });
    await Promise.all(stopPromises);
    // 清理所有引用
    this.accounts.clear();
  }
  removeAccount(account: string) {
    this.accounts.delete(account);
    this.#accountsDirty = true;
  }
}
export namespace Adapter {
  export const Registry = new Map<string, Factory>();
  export function register(name: string, factory: Factory<Adapter>) {
    Registry.set(name, factory);
  }
  export interface LifeCycle {
    message: [any];
    request: [any];
  }
  export type IAccount<T> = T extends Adapter<infer A> ? A : never;
  export type Factory<T extends Adapter = Adapter> = new (
    config: Account.IOptions<IAccount<T>>[]
  ) => T;
}
