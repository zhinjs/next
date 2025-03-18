import './pollyfill'
import {EventEmitter} from 'events'
import log4js from "log4js";
import jsYaml from "js-yaml";
const {getLogger} = log4js
import {Plugin} from "./plugin";
import {ProcessMessage, QueueItem, WithPrefix} from "./types";
import path from "node:path";
import {display_path,watchFile, wrapExport} from "./utils";
import * as fs from "node:fs";
import {Bot} from "./bot";
import {RequestEvent,MessageEvent} from "./event";
export class App extends Plugin {
    options: App.Options = App.defaultOptions
    get adapterList(){
        return [...this.adapters.values()]
    }
    get pluginList(){
        const getChildPlugins=(plugin:Plugin):Plugin[]=>{
            return [plugin,...plugin.children.reduce((result:Plugin[], child:Plugin):Plugin[]=>{
                return result.concat(getChildPlugins(child))
            },[])]
        }
        return this.children.reduce((result:Plugin[], plugin:Plugin):Plugin[]=>{
            return result.concat(getChildPlugins(plugin))
        },[])
    }
    #queue:QueueItem[]=[]
    constructor(public options_path: string) {
        super({
            name:"Zhin",
            sourceFile:__filename
        })
        this.app=this;
        this.options = App.defineOptions(App.loadOptions(options_path))
        this.logger.level=this.options.log_level
        this.middleware(this.handleBotMessage.bind(this))
        this.on('init',this.#loadPlugins.bind(this,this.options.plugins))
        this.on('dispose',watchFile(options_path,this.#checkDiff.bind(this)))
        this.on('ready',this.#startAdapters.bind(this))
        this.on('message',Plugin.compose(this.middlewares))
        process.on('message',this.handleProcessMessage.bind(this))
    }
    async handleProcessMessage(data:ProcessMessage){
        switch (data.type){
            case 'queue':{
                this.#queue.push(data.body)
                break
            }
        }
    }
    async runAction(action:string,payload:any){
        switch (action){
            case 'sendMessage':{
                const {adapter,bot,content,...receiver}=payload
                return this.pickAdapter(adapter)
                    .pickBot(bot)
                    .sendMessage(receiver,content)
            }
        }
    }
    pickAdapter(name:string){
        const adapter=this.adapters.get(name)
        if(!adapter) throw new Error(`Adapter "${name}" not found`)
        return adapter
    }
    async handleBotMessage(event:MessageEvent){
        const directives=this.directives
        for(const directive of directives){
            try{
                const result=await directive.match(event.data,event)
                if(result){
                    event.reply(result)
                }
            }catch (e){
                event.reply((e as Error)?.message)
            }
        }
    }
    getLogger(category:string,name:string){
        const logger=name==='Zhin'?getLogger(`[${name}]`):getLogger(`[${category}:${name}]`)
        logger.level=this.options.log_level
        return logger
    }
    use(plugin:Plugin){
        return this.plugin(plugin.name,plugin)

    }
    async init() {
        const listeners = this.listeners('init')
        await Promise.all(listeners.map(listener=>listener(this)))
    }
    async #startAdapters(){
        return Promise.all(this.adapterList.map(adapter=>adapter.start(this)))
    }
    async #checkDiff(){
        this.logger.info(`${display_path(this.options_path)} changed, updating...`)
        const newOptions=App.defineOptions(App.loadOptions(this.options_path))
        this.logger.level=this.options.log_level
        const addPlugin=newOptions.plugins.filter(plugin=>!this.options.plugins.includes(plugin))
        await this.#loadPlugins(addPlugin)
        const removePlugin=this.options.plugins.filter(plugin=>!newOptions.plugins.includes(plugin))
        await this.#unloadPlugins(removePlugin)
        const listeners = this.listeners('ready')
        await Promise.all(listeners.map(listener=>listener(this)))
    }
    async start() {
        await this.init()
        const listeners = this.listeners('ready')
        await Promise.all(listeners.map(listener=>listener(this)))
        for(const queue of this.#queue){
            const {action,payload}=queue
            return this.runAction(action,payload)
        }
        process.on('SIGINT', async () => {
            await this.stop()
            process.exit(0)
        })
    }
    async stop(){
        const listeners = this.listeners('dispose')
        await Promise.all(listeners.map(listener=>listener(this)))
    }
    async #loadPlugins(plugins:string[]) {
        for (let name of plugins) {
            const plugin=await this.loadPlugin(name)
            this.plugin(plugin?.name||name,plugin as Partial<Plugin.Options>)
        }
    }
    async #unloadPlugins(plugins:string[]) {
        return Promise.all(plugins.map(name=>this.unplugin(name)))
    }
    async #loadPlugin(pluginPath:string){
        return wrapExport(await import(`${pluginPath}?v=${Date.now()}`))
    }
    async loadPlugin(name:string):Promise<Plugin|Partial<Plugin.Options>> {
        const maybePath = [
            ...this.options.plugin_dirs.map(p=>path.join(path.resolve(process.cwd(),p),name)),
            path.join(App.builtinPluginsDir, name),
            path.join(App.modulesPluginsDir, name)
        ]
        try{
            return await Promise.any(maybePath.map(path=>this.#loadPlugin(path)))
        }catch {}
        throw new Error(`plugin "${name}" not found`)
    }
    onReady(callback: (app:App) => void) {
        this.on('ready', callback)
        return this;
    }
}

export interface App extends EventEmitter{
    on<T extends keyof App.Lifecycle>(event: T, callback: App.Lifecycle[T]): this;

    on<S extends Exclude<string | symbol, keyof App.Lifecycle>>(event: S, callback: Function): this;

    addListener<T extends keyof App.Lifecycle>(event: T, callback: App.Lifecycle[T]): this;

    addListener<S extends Exclude<string | symbol, keyof App.Lifecycle>>(event: S, callback: Function): this;

    emit<T extends keyof App.Lifecycle>(event: T, ...args: Parameters<App.Lifecycle[T]>): boolean;

    emit<S extends Exclude<string | symbol, keyof App.Lifecycle>>(event: S, ...args: any[]): boolean;

    off<T extends keyof App.Lifecycle>(event: T, callback: App.Lifecycle[T]): this;

    off<S extends Exclude<string | symbol, keyof App.Lifecycle>>(event: S, callback: Function): this;
}

export namespace App {
    export interface Lifecycle extends WithPrefix<Plugin.Lifecycle, 'plugin'> {
        init(app:App): void;
        ready(app: App): void;
        dispose(app: App): void;
        message<K extends keyof Adapters>(event: MessageEvent<K>): void;
        request<K extends keyof Adapters>(event: RequestEvent<K>): void;
    }

    export const defaultOptions: Options = {
        log_level: 'info',
        adapters:[],
        plugin_dirs: [
            path.join(process.cwd(), 'plugins')
        ],
        bots:[],
        plugins: []
    }

    export function defineOptions(options: Partial<Options>): Options {
        return {
            log_level: options.log_level || defaultOptions.log_level,
            adapters: options.adapters || defaultOptions.adapters,
            plugins: options.plugins || defaultOptions.plugins,
            plugin_dirs: options.plugin_dirs || defaultOptions.plugin_dirs,
            bots:options.bots||defaultOptions.bots
        }
    }


    export type Options = {
        log_level: Plugin.LogLevel
        adapters: string[]
        plugins: string[]
        bots:Bot.Options[]
        plugin_dirs: string[];
    }
    export const defaultOptionsPath = path.join(process.cwd(), 'zhin.config.yml')
    export const builtinPluginsDir = path.join(__dirname, 'plugins')
    export const modulesPluginsDir = path.join(process.cwd(), 'node_modules')

    export function loadOptions(file: string): Partial<Options> {
        if (/\.ya?ml$/.test(file)) return jsYaml.load(fs.readFileSync(file).toString()) as Partial<Options>
        if (/\on$/.test(file)) return JSON.parse(fs.readFileSync(file, 'utf8'))
        throw new Error(`Unsupported options file format: ${file}`)
    }
    export function saveOptions(options: Partial<Options>, file: string) {
        if (/\.ya?ml$/.test(file)) return fs.writeFileSync(file, jsYaml.dump(options))
        if (/\on$/.test(file)) return fs.writeFileSync(file, JSON.stringify(options, null, 2))
        throw new Error(`Unsupported options file format: ${file}`)
    }
    export interface Adapters{
    }
    export interface Bots{

    }
}

export function createApp(input: Partial<App.Options> | string=App.defaultOptionsPath): App {
    const options=typeof input==='string'?App.loadOptions(input):input
    const optionsPath=typeof input==='string'?input:App.defaultOptionsPath
    if(typeof input!=='string') App.saveOptions(options,App.defaultOptionsPath)
    return new App(optionsPath)
}
