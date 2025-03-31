import mcdata from "minecraft-data";
import { every30Seconds } from "../../lib/fat-ticks.js";
import { Item } from "prismarine-item";

const MIN_SATURATION = 12;
const EXTREME_SATURATION = 6;
const BANNED_FOOD = ["rotten_flesh", "pufferfish", "chorus_fruit", "poisonous_potato", "spider_eye"];

export default class Mod_Eat extends TypedEventEmitter<Mod_Eat.Events> {
  constructor(private readonly bot: Readonly<Bot>) {
    super();
    bot.once("spawn", this.whenBotSpawn.bind(this));
  }

  whenBotSpawn() {
    every30Seconds(this.checkSaturation.bind(this));
  }

  whenHungry(extreme: boolean) {
    /* Ищем еду в инвентаре. Находим - едим.
      Не нашли - сообщаем Мозгу. */
    const food = this.findFood();
    if (!food)
      return this.emit(extreme ? "extremelyNeedsFood" : "needsFood");
    this.bot.equip(food, "hand");
    this.activateFoodItem();
  }
  activateFoodItem() {
    this.bot.activateItem();
    const eatingItem = this.bot.heldItem;
    this.bot.inventory.on("updateSlot", (slot, oldItem, newItem) => {
      if (slot === eatingItem?.slot && newItem?.type === eatingItem.type) {
        this.bot.deactivateItem();
      }
    })
  }

  checkSaturation() {
    if ((this.bot.entity.food ?? 20) <= EXTREME_SATURATION)
      return this.whenHungry(true);
    if ((this.bot.entity.food ?? 20) <= MIN_SATURATION)
      return this.whenHungry(false);
  }

  /**
   * В данный момент, бот ищет самую ДЕШЁВУЮ еду.
   * TODO: учёт ХП, восстановление здоровья едой.
   */
  findFood() {
    let currentBestChoice: Item | null = null;
    for (const item of this.bot.inventory.items()) {
      const maybeFoodItem = mcdata(this.bot.version).foods[item.type];
      if (!maybeFoodItem || BANNED_FOOD.includes(maybeFoodItem.name)) continue;
      if (!currentBestChoice || mcdata(this.bot.version).foods[currentBestChoice.type]?.foodPoints > maybeFoodItem.foodPoints) {
        currentBestChoice = item;
      }
    }
    return currentBestChoice;
  }
}

export namespace Mod_Eat {
  export interface Events {
    /** Пусть Мозг ищет еду */
    needsFood: () => void;
    
    /** Пусть Мозг БРОСАЕТ ВСЕ ДЕЛА и ищет еду */
    extremelyNeedsFood: () => void;
  }
}
