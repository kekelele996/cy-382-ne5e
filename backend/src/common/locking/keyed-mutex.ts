/**
 * 按行程串行化清算生成的进程内异步互斥锁。
 * 这是数据库行锁（MySQL FOR UPDATE）与 trip_id 唯一索引之外的第三重保障：
 * 同一进程内的并发点击在此排队，避免不同驱动事务语义差异导致的竞态。
 */
export class KeyedMutex {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    // 等上一个任务彻底结束（无论成败）后再放行本任务。
    const next = previous.then(() => gate, () => gate);
    this.tails.set(key, next);
    try {
      await previous.catch(() => undefined);
      return await task();
    } finally {
      release();
      if (this.tails.get(key) === next) this.tails.delete(key);
    }
  }
}
