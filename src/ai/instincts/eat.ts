import mcdata from "minecraft-data";
import { type Item } from "prismarine-item";
import { JobPriority, type JobUnit } from "../../types.js";
import type Brain from "../brain.js";

const MODULE_NAME = "Mod_Eat";

const CHECK_INTERVAL = +Durat.sec(3);
const REGENERATION_MIN_HEALTH = 16;
const REGENERATION_MIN_FOOD = 19;
const MIN_SATURATION = 14;
const EXTREME_SATURATION = 6;
const BANNED_FOOD = ["rotten_flesh", "pufferfish", "chorus_fruit", "poisonous_potato", "spider_eye"];
const kJobEat = Symbol("job:eat");

export default class Mod_Eat {
  private timer: NodeJS.Timeout | undefined;
  private _lastHungryMessage: number = 0;

  constructor(private readonly B: Brain) {
    if (B.bot.entity !== undefined) this.whenBotSpawn();
    else B.bot.once("spawn", this.whenBotSpawn.bind(this));
  }

  whenBotSpawn() {
    this.timer = setInterval(() => this.update(), CHECK_INTERVAL);
  }

  /** Возвращает успех/неудачу */
  async whenHungry(extreme: boolean, jobPromisePause?: () => Promise<void> | undefined): Promise<boolean> {
    /* Ищем еду в инвентаре. Находим - едим.
      Не нашли - сообщаем Мозгу. */
    const food = this.findFood();
    if (!food) {
      //TODO: пойти взять еду
      if (this._lastHungryMessage + +Durat.min(3) < Date.now()) {
        this._lastHungryMessage = Date.now();
        this.B.bot.chat((extreme ? "I AM VERY HUNGRY!!!" : "I am hungry!!") + ` saturation: ${this.B.bot.food}`);
      }
      return false;
    }
    await this.B.bot.equip(food, "hand");
    await this.activateFoodItem();
    await this.B.bot.unequip("hand");
    
    /* Если задача приостановлена / отменена - не судьба;
      функция update() всё равно добавит новую задачу, если потребуется. */
    if (jobPromisePause !== undefined && jobPromisePause() !== undefined) return true;

    //Может, нам нужно ещё поесть?
    if (this.checkSaturation() != 0) return await this.whenHungry(false);
    return true;
  }
  activateFoodItem() {
    return new Promise<void>((pReturn, pThrow) => {
      const handler = (slot: number, oldItem: Item | null, newItem: Item | null) => {
        if (slot === eatingItem?.slot && newItem?.type === eatingItem.type) {
          this.B.bot.deactivateItem();
          this.B.bot.inventory.off("updateSlot", handler);
          pReturn();
        }
      };
      this.B.bot.activateItem();
      const eatingItem = this.B.bot.heldItem;
      this.B.bot.inventory.on("updateSlot", handler);
    });
  }

  update() {
    const saturationCode = this.checkSaturation();
    if (!saturationCode) return;
    this.B.addJob(new Job_EatFood(this));
  }

  /** `2` = сильное голодание, `1` = голодание, `0` = всё ОК */
  checkSaturation(): 2 | 1 | 0 {
    if (this.B.bot.food <= EXTREME_SATURATION)
      return 2;
    if (this.B.bot.food <= MIN_SATURATION)
      return 1;
    if (this.B.bot.health <= REGENERATION_MIN_HEALTH && this.B.bot.food <= REGENERATION_MIN_FOOD)
      return 1;
    return 0;
  }

  /**
   * В данный момент, бот ищет самую ДЕШЁВУЮ еду.
   * TODO: учёт ХП, восстановление здоровья едой.
   */
  findFood() {
    let currentBestChoice: Item | null = null;
    for (const item of this.B.bot.inventory.items()) {
      const maybeFoodItem = mcdata(this.B.bot.version).foods[item.type];
      if (!maybeFoodItem || BANNED_FOOD.includes(maybeFoodItem.name)) continue;
      if (!currentBestChoice || mcdata(this.B.bot.version).foods[currentBestChoice.type]?.foodPoints > maybeFoodItem.foodPoints) {
        currentBestChoice = item;
      }
    }
    return currentBestChoice;
  }
}



/** Создаётся, когда боту требуется поесть еды. */
class Job_EatFood implements JobUnit {
  jobIdentifier: symbol | null;
  jobDisplayName: string;
  createdAt: number;
  promisePause?: Promise<void> | undefined;
  priority: JobPriority;
  validate? (): Promise<boolean>;
  prepare? (): Promise<boolean>;
  execute: () => Promise<boolean>;
  finalize? (): Promise<boolean>;
  
  constructor(M: Mod_Eat) {
    this.jobIdentifier = kJobEat;
    this.jobDisplayName = M.checkSaturation() == 2 ? "Eating food (EXTREME HUNGER)" : "Eating food";
    this.createdAt = Date.now();
    this.priority = M.checkSaturation() == 2 ? JobPriority.ForceInterrupt : JobPriority.SoftInterrupt;
    this.validate = async () => Boolean(M.checkSaturation());
    this.execute = async () => await M.whenHungry(M.checkSaturation() == 2, () => this.promisePause);
  }
}
