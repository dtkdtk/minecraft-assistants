/*
  Инициализирует все известные на данный момент файлы,
  в которых есть глобальные переменные / функции / классы (сущности).
*/
import "./lib/actqueue.js";
import "./lib/durat.js";
import "./lib/typed-emitter.js";
import { default as Nedb } from "@seald-io/nedb";
type Datastore = typeof Nedb.default;
const Datastore = Nedb as unknown as Datastore;

/** Больше приоритет = лучше. */
enum _JobPriority {
  /** При полном отсутствии задач у бота. Выполняется обычно в выходные. */
  Whenever = 1,
  /** В свободное время (перерыв на обед / вечернее время). */
  FreeTime = 2,
  /** Обычная работа, трудовая обязанность. */
  Plain = 3,
  /** Задачи "переднего плана", которые нужно выполнить здесь и сейчас. */
  Foreground = 4,
  /** Прервать текущую минимальную единицу работы и заняться задачей. */
  SoftInterrupt = 101,
  /** БРОСИТЬ ВСЕ ДЕЛА и СРОЧНО бежать выполнять задачу. */
  ForceInterrupt = 102
}
enum _LocationType {
  /** Единичная точка. */
  Point,
  /** Двумерный регион (без Y) - прямоугольник. */
  Area,
  /** Трёхмерный регион - куб. */
  Region,
  /* TODO: AggregateArea (несколько прямоугольников), AggregateRegion (несколько кубов) */
}

declare global {
  export function debug(message: string): void;
  export function isAggregateJob(job: Job | undefined | null): job is AggregateJob;
  export const DB: Readonly<{
    common: Datastore,
    warps: Datastore,
  }>;
  export const JobPriority: typeof _JobPriority;
  export type JobPriority = _JobPriority;
  export const LocationType: typeof _LocationType;
  export type LocationType = _LocationType;
}

Object.defineProperties(global, {
  JobPriority:  { value: _JobPriority },
  LocationType: { value: _LocationType },
  debug: {
    value: function(message: string) {
      console.debug(message);
    }
  },
  isAggregateJob: {
    value: function(job: Job): job is AggregateJob {
      return job && ("jobs" in job);
    }
  },
  DB: {
    value: {
      /* Путь отсчитывается относительно CWD (Current Working Directory), а не файла 'configStore.ts' */
      common: new Datastore("./data/common.db"),
      locations: new Datastore("./data/locations.db"),
    }
  }
});
