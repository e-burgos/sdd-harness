import type { TFunction } from '../i18n/i18n';
import { BridgeError } from './client';

export function bridgeErrorText(error: unknown, t: TFunction): string {
  if (error instanceof BridgeError && error.code === 'frame-too-large') return t('error.frameTooLarge');
  if (error instanceof BridgeError && error.code === 'conflict') {
    if (/already delivered/i.test(error.message)) return t('pending.alreadyDelivered');
    if (/too many pending/i.test(error.message)) return t('pending.tooMany');
  }
  return error instanceof Error ? error.message : String(error);
}
