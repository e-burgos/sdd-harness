'use client';

import { AttachmentContent, type AttachmentRef } from '@sdd-studio/protocol';
import { useEffect, useState } from 'react';
import { useBridge } from '@/components/BridgeProvider';
import { base64ToBytes, sha256Hex } from './attachments/bytes';
import type { BridgeClient } from './bridge/client';

export const CONTENT_CACHE_CAPACITY = 64;
export const CONTENT_FETCH_CONCURRENCY = 2;

export type ContentKey = Pick<AttachmentRef, 'sha256' | 'mime'>;

export interface ContentLease {
  result: Promise<string | null>;
  release(): void;
}

export interface ContentCacheDeps {
  fetchContent(key: ContentKey): Promise<unknown>;
  createUrl(blob: Blob): string;
  revokeUrl(url: string): void;
  capacity?: number;
  concurrency?: number;
}

interface Entry {
  key: ContentKey;
  url: string | null;
  loading: boolean;
  consumers: number;
  result: Promise<string | null>;
}

export class AttachmentContentCache {
  private readonly entries = new Map<string, Entry>();
  private readonly queue: (() => void)[] = [];
  private running = 0;
  private readonly capacity: number;
  private readonly concurrency: number;

  constructor(private readonly deps: ContentCacheDeps) {
    this.capacity = deps.capacity ?? CONTENT_CACHE_CAPACITY;
    this.concurrency = deps.concurrency ?? CONTENT_FETCH_CONCURRENCY;
  }

  acquire(key: ContentKey): ContentLease {
    let entry = this.entries.get(key.sha256);
    if (entry) {
      this.entries.delete(key.sha256);
    } else {
      entry = this.startLoading(key);
    }
    this.entries.set(key.sha256, entry);
    entry.consumers++;
    let released = false;
    const owned = entry;
    return {
      result: entry.result,
      release: () => {
        if (released) return;
        released = true;
        owned.consumers--;
        this.trim();
      },
    };
  }

  prime(key: ContentKey, blob: Blob): void {
    if (this.entries.has(key.sha256)) return;
    const url = this.deps.createUrl(blob);
    this.entries.set(key.sha256, { key, url, loading: false, consumers: 0, result: Promise.resolve(url) });
    this.trim();
  }

  size(): number {
    return this.entries.size;
  }

  private startLoading(key: ContentKey): Entry {
    const entry: Entry = { key, url: null, loading: true, consumers: 0, result: Promise.resolve(null) };
    entry.result = this.schedule(() => this.load(key)).then((url) => {
      entry.loading = false;
      entry.url = url;
      if (url === null && this.entries.get(key.sha256) === entry) this.entries.delete(key.sha256);
      this.trim();
      return url;
    });
    return entry;
  }

  private async load(key: ContentKey): Promise<string | null> {
    try {
      const content = AttachmentContent.parse(await this.deps.fetchContent(key));
      const bytes = base64ToBytes(content.data);
      if ((await sha256Hex(bytes)) !== key.sha256) return null;
      return this.deps.createUrl(new Blob([bytes], { type: key.mime }));
    } catch {
      return null;
    }
  }

  private schedule<T>(job: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve) => {
      const start = () => {
        this.running++;
        void job()
          .then(resolve)
          .finally(() => {
            this.running--;
            this.queue.shift()?.();
          });
      };
      if (this.running < this.concurrency) start();
      else this.queue.push(start);
    });
  }

  private trim(): void {
    for (const [sha, entry] of this.entries) {
      if (this.entries.size <= this.capacity) return;
      if (entry.consumers > 0 || entry.loading) continue;
      if (entry.url) this.deps.revokeUrl(entry.url);
      this.entries.delete(sha);
    }
  }
}

const caches = new WeakMap<BridgeClient, AttachmentContentCache>();

export function attachmentCacheFor(client: BridgeClient): AttachmentContentCache {
  let cache = caches.get(client);
  if (!cache) {
    cache = new AttachmentContentCache({
      fetchContent: (key) => client.request({ cmd: 'attachment.get', sha256: key.sha256, mime: key.mime }),
      createUrl: (blob) => URL.createObjectURL(blob),
      revokeUrl: (url) => URL.revokeObjectURL(url),
    });
    caches.set(client, cache);
  }
  return cache;
}

export function primeAttachmentContent(client: BridgeClient, key: ContentKey, blob: Blob): void {
  try {
    attachmentCacheFor(client).prime(key, blob);
  } catch {
    return;
  }
}

export type AttachmentContentState = { status: 'loading' } | { status: 'ready'; url: string } | { status: 'unavailable' };

export function useAttachmentContent(ref: ContentKey): AttachmentContentState {
  const { client } = useBridge();
  const [state, setState] = useState<AttachmentContentState>({ status: 'loading' });
  const { sha256, mime } = ref;
  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    const lease = attachmentCacheFor(client).acquire({ sha256, mime });
    void lease.result.then((url) => {
      if (active) setState(url ? { status: 'ready', url } : { status: 'unavailable' });
    });
    return () => {
      active = false;
      lease.release();
    };
  }, [client, sha256, mime]);
  return state;
}
