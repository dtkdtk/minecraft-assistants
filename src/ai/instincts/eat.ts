import mcdata from "minecraft-data";
import { Item } from "prismarine-item";
import type Brain from "../brain.js";

const CHECK_INTERVAL = Durat().sec(3).done;
const MIN_SATURATION = 17;
const EXTREME_SATURATION = 6;
const BANNED_FOOD = ["rotten_flesh", "pufferfish", "chorus_fruit", "poisonous_potato", "spider_eye"];

export default class Mod_Eat {
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly B: Brain) {
    B.bot.once("spawn", this.whenBotSpawn.bind(this));
  }

  whenBotSpawn() {
    this.timer = setInterval(() => this.update(), CHECK_INTERVAL);
  }

  /** Возвращает успех/неудачу */
  async whenHungry(extreme: boolean): Promise<boolean> {
    /* Ищем еду в инвентаре. Находим - едим.
      Не нашли - сообщаем Мозгу. */
    const food = this.findFood();
    if (!food) {
      //TODO: find food
      this.B.bot.chat((extreme ? "I AM VERY HUNGRY!!!" : "I am hungry!!") + ` saturation: ${this.B.bot.foodSaturation}`);
      return false;
    }
    this.B.bot.equip(food, "hand");
    await this.activateFoodItem();
    this.B.bot.unequip("hand");
    
    //Может, нам нужно ещё поесть?
    if (this.checkSaturation() != 0) return await this.whenHungry(false);
    return true;
  }
  activateFoodItem() {
    return new Promise<void>((pReturn, pThrow) => {
      const handler = (slot: number, oldItem: Item | null, newItem: Item | null) => {
        if (slot === eatingItem?.slot && newItem?.type === eatingItem.type) {
          this.B.bot.deactivateItem();
          this.B.bot.inventory.off("updateSlot" as never, handler);
          pReturn();
        }
      };
      this.B.bot.activateItem();
      const eatingItem = this.B.bot.heldItem;
      this.B.bot.inventory.on("updateSlot" as never, handler);
    });
  }

  update() {
    const saturationCode = this.checkSaturation();
    if (!saturationCode) return;
    this.B.addJob({
      createdAt: Date.now(),
      priority: saturationCode == 2 ? JobPriority.ForceInterrupt : JobPriority.SoftInterrupt,
      validate: () => Boolean(this.checkSaturation()),
      execute: async () => await this.whenHungry(saturationCode == 2),
    });
  }

  /** `2` = сильное голодание, `1` = голодание, `0` = всё ОК */
  checkSaturation(): 2 | 1 | 0 {
    if (this.B.bot.foodSaturation <= EXTREME_SATURATION)
      return 2;
    if (this.B.bot.foodSaturation <= MIN_SATURATION)
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
