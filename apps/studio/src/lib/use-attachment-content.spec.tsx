import { act, render, screen, waitFor } from '@testing-library/react';
import { sha256Hex } from './attachments/bytes';
import { BridgeContext, type BridgeContextValue } from '@/components/BridgeProvider';
import { AttachmentContentCache, attachmentCacheFor, useAttachmentContent, type ContentKey } from './use-attachment-content';

const encode = (text: string) => new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>;
const b64 = (text: string) => btoa(text);

async function keyFor(text: string): Promise<ContentKey> {
  return { sha256: await sha256Hex(encode(text)) as ContentKey['sha256'], mime: 'text/plain' };
}

function makeCache(texts: Record<string, string>, extra: { capacity?: number; concurrency?: number } = {}) {
  const fetchContent = vi.fn(async (key: ContentKey) => ({ sha256: key.sha256, mime: key.mime, data: b64(texts[key.sha256] ?? '') }));
  const revokeUrl = vi.fn();
  let n = 0;
  const cache = new AttachmentContentCache({ fetchContent, createUrl: () => `blob:${++n}`, revokeUrl, ...extra });
  return { cache, fetchContent, revokeUrl };
}

describe('AttachmentContentCache', () => {
  it('dedupes in-flight requests for the same sha256', async () => {
    const key = await keyFor('hola');
    const { cache, fetchContent } = makeCache({ [key.sha256]: 'hola' });
    const a = cache.acquire(key);
    const b = cache.acquire(key);
    expect(await a.result).toBe(await b.result);
    expect(fetchContent).toHaveBeenCalledTimes(1);
  });

  it('marks content unavailable when the sha256 does not match', async () => {
    const key = await keyFor('hola');
    const { cache } = makeCache({ [key.sha256]: 'otro contenido' });
    expect(await cache.acquire(key).result).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it('marks content unavailable when the bridge fails or answers malformed data', async () => {
    const key = await keyFor('hola');
    const failing = new AttachmentContentCache({ fetchContent: async () => { throw new Error('x'); }, createUrl: () => 'u', revokeUrl: vi.fn() });
    expect(await failing.acquire(key).result).toBeNull();
    const malformed = new AttachmentContentCache({ fetchContent: async () => ({ nope: 1 }), createUrl: () => 'u', revokeUrl: vi.fn() });
    expect(await malformed.acquire(key).result).toBeNull();
  });

  it('never revokes URLs that still have mounted consumers, and evicts released ones over capacity', async () => {
    const keys = await Promise.all(['a', 'b', 'c'].map(keyFor));
    const { cache, revokeUrl } = makeCache(Object.fromEntries(['a', 'b', 'c'].map((t, i) => [keys[i]!.sha256, t])), { capacity: 2 });
    const leases = keys.map((k) => cache.acquire(k));
    await Promise.all(leases.map((l) => l.result));
    expect(revokeUrl).not.toHaveBeenCalled();
    expect(cache.size()).toBe(3);
    leases[0]!.release();
    expect(revokeUrl).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(2);
    leases[0]!.release();
    expect(revokeUrl).toHaveBeenCalledTimes(1);
  });

  it('limits concurrent fetches to two', async () => {
    const keys = await Promise.all(['a', 'b', 'c', 'd'].map(keyFor));
    let active = 0;
    let peak = 0;
    const gates: (() => void)[] = [];
    const cache = new AttachmentContentCache({
      fetchContent: async (key) => {
        active++;
        peak = Math.max(peak, active);
        await new Promise<void>((resolve) => gates.push(resolve));
        active--;
        return { sha256: key.sha256, mime: key.mime, data: b64('a') };
      },
      createUrl: () => 'u',
      revokeUrl: vi.fn(),
    });
    keys.forEach((k) => cache.acquire(k));
    await waitFor(() => expect(gates).toHaveLength(2));
    expect(active).toBe(2);
    gates.splice(0).forEach((g) => g());
    await waitFor(() => expect(gates).toHaveLength(2));
    gates.splice(0).forEach((g) => g());
    await waitFor(() => expect(active).toBe(0));
    expect(peak).toBe(2);
  });

  it('serves primed content without asking the bridge', async () => {
    const key = await keyFor('hola');
    const { cache, fetchContent } = makeCache({});
    cache.prime(key, new Blob(['hola']));
    expect(await cache.acquire(key).result).toBe('blob:1');
    expect(fetchContent).not.toHaveBeenCalled();
  });
});

describe('useAttachmentContent', () => {
  function Probe({ k }: { k: ContentKey }) {
    const state = useAttachmentContent(k);
    return <p data-testid="s">{state.status === 'ready' ? state.url : state.status}</p>;
  }

  it('moves from loading to ready and releases its lease on unmount', async () => {
    const key = await keyFor('hola');
    const request = vi.fn(async () => ({ sha256: key.sha256, mime: key.mime, data: b64('hola') }));
    const client = { request } as unknown as BridgeContextValue['client'];
    URL.createObjectURL = vi.fn(() => 'blob:ok');
    const value = { client } as unknown as BridgeContextValue;
    const { unmount } = render(<BridgeContext.Provider value={value}><Probe k={key} /></BridgeContext.Provider>);
    expect(screen.getByTestId('s')).toHaveTextContent('loading');
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('blob:ok'));
    expect(request).toHaveBeenCalledWith({ cmd: 'attachment.get', sha256: key.sha256, mime: 'text/plain' });
    unmount();
    expect(attachmentCacheFor(client).size()).toBe(1);
  });

  it('reports unavailable when the content cannot be verified', async () => {
    const key = await keyFor('hola');
    const client = { request: vi.fn(async () => ({ sha256: key.sha256, mime: key.mime, data: b64('falso') })) } as unknown as BridgeContextValue['client'];
    render(<BridgeContext.Provider value={{ client } as unknown as BridgeContextValue}><Probe k={key} /></BridgeContext.Provider>);
    await act(async () => {});
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('unavailable'));
  });
});
