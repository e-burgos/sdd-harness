import type { TFunction } from '../i18n/i18n';
import { BridgeError } from './client';

export function bridgeErrorText(error: unknown, t: TFunction): string {
  if (error instanceof BridgeError && error.code === 'frame-too-large') return t('error.frameTooLarge');
  return error instanceof Error ? error.message : String(error);
}
