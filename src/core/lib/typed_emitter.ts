//Source: https://www.npmjs.com/package/typed-emitter
import EventEmitter from "node:events";
import { type Assert } from "../auxiliary.js";

type _ListenerFn<Events extends object, E extends keyof Events> =
  Assert<Events[E], (...params: any[]) => any>;

declare abstract class _TypedEventEmitter<Events extends object> {
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

export const TypedEventEmitter: typeof _TypedEventEmitter = EventEmitter as typeof _TypedEventEmitter;
