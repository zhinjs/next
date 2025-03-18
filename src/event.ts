import { Segment} from "./segment";
import {App} from "./app";
import {Bot} from "./bot";
export namespace Event{
    export interface Location{
        from_type: string,
        from_id: string,
        from_name: string,

    }
    export interface Operator{
        user_id: string,
        user_name: string,
        role?: 'owner'|'master'|'general'
    }
}
export class Event<T extends string,D=any>{
    protected constructor(
        public name:T,
        public data:D
        ) {
    }
}
 export interface Event<T extends string,D=any> extends Event.Location,Event.Operator {}
export namespace Event{
    export interface Reply{
        (content:Segment.Sendable):Promise<string>
    }
    export interface Approve{
        (approve:boolean,reason?:string):Promise<boolean>
    }
}
export class MessageEvent<A extends keyof App.Adapters=keyof App.Adapters> extends Event<'message',string>{
    get adapter(){
        return this.bot.adapter
    }

    constructor(public bot:Bot<A>,data:string,public reply:Event.Reply){
        super('message',data)
    }
    static from<A extends keyof App.Adapters>(this:Bot<A>,sender:Event.Location & Event.Operator,reply:Event.Reply,content:string){
        const messageEvent = new MessageEvent(this,content,reply)
        Object.assign(messageEvent, sender)
        return messageEvent
    }
}
export class RequestEvent<A extends keyof App.Adapters=keyof App.Adapters,D=any,B=Bot<A>> extends Event<'request',D>{
    constructor(public bot:B,data:D,public approve:Event.Approve){
        super('request',data)
    }
    static from<A extends keyof App.Adapters>(this:Bot<A>,sender:Event.Location & Event.Operator,approve:Event.Approve,data:any){
        const requestEvent = new RequestEvent(this,data,approve)
        Object.assign(requestEvent, sender)
        return requestEvent
    }
}
