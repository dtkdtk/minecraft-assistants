/*
  Инициализирует все известные на данный момент файлы,
  в которых есть глобальные переменные / функции / классы (сущности).
*/
import "./lib/actqueue.js";
import "./lib/durat.js";
import "./lib/typed-emitter.js";

declare global {
  export function debug(message: string): void;
  export function isAggregateJob(job: Job | undefined | null): job is AggregateJob;
}

Object.defineProperty(global, "debug", {
  value: function(message: string) {
    console.debug(message);
  }
});
Object.defineProperty(global, "isAggregateJob", {
  value: function(job: Job): job is AggregateJob {
    return job && ("jobs" in job);
  }
});

Object.defineProperty(global, "JobPriority", {
  value: {
    Whenever: 1,
    Plain: 2,
    FreeTime: 3,
    SoftInterrupt: 5,
    ForceInterrupt: 6,
  }
});
