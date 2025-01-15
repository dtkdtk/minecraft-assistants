declare global {
  /**
   * Конвертирует "человеческое" время в "машинное" - часы, минуты, секунды в миллисекунды.
   * Создано чтобы не путаться с умножениями.
   */
  export function Durat(): DurationBuilder;
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
 
  ms(count: number) {
    this.holds += count;
    return this;
  }
 
  sec(count: number) {
    this.holds += count * 1000;
    return this;
  }
 
  min(count: number) {
    this.holds += count * 1000 * 60;
    return this;
  }
 
  hr(count: number) {
    this.holds += count * 1000 * 60 * 60;
    return this;
  }
 
  day(count: number) {
    this.holds += count * 1000 * 60 * 60 * 24;
    return this;
  }
}

Object.defineProperty(global, "Durat", {
  value: function() {
    return new DurationBuilder();
  }
});
