import { Segment} from "./segment";
import {App} from "./app";
import {Bot} from "./bot";
export namespace Event{
    export interface Location{
        from_type: 'group'|'private',
        from_id: string,
        from_name: string,

    }
    export interface Operator{
        user_id: string,
        user_name: string,
        role?: 'owner'|'master'|'general'
    }
}
export abstract class Event<T extends string,D=any>{
    protected constructor(
        public name:T,
        public data:D
        ) {
    }
}
export class MessageEvent<A extends keyof App.Adapters=keyof App.Adapters,D=any> extends Event<'message',D>{
    constructor(public adapter:A,public bot:Bot<A>,data:D){
        super('message',data)
    }
    reply(content:Segment.Sendable){
        return this.bot.reply(this.data, Segment.format(content))
    }
}
export class RequestEvent<A extends keyof App.Adapters=keyof App.Adapters,D=any,B=Bot<A>> extends Event<'request',D>{
    constructor(public adapter:A,public bot:B,data:D){
        super('request',data)
    }
}
