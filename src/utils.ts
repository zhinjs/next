import * as process from "node:process";
import * as fs from "node:fs";
import {WatchListener} from "fs";
import {fileURLToPath} from "node:url";

export function display_path(input_path:string){
    return input_path.replace(process.cwd(),'').replace(/^([\/\\])*/g,'')
}
export function isClassConstructor<T extends Function>(target: T): boolean {
    return typeof target === 'function' && target.toString().startsWith('class')
}
export function isExistDir(dir:string){
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory()
}
export function isExistFile(file:string){
    return fs.existsSync(file) && fs.statSync(file).isFile()
}
export function isSameObj<T=any>(a:T,b:T){
    return JSON.stringify(a)===JSON.stringify(b)
}
export function currentFile(index=1){
    const previousPrepareStackTrace = Error.prepareStackTrace;
    Error.prepareStackTrace = function (_, stack) {
        return stack;
    }
    const stack = new Error().stack as unknown as NodeJS.CallSite[];
    Error.prepareStackTrace = previousPrepareStackTrace
    const filename=stack[index].getFileName()!
    try{
        return fileURLToPath(filename)
    }catch {
        return filename
    }
}
export function watchFile(file_path:string|string[],callback:WatchListener<string>){
    const pathList=Array.isArray(file_path)?file_path: [file_path]
    const watchers=pathList.map(file=>fs.watch(file, callback))
    return ()=>{
        watchers.forEach(watcher=>watcher.close())
    }
}
export function wrapExport<T=any>(m:any):T{
    if(!m?.default) return m as T
    return new Proxy(m.default,{
        get(target, p, receiver) {
            return target[p]
        }
    }) as T
}
