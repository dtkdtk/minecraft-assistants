import { SerializableObj } from "../types.js";

export class Logger {
  #oldLogs: Logger.LogMessage[] = [];
  #unreadLogs: Logger.LogMessage[] = [];

  /**
   * @param messageFmt message with fmt support
   *  (see [`node:util` format()](https://nodejs.org/api/util.html#utilformatformat-args))
   * @param env an object of values that can be useful in this log message.
   *  Only serializable types are supported
   * @param fmtArgs fmt args that will replace the specifiers (`%s`, `%d` and more)
   */
  log(level: LogLevel, messageFmt: string, env?: SerializableObj, fmtArgs?: unknown[]) {
    fmtArgs ??= [];
    env ??= {};
    this.#unreadLogs.push({ level, timestamp: Date.now(), messageFmt, fmtArgs, env });
  }
  /** @see {@link Logger.log} */
  logDebug = this.log.bind(this, LogLevel.DEBUG);
  /** @see {@link Logger.log} */
  logInfo = this.log.bind(this, LogLevel.INFO);
  /** (warning for developer) @see {@link Logger.log} */
  logDevWarn = this.log.bind(this, LogLevel.DEV_WARN);
  /** @see {@link Logger.log} */
  logWarn = this.log.bind(this, LogLevel.WARN);
  /** @see {@link Logger.log} */
  logError = this.log.bind(this, LogLevel.ERROR);
  /** @see {@link Logger.log} */
  logFatal = this.log.bind(this, LogLevel.FATAL);
  /** @see {@link Logger.log} */
  logImportant = this.log.bind(this, LogLevel.IMPORTANT);

  get allLogs(): Logger.LogMessage[] {
    return this.#oldLogs.concat(this.#unreadLogs);
  }
  get oldLogs(): Logger.LogMessage[] {
    return this.#oldLogs;
  }
  getUnread(markAsRead: boolean = true): Logger.LogMessage[] {
    const unread = this.#unreadLogs;
    if (markAsRead) {
      this.#oldLogs.push(...unread);
      this.#unreadLogs = [];
    }
    return unread;
  }
}
// eslint-disable-next-line no-redeclare
export namespace Logger {
  export interface LogMessage {
    level: LogLevel;
    timestamp: number;
    messageFmt: string;
    fmtArgs: unknown[];
    env: SerializableObj;
  }
}

export enum LogLevel {
  DEBUG,
  /** warning for developer */ DEV_WARN,
  INFO, WARN, ERROR, FATAL, IMPORTANT
}
