declare global {
  /**
   * Converts "human" time to "machine" time - hours, minutes, seconds to milliseconds.
   * Created to avoid confusion with multiplications.
   *
   * Used as a namespace; a new object is created each time.
   * To convert to milliseconds, use unary plus: `+Durat.sec(30)`
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
