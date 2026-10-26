'use client';

import { Info } from 'lucide-react';
import { useT } from '@/lib/i18n/i18n';
import { useBridgeFeatures, type BridgeCapability } from '@/lib/use-bridge-features';

export function CapabilityNotice({ capabilities }: { capabilities: readonly BridgeCapability[] }) {
  const { t } = useT();
  const { missing } = useBridgeFeatures();
  const absent = missing(capabilities);
  if (absent.length === 0) return null;
  const features = absent.map((c) => t(`caps.${c}`)).join(', ');
  return (
    <p data-testid="capability-notice" role="note" className="flex min-w-0 items-start gap-1.5 rounded-lg border border-amber-300/20 bg-amber-300/5 px-2 py-1.5 text-[10px] text-amber-200">
      <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
      <span className="min-w-0 break-words">{t('caps.notice', { features })}</span>
    </p>
  );
}
