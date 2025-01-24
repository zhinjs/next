import {EventEmitter} from "events";
import {Constructor} from "./types";
import log4js, {Logger} from "log4js";
import {currentFile, watchFile} from "./utils";
import {Directive} from "@zhinjs/directive";
import {App} from "./app";
import {Bot} from "./bot";
import {Adapter} from "./adapter";
import {MessageEvent} from "./event";

export const PluginFlag="__ZHIN_PLUGIN__"
export class Plugin extends EventEmitter{
    [PluginFlag] = true
    #options:Plugin.Options
    parent:Plugin|null=null
    private _app:App|null=null
    get adapters(){
        return this.#adapters
    }
    #adapters:Map<string,Adapter>=new Map<string, Adapter>()
    logger:Logger=log4js.getLogger(this.name)
    directives:Directive[]=[]
    get app(){
        return this._app
    }
    set app(value:App|null){
        this._app=value
        this.logger=this.app?.getLogger('Cmp',this.name)||this.logger
    }
    adapter<K extends keyof App.Adapters>(name:K,adapter:Adapter<K>){
        if(this.#adapters.has(name)) throw new Error(`Adapter "${name}" already exists`)
        this.#adapters.set(name,adapter as Adapter)
        this.logger.info(`Adapter "${name}" registered`)
        return this
    }
    children:Plugin[]=[]
    get flatChildren(){
        return this.children.reduce((result:Plugin[], plugin:Plugin):Plugin[]=>{
            return result.concat(plugin.flatChildren)
        },this.children)
    }
    middlewares:Plugin.Middleware[]=[]
    get name():string{
        return [this.parent?.name,this.#options?.name]
            .filter(Boolean)
            .filter((name)=>name!=='Zhin')
            .join('/')||'Zhin'
    }
    get sourceFile(){
        return this.#options.sourceFile
    }
    set sourceFile(value:string){
        this.#options.sourceFile=value
    }
    constructor(sourceFile:string)
    constructor(options:Partial<Plugin.Options>)
    constructor(input:string|Partial<Plugin.Options>){
        super()
        this.#options={
            name:`Plugin-${Math.random().toString(36).slice(2)}`,
            sourceFile:currentFile(),
            directives:[],
            adapters:{},
            plugins:{},
            ...(typeof input==='string'?{
                sourceFile:input,
            }:input)
        }
        for(const name in this.#options.adapters){
            const Construct=this.#options.adapters[name as keyof App.Adapters]
            if(!Construct) continue
            this.adapter(name as keyof App.Adapters,new Construct())
        }
        for(const directive of this.#options.directives){
            this.directive(directive)
        }
        for(const plugin in this.#options.plugins){
            this.plugin(plugin,this.#options.plugins[plugin])
        }
        this.on('message',this.#matchDirective.bind(this))
        if(this.#options.onMounted){
            this.on('mounted',this.#options.onMounted.bind(this))
        }
        if(this.#options.beforeUnmount){
            this.on('beforeUnmount',this.#options.beforeUnmount.bind(this))
        }
    }
    async #matchDirective<T extends keyof App.Adapters>(content:string,event:MessageEvent<T>){
        for(const directive of this.directives){
            try{
                const result=await directive.match(content,event)
                if(result) await event.reply(result)
            }catch (e){
                await event.reply((e as Error)?.message)
            }
        }
    }
    directive(name:string,result:string):this
    directive(name:string,handle:()=>Directive.Awaitable<string|undefined>):this
    directive(directive:Directive):this
    directive(...[input,handle]:[Directive]|[string,string|(()=>Directive.Awaitable<string|undefined>)]){
        const directive=typeof input==='string'?new Directive(input):input
        if(handle) directive.handle(typeof handle==='string'?()=>handle:handle)
        this.directives.push(directive)
        this.logger.info(`Directive "${directive.name}" added`)
        return this
    }
    emit<S extends Exclude<string | symbol, keyof Plugin.Lifecycle>>(eventName: S, ...args: any[]): boolean
    emit<K extends keyof Plugin.Lifecycle>(eventName: K, ...args:Parameters<Plugin.Lifecycle[K]>): boolean
    emit(eventName: any, ...args: any[]){
        const result=super.emit(eventName,...args)
        for(const plugin of this.children){
            plugin.emit(eventName,...args)
        }
        return result
    }
    middleware(middleware:Plugin.Middleware){
        this.middlewares.push(middleware)
        return this
    }
    plugin(name:string,plugin:Plugin):this
    plugin(name:string,options:Partial<Plugin.Options>):this
    plugin(name:string):Plugin|undefined
    plugin(name:string,entry?:Plugin|Partial<Plugin.Options>){
        if(!entry) return this.children.find((p)=>p.name===name)
        const plugin=Plugin.isPlugin(entry)?entry:new Plugin(entry)
        plugin.app=this.app;
        plugin.parent=this;
        this.children.push(plugin)
        plugin.emit('mounted')
        this.logger.info(`Plugin "${plugin.name}" mounted`)
        const dispose=watchFile(plugin.sourceFile,async ()=>{
            await this.reload(plugin)
        })
        this.once('beforeUnmount',dispose)
        return this
    }
    async unplugin(name:string){
        const plugin=this.children.find((p)=>p.name===name)
        if(!plugin) return
        plugin.dispose()
        this.children=this.children.filter((p)=>p!==plugin)
    }
    async reload(plugin:Plugin){
        if(!this.children.includes(plugin)) return
        this.logger.info(`Reloading Plugin "${plugin.name}"`)
        plugin.dispose()
        this.children=this.children.filter((p)=>p!==plugin)
        const importedModule=await import(`${plugin.sourceFile}?t=${Date.now()}`)
        const newPlugin=importedModule.default||importedModule
        this.plugin(newPlugin.name,newPlugin)
    }
    dispose(){
        this.emit('beforeUnmount')
    }
}
export interface Plugin{
    on<T extends keyof Plugin.Lifecycle>(event:T, listener:Plugin.Lifecycle[T]):this;
    on<S extends Exclude<string | symbol, keyof Plugin.Lifecycle>>(event:S, listener:Function):this;
    addListener<T extends keyof Plugin.Lifecycle>(event:T, listener:Plugin.Lifecycle[T]):this;
    addListener<S extends Exclude<string | symbol, keyof Plugin.Lifecycle>>(event:S, listener:Function):this;
    emit<T extends keyof Plugin.Lifecycle>(event:T, ...args:Parameters<Plugin.Lifecycle[T]>):boolean;
    emit<S extends Exclude<string | symbol, keyof Plugin.Lifecycle>>(event:S, ...args:any[]):boolean;
    off<T extends keyof Plugin.Lifecycle>(event:T, listener:Plugin.Lifecycle[T]):this;
    off<S extends Exclude<string | symbol, keyof Plugin.Lifecycle>>(event:S, listener:Function):this;
}
export function definePlugin(options:Partial<Plugin.Options>={}):Plugin{
    return new Plugin({
        ...options,
        sourceFile:currentFile(2),
    })
}
export namespace Plugin{
    export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'mark' | 'off'
    export interface Options{
        sourceFile:string
        name:string;
        adapters:Plugin.Adapters
        plugins:Record<string, Plugin>
        directives:Directive<any,any,any>[]
        onMounted?:(this:Plugin)=>void;
        beforeUnmount?:(this:Plugin)=>void;
    }
    export type Adapters={
        [P in keyof App.Adapters]?:Constructor<Adapter<P>>
    }
    export type Middleware=(message:MessageEvent,next:(message:MessageEvent)=>void)=>void
    export interface Lifecycle{
        mounted(this:Plugin): void;
        message(message:MessageEvent,bot:Bot):void;
        beforeUnmount(this:Plugin): void;
    }
    export function isPlugin(input:any):input is Plugin{
        return input[PluginFlag]
    }
}
