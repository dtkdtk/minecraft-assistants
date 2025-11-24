/**
 * A fuse that can prevent infinite loops.
 */
export class InfLoopFuse {
  ok = true
  cycles = 0;
  #previousCycleTimestamp = Date.now();
  #suspiciousCycles = 0;

  suspiciousWatermark = 1_000;

  constructor(
    public enableErrorThrowing: boolean = false
  ) {}

  /**
   * If `enableErrorThrowing` option is enabled, throws `InfiniteLoopDetected`
   * error when the `suspiciousWatermark` is reached. ((otherwise, it
   * just sets `ok` to `false`))
   */
  increment() {
    this.cycles++;
    const now = Date.now();
    if (now - this.#previousCycleTimestamp <= 2)
      this.#suspiciousCycles++;
    else if (now - this.#previousCycleTimestamp > 10)
      this.#suspiciousCycles = 0;
    if (this.#suspiciousCycles >= this.suspiciousWatermark)
      this.#alarm();
    this.#previousCycleTimestamp = now;
  }
  
  #alarm() {
    if (this.enableErrorThrowing) throw new InfiniteLoopDetected();
    else this.ok = false
  }

  /*
    BOUNDED ALIASES (for reactive style)
  */
  fuseIncrement = this.increment.bind(this)
  fuseOk = (() => this.ok).bind(this)
}

export class InfiniteLoopDetected extends Error {
  constructor() {
    super("Infinite loop detected!");
  }
}
