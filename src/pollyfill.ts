import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentFileUrl = fileURLToPath(import.meta.url)
Reflect.defineProperty(global, '__filename', {
    get() {
        const _ = Error.prepareStackTrace
        Error.prepareStackTrace = (_, stack) => stack
        const stack = new Error().stack as unknown as NodeJS.CallSite[]
        Error.prepareStackTrace = _
        while (stack.length){
            const frame = stack.shift()
            if(!frame) break
            const frameUrl=fileURLToPath(frame.getFileName()!)
            if (frameUrl !== currentFileUrl){
                return frameUrl
            }
        }
        return currentFileUrl
    },
    configurable: false,
    enumerable: false,
})

Reflect.defineProperty(global, '__dirname', {
    get() {
        return path.dirname(global.__filename)
    },
    configurable: false,
    enumerable: false,
})
