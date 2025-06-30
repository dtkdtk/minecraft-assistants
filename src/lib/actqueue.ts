/**
 * Очередь действий. Выполняет указанные действия равномерно, через равные временные промежутки.
 */
export class ActionQueue
{
  private readonly _cooldownMs: number;
  private readonly _queue: SomeFunction[] = [];
  private _timeout: NodeJS.Timeout | null = null;

  constructor(cooldownMs: number)
  {
    this._cooldownMs = cooldownMs;
  }

  push(action: SomeFunction)
  {
    this._queue.push(action);
    if (this._timeout == null) this._execChainedAction();
  }

  private _createTimeout()
  {
    this._timeout ??= setTimeout(() => {
      this._timeout = null;
      this._execChainedAction()
    }, this._cooldownMs);
  }
  private _execChainedAction()
  {
    if (this._queue.length == 0) return;
    this._queue.shift()?.();
    this._createTimeout();
  }
}
