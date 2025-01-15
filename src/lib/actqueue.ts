declare global {
  export const ActionQueue: typeof _ActionQueue;
}

class _ActionQueue
{
  readonly #cooldownMs: number;
  readonly #queue: SomeFunction[] = [];
  #timeout: NodeJS.Timeout | null = null;

  constructor(cooldownMs: number)
  {
    this.#cooldownMs = cooldownMs;
  }

  push(action: SomeFunction)
  {
    this.#queue.push(action);
    if (this.#timeout == null) this.#execChainedAction();
  }

  #createTimeout()
  {
    this.#timeout ??= setTimeout(() => {
      this.#timeout = null;
      this.#execChainedAction()
    }, this.#cooldownMs);
  }
  #execChainedAction()
  {
    if (this.#queue.length == 0) return;
    this.#queue.shift()?.();
    this.#createTimeout();
  }
}

Object.defineProperty(global, "ActionQueue", { value: _ActionQueue });
