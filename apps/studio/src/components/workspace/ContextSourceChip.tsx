'use client';

import { Package } from 'lucide-react';
import type { ThreadContextSource } from '@sdd-studio/protocol';
import { formatKb } from '@/lib/format';
import { useT } from '@/lib/i18n/i18n';

export function ContextSourceChip({ source }: { source: ThreadContextSource | undefined }) {
  const { t, lang } = useT();
  if (!source) return null;
  const size = formatKb(source.bytes, lang);
  const isPack = source.kind === 'pack';
  const text = isPack ? t('context.source.pack', { unit: source.unit ?? source.cycle, role: source.role, size }) : t('context.source.base', { size });
  const tooltip = isPack ? t('context.source.packTip', { spec: source.spec, cycle: source.cycle, role: source.role }) : t('context.source.baseTip');
  return (
    <span data-testid="context-source" data-kind={source.kind} title={tooltip} aria-label={`${text}. ${tooltip}`} className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-foreground/10 px-2 py-0.5 text-meta text-ink-300">
      <Package aria-hidden size={12} className="shrink-0" />
      <span className="truncate">{text}</span>
    </span>
  );
}
