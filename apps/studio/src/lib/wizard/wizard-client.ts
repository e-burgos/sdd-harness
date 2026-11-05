import type { BridgeClient } from '@/lib/bridge/client';

export type WizardClient = Pick<BridgeClient, 'request' | 'onEvent' | 'onState' | 'state'>;

export const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));
export const errorCode = (error: unknown): string | null =>
  typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code: unknown }).code === 'string'
    ? (error as { code: string }).code
    : null;
