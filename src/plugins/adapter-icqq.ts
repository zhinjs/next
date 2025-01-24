import {App} from "../app";
import {Bot, Receiver} from "../bot";
import {Client, Config,segment as icqqSegment} from "@icqqjs/icqq";
import path from "node:path";
import {definePlugin} from "../plugin";
import {Adapter} from "../adapter";
import {segment, Segment} from "../segment";
import {MessageEvent,RequestEvent} from "../event";

export class IcqqBot extends Bot<'icqq'> {
    #account: string
    #password?: string
    async sendMessage(receiver: Receiver, content: Segment.Sendable): Promise<void> {
        switch (receiver.from_type){
            case "group":
                await this.internal.sendGroupMsg(Number(receiver.from_id),icqqSegment.fromCqcode(segment.toString(Segment.format(content))))
                break
            case "private":
                await this.internal.sendPrivateMsg(Number(receiver.from_id),icqqSegment.fromCqcode(segment.toString(Segment.format(content))))
                break
        }
    }
    async reply(event:any,segments:Segment[]){
        await event.reply(segment.toString(segments))
    }
    constructor(public options: App.Adapters['icqq']) {
        const {account, password, ...other} = {
            ...defaultOptions, ...options
        }
        super('icqq',account, new Client(other))
        this.#account=account
        this.#password = password
        this.on('start',this.online.bind(this))
        this.on('stop',this.offline.bind(this))
        this.on('ready',(app)=>{
            this.internal.on('message',(event)=>{
                app.emit('message',event.toCqcode(),new MessageEvent('icqq',this,event))
            })
            this.internal.on('request',event=>{
                app.emit('request',new RequestEvent('icqq',this,event))
            })
        })
    }
    get logger(){
        return this.internal.logger
    }

    offline(app:App) {
        this.internal.terminate()
        this.emit('dispose',app)
    }

    async online(app:App) {
        this.internal.once('system.online', this.emit.bind(this, 'ready',app))
        this.internal.once('system.error', this.emit.bind(this, 'error',app))
        this.internal.on('system.login.qrcode', (e) => {
            this.internal.logger.info(`please scan the qrcode, then press enter`)
            process.stdin.once('data', () => {
                this.internal.login()
            })
        })
        this.internal.on('system.login.slider', e => {
            this.internal.logger.info(`please get ticket from ${e.url}, press ticket to login`)
            process.stdin.once('data', (input) => {
                this.internal.submitSlider(input.toString().trim())
            })
        })
        this.internal.on('system.login.device', (e) => {
            this.logger.info(`please choose verify type:\n 1. sms code\n 2. url\n`)
            process.stdin.once('data', (input) => {
                if (input.toString().trim() === '1') {
                    this.deviceVerifyBySms(e.phone)
                } else {
                    this.deviceVerifyByUrl(e.url)
                }
            })
        })
        await this.internal.login(Number(this.#account), this.#password)
    }

    async deviceVerifyBySms(phone: string) {
        await this.internal.sendSmsCode()
        this.logger.info(`please input the sms code which sent to ${phone}:`)
        process.stdin.once('data', (input) => {
            this.internal.submitSmsCode(input.toString().trim())
        })
    }

    async deviceVerifyByUrl(url: string) {
        this.logger.info(`please open url ${url} to verify`)
        this.logger.info(`please press enter after verify`)
        process.stdin.once('data', () => {
            this.internal.login()
        })
    }
}

export const defaultOptions: Partial<App.Adapters['icqq']> = {
    data_dir: path.join(process.cwd(), 'data')
}
export class IcqqAdapter extends Adapter{
    constructor() {
        super('icqq');
    }
    createBot(options: App.Adapters[keyof App.Adapters]): Bot<keyof App.Adapters> {
        return new IcqqBot(options);
    }
}
export default definePlugin({
    name:'adapter-icqq',
    adapters:{
        icqq:IcqqAdapter
    }
})
declare module '../app' {
    namespace App {
        interface Adapters {
            icqq: Omit<Config, 'log_level'> & {
                account: string
                password?: string
            }
        }
        interface Bots {
            icqq:Client
        }
    }
}
