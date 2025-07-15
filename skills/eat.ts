import mcdata from "minecraft-data";
import { type Item } from "prismarine-item";
import { type BotSkill, Durat, JobPriority, type JobUnit } from "../lib/index.js";
import type Brain from "../lib/brain.js";

const MODULE_NAME = "Mod_Eat";

const CHECK_INTERVAL = Durat({ sec: 3 });
const REGENERATION_MIN_HEALTH = 16;
const REGENERATION_MIN_FOOD = 19;
const MIN_SATURATION = 14;
const EXTREME_SATURATION = 6;
const BANNED_FOOD = ["rotten_flesh", "pufferfish", "chorus_fruit", "poisonous_potato", "spider_eye"];
const kJobEat = Symbol("job:eat");

export default class Mod_Eat implements BotSkill {
  readonly moduleName = MODULE_NAME;
  private timer: NodeJS.Timeout | undefined;
  private _lastHungryMessage: number = 0;

  constructor(private readonly B: Brain) {}

  onGame(): Promise<void> | void {
    this.timer = setInterval(() => this.update(), CHECK_INTERVAL);
  }

  /** Returns success/failure */
  async whenHungry(extreme: boolean, jobPromisePause?: () => Promise<void> | undefined): Promise<boolean> {
    /* Trying to find food in the inventory. If we found, we will eat it.
      If we didn't find, tell the brain. */
    const food = this.findFood();
    if (!food) {
      //TODO: go look for food
      if (this._lastHungryMessage + Durat({ min: 3 }) < Date.now()) {
        this._lastHungryMessage = Date.now();
        this.B.bot.chat((extreme ? "I AM VERY HUNGRY!!!" : "I am hungry!!") + ` saturation: ${this.B.bot.food}`);
      }
      return false;
    }
    await this.B.bot.equip(food, "hand");
    await this.activateFoodItem();
    await this.B.bot.unequip("hand");
    
    /* If the job is cancelled/paused, just get over it;
      the update() method will add a new job if it is needed */
    if (jobPromisePause !== undefined && jobPromisePause() !== undefined) return true;

    //Maybe we need to eat more?
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

  /** '2' = extreme hunger, '1' = hunger, '0' = OK */
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
   * Currently the bot is searching for the cheapest food.
   * TODO: take into account HP; healing by food
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
