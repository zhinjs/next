import { Plugin } from "./plugin";
import { Account } from "./account";

export abstract class Adapter<A extends Account = Account> {
  accounts: Map<string, A> = new Map<string, A>();
  #cachedAccountList?: A[];
  #accountsDirty = true;
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
  ) {}
  abstract createAccount(options: Account.IOptions<A>): Promise<A>;
  pickAccount(account: string) {
    const acc = this.accounts.get(account);
    if (!acc) throw new Error(`account ${account} not found`);
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
  export interface EventMap {}
  export type Construct<T extends Adapter = Adapter> = new (
    config: Account.IOptions<IAccount<T>>[]
  ) => T;
  export type Creator<T extends Adapter> = (
    config: Account.IOptions<IAccount<T>>[]
  ) => T;
  export type IAccount<T> = T extends Adapter<infer A> ? A : never;
  export type Factory<T extends Adapter> = Construct<T> | Creator<T>;
  export function create<T extends Adapter>(
    factory: Factory<T>,
    ...args: Account.IOptions<IAccount<T>>[]
  ): T {
    if (
      typeof factory === "function" &&
      /^class\s/.test(Function.prototype.toString.call(factory))
    ) {
      return new (factory as Construct<T>)(args);
    } else {
      return (factory as Creator<T>)(args);
    }
  }
}
