import { Adapter } from "./adapter";
import { Event, MessageEvent, RequestEvent } from "./event";
import { Hooks } from "./hooks";
import { Segment } from "./segment";
export type Receiver = Event.Location & Event.Operator;
export interface Account<T = any> {
  account_id: string;
  adapter: Adapter;
  sendMessage(receiver: Receiver, content: Segment.Sendable): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}
export namespace Account {
  export type IOptions<A> = A extends Account<infer T> ? T : object;
  export type Options<T extends object = object> = {
    adapter: string;
  } & T;
  export interface Lifecycle {
    start: [Hooks];
    stop: [];
    ready: [];
    dispose: [];
    error: [Error];
    message: [MessageEvent];
    request: [RequestEvent];
  }
}
