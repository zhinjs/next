import {createApp, wrapExport} from ".";
async function resolveAdapter(name:string){
    const tryDirPaths:string[]=[
        name,
        `./plugins/adapter-${name}`,
        `@zhinjs/adapter-${name}`,
        `zhin-adapter-${name}`,
    ]
    for(const path of tryDirPaths){
        try{
            return wrapExport(await import(path))
        }catch{}
    }
    throw new Error(`adapter "${name}" not found,maybe you need to install it`)
}
export default async function (adapters:string|string[]){
    if(typeof adapters==='string'){
        adapters=[adapters]
    }
    const app=createApp()
    for(const adapter of adapters){
        try{
            app.use(await resolveAdapter(adapter))
        }catch (e:unknown){
            app.logger.error((e as Error)?.message||e)
        }
    }
    app.start()
}
