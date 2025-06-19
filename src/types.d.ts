import * as mf from "mineflayer";
import Brain from "./ai/brain.ts";
import Mod_Eat from "./ai/instincts/eat.ts";
import Mod_ChatCommands from "./ai/instincts/chat-commands.ts";

declare global {
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
  }

  export type Bot = mf.Bot;
  export type BotEvents = mf.BotEvents;

  export type Assert<Got, Needed> = Got extends Needed ? Got : never;
  export type SomeFunction = () => unknown;

  /**
   * Минимальная единица работы.
   */
  export interface JobUnit {
    jobDisplayName: string;
    createdAt: number;
    /** Приоритет задачи. Больше = приоритетнее. */
    priority: JobPriority;
    /** Нужно ли ещё выполнять задачу? */
    validate? (): boolean | Promise<boolean>;
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
    prepare? (): Promise<boolean> | boolean;
    /** Выполнить задачу. Возвращает успех/неудачу. */
    execute(): Promise<boolean> | boolean;
    /** Завершить выполнение задачи. Возвращает успех/неудачу. */
    finalize? (): Promise<boolean> | boolean;
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
    type: LocationType.Area;
    x1: number;
    y1: number;
    z1: number;
    x2: number;
    y2: number;
    z2: number;
  }
  export type Location = LocationPoint | LocationArea | LocationRegion;
}

export {}
