import { describe, expect, it } from 'vitest';
import { InputChannel } from './input-channel';

async function take<T>(iterator: AsyncIterator<T>, count: number): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < count; i++) out.push((await iterator.next()).value as T);
  return out;
}

describe('InputChannel', () => {
  it('yields pushed items in order and finishes after end()', async () => {
    const channel = new InputChannel<number>();
    channel.push([1, 2]);
    channel.push([3]);
    channel.end();
    const seen: number[] = [];
    for await (const item of channel) seen.push(item);
    expect(seen).toEqual([1, 2, 3]);
  });

  it('wakes a waiting consumer on push', async () => {
    const channel = new InputChannel<string>();
    const iterator = channel[Symbol.asyncIterator]();
    const next = iterator.next();
    channel.push(['a']);
    expect((await next).value).toBe('a');
  });

  it('pushAndFlush resolves only after the consumer asks for the next item', async () => {
    const channel = new InputChannel<number>();
    const iterator = channel[Symbol.asyncIterator]();
    const first = iterator.next();
    let flushed = false;
    const flush = channel.pushAndFlush([1, 2]).then(() => (flushed = true));
    expect((await first).value).toBe(1);
    expect((await iterator.next()).value).toBe(2);
    await Promise.resolve();
    expect(flushed).toBe(false);
    const third = iterator.next();
    await flush;
    expect(flushed).toBe(true);
    channel.end();
    expect((await third).done).toBe(true);
  });

  it('ignores pushes after end() and resolves pending flushes', async () => {
    const channel = new InputChannel<number>();
    const flush = channel.pushAndFlush([1]);
    channel.end();
    await flush;
    channel.push([2]);
    expect(await take(channel[Symbol.asyncIterator](), 1)).toEqual([1]);
    await expect(channel.pushAndFlush([3])).resolves.toBeUndefined();
  });

  it('closes the channel when the consumer stops iterating', async () => {
    const channel = new InputChannel<number>();
    channel.push([1]);
    for await (const _ of channel) break;
    await expect(channel.pushAndFlush([2])).resolves.toBeUndefined();
  });
});
