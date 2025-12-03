import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { saveOptions } from "./utils";
export class Config<T extends object> {
    #data:T
    constructor(public filePath: string) {
        this.#data=yaml.load(fs.readFileSync(this.filePath,'utf-8')) as T;
    }
    get data(){
        return this.#proxyData(this.#data);
    }
    #proxyData<D extends object>(data: D): D {
        const config=this;
        return new Proxy(data, {
            get: (target, p, receiver) => {
                const value=Reflect.get(target, p, receiver);
                if(value===null||typeof value!=='object') return value;
                return this.#proxyData(value);
            },
            set: (target, p, value, receiver) => {
                const result=Reflect.set(target, p, value, receiver);
                config.save();
                return result;
            }
        });
    }
    save(){
        fs.writeFileSync(this.filePath, yaml.dump(this.#data), 'utf-8');
    }
}
export function useConfig<T extends object>(
  filename: string,
  defaultOptions: Partial<T>
): T {
    const fullPath=path.join(process.cwd(),`${filename}.yml`);
    if(!fs.existsSync(fullPath)){
        saveOptions(defaultOptions,fullPath)
    }
    return new Config<T>(fullPath).data;
}
