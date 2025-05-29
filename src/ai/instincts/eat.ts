import mcdata from "minecraft-data";
import { Item } from "prismarine-item";
import type Brain from "../brain.js";

const MIN_SATURATION = 12;
const EXTREME_SATURATION = 6;
const BANNED_FOOD = ["rotten_flesh", "pufferfish", "chorus_fruit", "poisonous_potato", "spider_eye"];

export default class Mod_Eat extends TypedEventEmitter<_Events> {
  constructor(private readonly B: Brain) {
    super();
    B.bot.once("spawn", this.whenBotSpawn.bind(this));
  }

  whenBotSpawn() {
    //every30Seconds(this.checkSaturation.bind(this));
  }

  whenHungry(extreme: boolean) {
    /* Ищем еду в инвентаре. Находим - едим.
      Не нашли - сообщаем Мозгу. */
    const food = this.findFood();
    if (!food)
      return this.emit(extreme ? "extremelyNeedsFood" : "needsFood");
    this.B.bot.equip(food, "hand");
    this.activateFoodItem();
  }
  activateFoodItem() {
    this.B.bot.activateItem();
    const eatingItem = this.B.bot.heldItem;
    this.B.bot.inventory.on("updateSlot", (slot, oldItem, newItem) => {
      if (slot === eatingItem?.slot && newItem?.type === eatingItem.type) {
        this.B.bot.deactivateItem();
      }
    })
  }

  checkSaturation() {
    if ((this.B.bot.entity.food ?? 20) <= EXTREME_SATURATION)
      return this.whenHungry(true);
    if ((this.B.bot.entity.food ?? 20) <= MIN_SATURATION)
      return this.whenHungry(false);
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

interface _Events {
  /** Пусть Мозг ищет еду */
  needsFood: () => void;
  
  /** Пусть Мозг БРОСАЕТ ВСЕ ДЕЛА и ищет еду */
  extremelyNeedsFood: () => void;
}
