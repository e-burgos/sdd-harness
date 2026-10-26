export class InputChannel<T> implements AsyncIterable<T> {
  private readonly buffer: T[] = [];
  private wake: (() => void) | null = null;
  private closed = false;
  private flushWaiters: Array<() => void> = [];

  push(items: T[]): void {
    if (this.closed || items.length === 0) return;
    this.buffer.push(...items);
    this.wake?.();
  }

  pushAndFlush(items: T[]): Promise<void> {
    if (this.closed || items.length === 0) return Promise.resolve();
    const flushed = new Promise<void>((resolve) => this.flushWaiters.push(resolve));
    this.push(items);
    return flushed;
  }

  end(): void {
    this.closed = true;
    this.wake?.();
    this.releaseFlushWaiters();
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    try {
      for (;;) {
        while (this.buffer.length > 0) yield this.buffer.shift() as T;
        this.releaseFlushWaiters();
        if (this.closed) return;
        await new Promise<void>((resolve) => (this.wake = resolve));
        this.wake = null;
      }
    } finally {
      this.closed = true;
      this.releaseFlushWaiters();
    }
  }

  private releaseFlushWaiters(): void {
    const waiters = this.flushWaiters;
    this.flushWaiters = [];
    for (const resolve of waiters) resolve();
  }
}
