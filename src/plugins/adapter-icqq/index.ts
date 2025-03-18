import {Config,segment as icqqSegment,Client} from "@icqqjs/icqq";
import path from "node:path";
import {App} from "../../app";
import {Bot, Receiver} from "../../bot";
import {definePlugin} from "../../plugin";
import {Adapter} from "../../adapter";
import {segment, Segment} from "../../segment";
import {MessageEvent,RequestEvent} from "../../event";
function fromSegment(data:Segment.Sendable){
    return icqqSegment.fromCqcode(segment.toString(Segment.format(data)))
}
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
    constructor(public options: App.Adapters['icqq']) {
        const {account, password, ...other} = {
            ...defaultOptions, ...options
        }
        const client=new Client(other)
        super('icqq',account, client)
        this.#account=account
        this.#password = password
        this.on('start',this.online.bind(this))
        this.on('stop',this.offline.bind(this))
        this.once('ready',(app)=>{
            client.on('message',(event)=>{
                app.emit('message',MessageEvent.from.call(this,{
                    from_id: `${event.message_type==='group'?event.group_id:event.sender.user_id}`,
                    from_type:event.message_type,
                    from_name:event.message_type==='group'?event.group_name:event.sender.nickname,
                    user_id: `${event.sender.user_id}`,
                    user_name: event.sender.nickname,
                },async (data)=>{
                    const result= await event.reply(fromSegment(data))
                    return result.message_id
                },event.toCqcode()))
            })
            client.on('request',event=>{
                app.emit('request',RequestEvent.from.call(this,{
                    from_id: `${event.request_type==='group'?event.group_id:event.user_id}`,
                    from_type:event.request_type,
                    from_name:event.request_type==='group'?event.group_name:event.nickname,
                    user_id: `${event.user_id}`,
                    user_name: event.nickname,
                },event.approve.bind(event),event.seq))
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
export class IcqqAdapter extends Adapter<'icqq'>{
    constructor() {
        super('icqq');
    }
    async createBot(options: App.Adapters['icqq']): Promise<Bot<'icqq'>> {
        return new IcqqBot(options)
    }
}
export default definePlugin({
    name:'adapter-icqq',
    adapters:{
        icqq:IcqqAdapter
    }
})
declare module '../../app' {
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
