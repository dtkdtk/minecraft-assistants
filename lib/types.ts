import * as mf from "mineflayer";

export type _NecessaryBotOptions = Pick<mf.BotOptions, "auth" | "host" | "username" | "port">;
/**
 * Главные параметры.
 * Задаются при запуске бота.
 */
export interface GeneralBotOptions extends _NecessaryBotOptions {
  _mfClientOptionsOverrides?: Partial<mf.BotOptions>;
  /**
   * Интервал записи баз данных в файлы.
   * @default 3min
   */
  databaseAutosaveInterval?: number;
  /**
   * Включить отладку? (для разработчиков)
   * @default false
   */
  enableDebug?: boolean;
  /**
   * Интерактивный режим командной строки. Перманентно блокирует поток ввода-вывода.
   * @default false
   */
  interactiveCli?: boolean;
}

export type Bot = mf.Bot;
export type BotEvents = mf.BotEvents;

/** Больше приоритет = лучше. */
export enum JobPriority {
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

/**
 * Минимальная единица работы.
 */
export interface JobUnit {
  /**
   * Системный идентификатор задачи.
   * Если указан НЕ `null`, задача становится уникальной, и может существовать в очереди задач только в единичном экземпляре
   * (если задача с этим ID уже есть в очереди, при добавлении такой же ничего не произойдёт)
   */
  jobIdentifier: symbol | null;
  /** Для отображения в П/У и отладки */
  jobDisplayName: string;
  /** Тайм-штамп создания (Date.now()) */
  createdAt: number;
  /**
   * Системный промис, который резольвится (вызывает `resolve()`), когда задача снимается с паузы,
   * и реджектится (вызывает `reject()`), когда задача полностью останавливается.
   * После завершения промиса (resolve()/reject()), значение поля снова будет `undefined`.
   * 
   * При создании задачи данное поле нужно опустить (проигнорировать).
   */
  promisePause?: Promise<void> | undefined;
  /** Приоритет задачи. Больше = приоритетнее. */
  priority: JobPriority;
  /** Нужно ли ещё выполнять задачу? */
  validate? (): Promise<boolean>;
  /**
   * Подготовить бота к выполнению задачи. Возвращает успех/неудачу
   * 
   * Используется в двух случаях:
   * - (1) Обычная задача (`JobUnit`), приготовление к которой занимает очень много времени.
   * В течение приготовления задача может утратить актуальность (в таком случае, `prepare()` должен вернуть `false`)
   * - (2) Сложная задача (`AggregateJob`), которая может выполняться "в несколько заходов"
   * (прерываться, а затем возобновляться) ((может выполняться только часть минимальных единиц работы, а остаток уходит на потом)),
   * а также требует какого-то ЕДИНОГО приготовления к выполнению всех мин.ед.работы.
   * Например, `prepare(): "взять семена из сундука"`, а `jobs[i].execute(): "прийти на грядку и посадить семена"`
   */
  prepare? (): Promise<boolean>;
  /** Выполнить задачу. Возвращает успех/неудачу. */
  execute(): Promise<boolean>;
  /** Завершить выполнение задачи. Возвращает успех/неудачу. */
  finalize? (): Promise<boolean>;
  /** Неудача. Вызывается если задача завершена неуспешно на любом из этапов. */
  failure? (): Promise<void>;
}

/* Я каждый раз вспоминаю ферму. Отлично подходит для визуализации задач.
  
  Сложная (aggregate) задача: Работать
  Подзадачи: Засеять пшеницу (х60, каждая грядка = каждая подзадача)
  
  Сложная (aggregate) задача:
  prepare(): Прийти к сундуку, Взять семена из сундука, Взять мотыгу
    Выполняется только при начале выполнения сложной задачи (не мин.ед.работы)
  finalize(): Сложить семена и мотыгу в сундук
    Выполняется при завершении выполнения сложной задачи (вне зависимости от того, остались ли ещё мин.ед.работы)
  
  Подзадачи:
  validate(): Уже не засеяна ли пашня?
    Примечание: создано лишь для логического разделения; вполне можно опустить проверки в `execute()`,
    однако тогда `prepare()` будет выполняться даже если задача уже выполнена.
  execute(): Идти сюда, Взять семена в руку, Использовать на пашне
*/

/**
 * Набор задач. Разделён на минимальные единицы работы.
 * Набор может быть неоднородным (содержать разные задачи).
 * 
 * `.execute()` выполняет одну мин.единицу работы.
 */
export interface AggregateJob extends JobUnit {
  /** Индекс выполняемой в данной момент задачи. */
  cursor: number;
  /** Набор простых задач. */
  jobs: JobUnit[];
}
export type Job = JobUnit | AggregateJob;

export enum LocationType {
  /** Единичная точка. */
  Point,
  /** Двумерный регион (без Y) - прямоугольник. */
  Area,
  /** Трёхмерный регион - куб. */
  Region,
  /* TODO: AggregateArea (несколько прямоугольников), AggregateRegion (несколько кубов) */
}
/** Точка в мире. */
export interface LocationPoint {
  /** Системное имя точки. */
  key: string;
  type: LocationType.Point;
  
  x: number;
  y: number;
  z: number;
}
/** Прямоугольный (двумерный) регион (без Y). */
export interface LocationArea {
  /** Системное имя точки. */
  key: string;
  type: LocationType.Area;
  
  x1: number;
  z1: number;
  
  x2: number;
  z2: number;
}
/** Кубический (трёхмерный) регион. */
export interface LocationRegion {
  /** Системное имя точки. */
  key: string;
  type: LocationType.Region;
  
  x1: number;
  y1: number;
  z1: number;
  
  x2: number;
  y2: number;
  z2: number;
}
export type Location = LocationPoint | LocationArea | LocationRegion;



/** Внутренние (internal) типы баз данных. */
export namespace DatabaseTypes {
  export type KnownModuleNames = "Mod_ChatCommands" | "Mod_Eat" | "Mod_Sleep" | "Mod_Farm";
  export type LocationsDatabase = {
    _id: KnownModuleNames; /* module name */
    locations: Location[];
  };
}
