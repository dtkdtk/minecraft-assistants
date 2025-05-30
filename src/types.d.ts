import * as mf from "mineflayer";
import Brain from "./ai/brain.ts";
import Mod_Eat from "./ai/instincts/eat.ts";
import Mod_ChatCommands from "./ai/instincts/chat-commands.ts";

type _NecessaryOptions = Pick<mf.BotOptions, "auth" | "host" | "username" | "port">;

declare global {
  /**
   * Главные параметры.
   * Задаются при запуске бота.
   */
  export interface GeneralBotOptions extends _NecessaryOptions {
    _mfClientOptionsOverrides?: Partial<mf.BotOptions>;
  }

  export type Bot = mf.Bot;
  export type BotEvents = mf.BotEvents;

  export type Assert<Got, Needed> = Got extends Needed ? Got : never;
  export type SomeFunction = () => unknown;

  /**
   * Единица работы.
   */
  export interface JobUnit {
    jobDisplayName: string;
    createdAt: number;
    /** Приоритет задачи. Больше = приоритетнее. */
    priority: JobPriority;
    /** Нужно ли ещё выполнять задачу? */
    validate? (): boolean | Promise<boolean>;
    /** Подготовить бота к выполнению задачи. Возвращает успех/неудачу */
    prepare? (): Promise<boolean> | boolean;
    /** Выполнить задачу. Возвращает успех/неудачу. */
    execute(): Promise<boolean> | boolean;
    /** Завершить выполнение задачи. Возвращает успех/неудачу. */
    finalize? (): Promise<boolean> | boolean;
  }
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
  /** Больше приоритет = лучше. */
  export enum JobPriority {
    /** При полном отсутствии задач у бота. Выполняется обычно в выходные. */
    Whenever = 1,
    /** В свободное время (перерыв на обед / вечернее время). */
    FreeTime = 2,
    /** Обычная работа, трудовая обязанность. */
    Plain = 3,
    //4-й приоритет зарезервирован
    /** Прервать текущую минимальную единицу работы и заняться задачей. */
    SoftInterrupt = 5,
    /** БРОСИТЬ ВСЕ ДЕЛА и СРОЧНО бежать выполнять задачу. */
    ForceInterrupt = 6
  }
}

export {}
