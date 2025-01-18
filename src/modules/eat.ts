import { every30Seconds } from "../lib/fat-ticks.js";

const MIN_SATURATION = 12;
const EXTREME_SATURATION = 6;

export default class Mod_Eat extends TypedEventEmitter<Mod_Eat.Events> {
  constructor(private readonly bot: Readonly<Bot>) {
    super();
    bot.once("spawn", this.whenBotSpawn.bind(this));
  }

  whenBotSpawn() {
    every30Seconds(this.checkSaturation.bind(this));
  }

  whenHungry(extreme: boolean) {
    /* Ищем еду в инвентаре. Находим - едим, не забываем убрать из хотбара.
      Не нашли - сообщаем Мозгу. */
  }

  checkSaturation() {
    if ((this.bot.entity.food ?? 20) <= EXTREME_SATURATION)
      return this.whenHungry(true);
    if ((this.bot.entity.food ?? 20) <= MIN_SATURATION)
      return this.whenHungry(false);
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
