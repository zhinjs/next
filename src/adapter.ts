import {App} from "./app";
import {Bot} from "./bot";

export abstract class Adapter<K extends keyof App.Adapters=keyof App.Adapters>{
    bots:Map<string,Bot>=new Map<string, Bot<K>>()
    get botList(){
        return [...this.bots.values()]
    }
    protected constructor(public name:K){}
    abstract createBot(options:App.Adapters[K]):Promise<Bot<K>>
    pickBot(account:string){
        const bot=this.bots.get(account)
        if(!bot) throw new Error(`bot ${account} not found`)
        return bot
    }
    async start(app:App){
        app.logger.info(`starting adapter ${this.name}`)
        const botsOptions=app.options.bots.filter(o=>o.adapter===this.name)
        return Promise.all(botsOptions.map(options=>this.startBot(options as unknown as Bot.Options<K>,app)))
    }
    async stop(app:App){
        return Promise.all(this.botList.map(async (bot)=>{
            await bot.stop(app)
            this.removeBot(bot.id)
        }))
    }
    async startBot(options:App.Adapters[K],app:App):Promise<Bot<K>>{
        const bot=await this.createBot(options)
        this.bots.set(bot.id,bot)
        return await bot.start(app) as Bot<K>
    }
    removeBot(account:string){
        this.bots.delete(account)
    }
}
export interface Adapter<K extends keyof App.Adapters=keyof App.Adapters>{
    on<T extends keyof Adapter.EventMap>(event: T, listener: Adapter.EventMap[T]): this
    on(event: string | symbol, listener: (...args: any[]) => void): this
    addListener<T extends keyof Adapter.EventMap>(event: T, listener: Adapter.EventMap[T]): this
    addListener(event: string | symbol, listener: (...args: any[]) => void): this
    once<T extends keyof Adapter.EventMap>(event: T, listener: Adapter.EventMap[T]): this
    once(event: string | symbol, listener: (...args: any[]) => void): this
    off<T extends keyof Adapter.EventMap>(event: T, listener: Adapter.EventMap[T]): this
    off(event: string | symbol, listener: (...args: any[]) => void): this
    removeListener<T extends keyof Adapter.EventMap>(event: T, listener: Adapter.EventMap[T]): this
    removeListener(event: string | symbol, listener: (...args: any[]) => void): this
}
export namespace Adapter{
    export interface EventMap{
    }
}
