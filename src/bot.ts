import {App} from "./app";
import {EventEmitter} from "events";
import {Event, MessageEvent, RequestEvent} from "./event";
import {Segment} from "./segment";
export type Receiver=Event.Location & Event.Operator
export abstract class Bot<T extends keyof App.Adapters = keyof App.Adapters> extends EventEmitter{
    protected constructor(public adapter:T, public id:string, public internal:App.Bots[T]){
        super()
    }
    abstract sendMessage(receiver:Receiver,content:Segment.Sendable):Promise<void>
    abstract reply<T=any>(event:T,segments:Segment[]):Promise<void>
    async start(app:App){
        return new Promise<void>((resolve, reject) => {
            const success=()=>{
                app.logger.info(`bot ${this.id} is ready`)
                this.off('error',error)
                resolve()
            }
            const error=(e:Error)=>{
                this.off('ready',success)
                reject(e)
            }
            this.once('ready',success)
            this.once('error',error)
            this.emit('start',app)
        })
    }
    async stop(app:App){
        return new Promise<void>((resolve, reject) => {
            const success=()=>{
                this.off('error',error)
                resolve()
            }
            const error=(e:Error)=>{
                this.off('stop',success)
                reject(e)
            }
            this.once('dispose',success)
            this.once('error',error)
            this.emit('stop',app)
        })
    }
}
export interface Bot<T extends keyof App.Adapters = keyof App.Adapters>{
    on<T extends keyof Bot.Lifecycle>(event: T, listener: Bot.Lifecycle[T]): this
    on(event: string | symbol, listener: (...args: any[]) => void): this
    addListener<T extends keyof Bot.Lifecycle>(event: T, listener: Bot.Lifecycle[T]): this
    addListener(event: string | symbol, listener: (...args: any[]) => void): this
    once<T extends keyof Bot.Lifecycle>(event: T, listener: Bot.Lifecycle[T]): this
    once(event: string | symbol, listener: (...args: any[]) => void): this
    off<T extends keyof Bot.Lifecycle>(event: T, listener: Bot.Lifecycle[T]): this
    off(event: string | symbol, listener: (...args: any[]) => void): this
    removeListener<T extends keyof Bot.Lifecycle>(event: T, listener: Bot.Lifecycle[T]): this
    removeListener(event: string | symbol, listener: (...args: any[]) => void): this

}
export namespace Bot{
    export type Options<T extends keyof App.Adapters = keyof App.Adapters>={
        adapter:T
    } & App.Adapters[T]
    export interface EventMap{
        message(event:MessageEvent):void
        request(event:RequestEvent):void
    }
    export interface Lifecycle extends EventMap{
        start(app:App):void
        stop(app:App):void
        ready(app:App):void
        dispose(app:App):void
        error(e:Error):void
        message(event:MessageEvent):void
        request(event:RequestEvent):void
    }
}
