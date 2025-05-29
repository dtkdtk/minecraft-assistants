//Source: https://www.npmjs.com/package/typed-emitter
import EventEmitter from "node:events";

type _ListenerFn<Events extends object, E extends keyof Events> =
  Assert<Events[E], (...params: any[]) => any>;

declare global {
  export abstract class TypedEventEmitter<Events extends object> {
    addListener<E extends keyof Events> (event: E, listener: _ListenerFn<Events, E>): this
    on<E extends keyof Events> (event: E, listener: _ListenerFn<Events, E>): this
    once<E extends keyof Events> (event: E, listener: _ListenerFn<Events, E>): this
    prependListener<E extends keyof Events> (event: E, listener: _ListenerFn<Events, E>): this
    prependOnceListener<E extends keyof Events> (event: E, listener: _ListenerFn<Events, E>): this
  
    off<E extends keyof Events>(event: E, listener: _ListenerFn<Events, E>): this
    removeAllListeners<E extends keyof Events> (event?: E): this
    removeListener<E extends keyof Events> (event: E, listener: _ListenerFn<Events, E>): this
  
    emit<E extends keyof Events> (event: E, ...args: Parameters<_ListenerFn<Events, E>>): boolean
    eventNames (): (keyof Events | string | symbol)[]
    rawListeners<E extends keyof Events> (event: E): _ListenerFn<Events, E>[]
    listeners<E extends keyof Events> (event: E): _ListenerFn<Events, E>[]
    listenerCount<E extends keyof Events> (event: E): number
  
    getMaxListeners (): number
    setMaxListeners (maxListeners: number): this
  }
}

Object.defineProperty(global, "TypedEventEmitter", {
  value: EventEmitter
});
