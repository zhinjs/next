import path from "node:path";
import {fileURLToPath} from 'url'
import {ChildProcess, fork} from "node:child_process";
import {ProcessMessage, QueueItem} from "./types";
const currentExt=path.extname(fileURLToPath(import.meta.url))
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export class Zhin{
    processMap:Map<string,ChildProcess>=new Map<string, ChildProcess>()
    constructor(public config_path?:string) {
        this.handleAppProcessMessage=this.handleAppProcessMessage.bind(this)
    }
    get appProcess(){
        if(!this.processMap.has('zhin')) throw new Error('app process not exist')
        return this.processMap.get('zhin')!
    }
    queue:QueueItem[]=[]
    handleAppProcessMessage(message:ProcessMessage){
        const {body,type}=message
        switch (type) {
            case 'create_process':{
                const {key,entry,args}=body
                const child=this.#createChildProcess(key,entry,args)
                this.appProcess.send({
                    type:'create_process',
                    body:{
                        key,
                        pid:child.pid!
                    }
                })
                break;
            }
            case 'queue':{
                this.queue.push(body)
                break;
            }
        }
    }
    #createChildProcess(key:string,entry:string,args:string[]){
        if(this.processMap.has(key)) return this.processMap.get(key)!
        const child=fork(entry,args,{
            stdio:'inherit',
            env:{
                ...process.env,
                START_TIME:Date.now().toString(),
                RESTART_TIMES:'0'
            }
        })
        if(key!=='zhin'){
            child.on('message',(message:ProcessMessage)=>{
                const {type,body}=message
                this.appProcess.send({
                    type,
                    pid:child.pid,
                    body
                })
            })
        }
        this.processMap.set(key,child)
        return child
    }
    startAppProcess() {
        const appProcess=this.#createChildProcess('zhin',path.resolve(currentDir,`./worker${currentExt}`),[this.config_path||''].filter(Boolean))
        appProcess.on('message',this.handleAppProcessMessage)
        if(this.queue.length){
            this.queue.forEach(item=>{
                appProcess.send({
                    type:'queue',
                    body:item
                })
            })
            this.queue=[]
        }
        appProcess.on('exit', (code) => {
            switch (code) {
                case 0:
                    process.exit(0);
                    break;
                case 51:
                    this.processMap.delete('zhin')
                    this.startAppProcess();
                    break;
                default:
                    process.exit(code);
                    break;
            }
        });
    }
    async start(){
        this.startAppProcess()
    }
}
export function createZhin(config_path?:string){
    return new Zhin(config_path?path.resolve(config_path):undefined)
}
