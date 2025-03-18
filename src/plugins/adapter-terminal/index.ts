import {Adapter} from "../../adapter";
import {App} from "../../app";
import {Bot, Receiver} from "../../bot";
import {Segment} from "../../segment";
import {MessageEvent} from "../../event";
import {Logger} from "log4js";
import {definePlugin} from "../../plugin";

export class TerminalAdapter extends Adapter<'terminal'> {
    constructor() {
        super('terminal');
    }

    async createBot(options: App.Adapters['terminal']): Promise<Bot<'terminal'>> {
        return new TerminalBot(options)
    }
}
export class TerminalBot extends Bot<'terminal'> {
    logger?:Logger
    constructor(public options: App.Adapters['terminal']) {
        super('terminal',`${options.title}`, process);
        this.on('start',(app:App)=>{
            this.logger=app.getLogger('terminal',`${process.pid}`)
            this.internal.stdin.on('data',(data:Buffer)=>{
                const content=data.toString().trim()
                const event=new MessageEvent(this,content,async (msg)=>{
                    await this.sendMessage({
                        from_id: 'developer',
                        from_type: 'private',
                        user_id: `developer`,
                        user_name: this.options.title,
                        from_name: this.options.title
                    }, msg)
                    return ''
                })
                this.logger?.debug(`[private:developer] ${content}`)
                app.emit('message',event)
            })
            this.emit('ready',app)
        })
    }
    async sendMessage(receiver: Receiver, content: Segment.Sendable){
        this.logger?.debug(`[${receiver.from_type}:${receiver.from_id}] ${content}`)
        this.internal.stdout.write(`${content}\n`)
    }
}
declare module '../../app' {
    namespace App {
        interface Adapters {
            terminal:  {
                title: string
            }
        }
        interface Bots {
            terminal:typeof process
        }
    }
}
export default definePlugin({
    name:'adapter-terminal',
    adapters:{
        terminal:TerminalAdapter
    }
})
