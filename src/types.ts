
export type WithPrefix<T extends Record<string, any>,P extends string>={
    // @ts-ignore
    [K in keyof T as `${P}-${K}`]:T[K]
}
export type Constructor<T> = new (...args: any[]) => T;
export type Awaitable<T> = T | Promise<T>;
export type ClassConstructor<T> = new (...args: any[]) => T
export type ClassMethod<T>=(this: T, ...args: any) => any
export type ClassDecoratorFn<T>=(value:ClassConstructor<T>,context:ClassDecoratorContext<ClassConstructor<T>>)=>void
export type ClassMethodDecorator<T,V extends (this: T, ...args: any) => any=(this: T, ...args: any) => any>=(this:T,...args:Parameters<V>)=>ReturnType<V>|void
export type ClassMethodDecoratorFn<T,V>=V extends ClassMethod<T>?(value:V,context:ClassMethodDecoratorContext<T,V>)=>(V|void):never
