declare global {
  /**
   * Конвертирует "человеческое" время в "машинное" - часы, минуты, секунды в миллисекунды.
   * Создано чтобы не путаться с умножениями.
   * 
   * Используется как пространство имён; каждый раз создаётся новый объект.
   * Чтобы превратить в миллисекунды, используйте унарный плюс: `+Durat.sec(30)`
   */
  export const Durat: DurationBuilder;
}

/** @internal */
class DurationBuilder {
  holds = 0;
  [Symbol.toPrimitive]() {
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
  get: function() {
    return new DurationBuilder();
  }
});
