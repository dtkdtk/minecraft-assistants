declare global {
  /**
   * Конвертирует "человеческое" время в "машинное" - часы, минуты, секунды в миллисекунды.
   * Создано чтобы не путаться с умножениями.
   */
  export function Durat(): DurationBuilder;
}
globalThis.Durat = function() {
  return new DurationBuilder();
}

/** @internal */
class DurationBuilder {
  holds = 0;
  [Symbol.toPrimitive]() {
    return this.holds;
  }
  get done() {
    return this.holds;
  }
 
  /** @param {number} count */
  ms(count) {
    this.holds += count;
    return this;
  }
 
  /** @param {number} count */
  sec(count) {
    this.holds += count * 1000;
    return this;
  }
 
  /** @param {number} count */
  min(count) {
    this.holds += count * 1000 * 60;
    return this;
  }
 
  /** @param {number} count */
  hr(count) {
    this.holds += count * 1000 * 60 * 60;
    return this;
  }
 
  /** @param {number} count */
  day(count) {
    this.holds += count * 1000 * 60 * 60 * 24;
    return this;
  }
}
