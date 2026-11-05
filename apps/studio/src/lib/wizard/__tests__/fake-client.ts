import type { ConnectionState } from '@/lib/bridge/client';
import type { ServerEvent } from '@sdd-studio/protocol';
import type { WizardClient } from '../wizard-client';

export interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

export const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

export class BridgeFailure extends Error {
  constructor(
    readonly code: string,
    message: string = code,
  ) {
    super(message);
  }
}

type Handler = (cmd: Record<string, unknown>) => Promise<unknown> | unknown;

export function fakeClient(
  handler: Handler = () => null,
  initial: ConnectionState['status'] = 'open',
  features: readonly string[] = ['project-wizard', 'workspace-switch'],
) {
  const events = new Set<(event: ServerEvent) => void>();
  const states = new Set<(state: ConnectionState) => void>();
  const requests: Array<Record<string, unknown>> = [];
  const client = {
    state: { status: initial } as ConnectionState,
    supports: (feature: string) => features.includes(feature),
    request: (cmd: Record<string, unknown>) => {
      requests.push(cmd);
      return Promise.resolve(handler(cmd));
    },
    onEvent: (fn: (event: ServerEvent) => void) => {
      events.add(fn);
      return () => events.delete(fn);
    },
    onState: (fn: (state: ConnectionState) => void) => {
      states.add(fn);
      return () => states.delete(fn);
    },
  };
  return {
    client: client as unknown as WizardClient,
    requests,
    emit: (event: ServerEvent) => events.forEach((fn) => fn(event)),
    setState: (state: ConnectionState) => {
      client.state = state;
      states.forEach((fn) => fn(state));
    },
    listeners: () => ({ events: events.size, states: states.size }),
  };
}

export const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
};
