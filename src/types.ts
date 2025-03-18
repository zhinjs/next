
export type WithPrefix<T extends Record<string, any>,P extends string>={
    // @ts-ignore
    [K in keyof T as `${P}-${K}`]:T[K]
}
export type Constructor<T> = new (...args: any[]) => T;

export interface ProcessMessage{
    type:string
    pid?:number
    body:any
}
export type QueueItem={
    action:string
    payload:any
}
