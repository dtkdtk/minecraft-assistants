export class Logger {
  #oldLogs: Logger.LogMessage[] = [];
  #unreadLogs: Logger.LogMessage[] = [];

  log(level: LogLevel, messageFmt: string, ...fmtArgs: unknown[]) {
    fmtArgs ??= [];
    this.#unreadLogs.push({ level, messageFmt, fmtArgs });
  }
  logDebug = this.log.bind(this, LogLevel.DEBUG);
  logInfo = this.log.bind(this, LogLevel.INFO);
  logWarning = this.log.bind(this, LogLevel.WARNING);
  logError = this.log.bind(this, LogLevel.ERROR);
  logFault = this.log.bind(this, LogLevel.FAULT);
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
export namespace Logger {
  export interface LogMessage {
    level: LogLevel;
    messageFmt: string;
    fmtArgs: unknown[];
  }
}

export enum LogLevel {
  DEBUG, INFO, WARNING, ERROR, FAULT, IMPORTANT
}
