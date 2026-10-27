'use client';

import { Button } from '@e-burgos/tucu-ui';
import { FileText, X } from 'lucide-react';
import { MAX_ATTACHMENTS } from '@sdd-studio/protocol';
import { PDF_MAX_BYTES, TEXT_MAX_BYTES } from '@/lib/attachments/classify';
import type { DraftAttachment } from '@/lib/attachments/draft-attachment';
import { formatBytes } from '@/lib/format';
import { useT, type TFunction } from '@/lib/i18n/i18n';
import type { AttachmentFailure } from '@/lib/use-attachment-draft';


function failureText(t: TFunction, f: AttachmentFailure): string {
  const max = f.reason === 'pdf-too-large' ? Math.floor(PDF_MAX_BYTES / 1024) : f.reason === 'text-too-large' ? Math.floor(TEXT_MAX_BYTES / 1024) : MAX_ATTACHMENTS;
  return t(`attach.error.${f.reason}`, { name: f.name, max });
}

export interface AttachmentTrayProps {
  attachments: readonly DraftAttachment[];
  failures: readonly AttachmentFailure[];
  dragging?: boolean;
  onRemove(id: string): void;
  onDismissFailures(): void;
}

export function AttachmentTray({ attachments, failures, dragging = false, onRemove, onDismissFailures }: AttachmentTrayProps) {
  const { t } = useT();
  if (attachments.length === 0 && failures.length === 0 && !dragging) return null;
  return (
    <section aria-label={t('attach.tray')} data-testid="attachment-tray" className="border-b border-ink-800 px-3 pb-2 pt-2">
      {dragging && <p className="mb-1 rounded-md border border-dashed border-accent-500/60 px-2 py-1 text-xs text-accent-300">{t('attach.drop')}</p>}
      {attachments.length > 0 && (
        <>
          <ul className="flex flex-wrap gap-2">
            {attachments.map((a) => (
              <li key={a.id} className="flex max-w-[14rem] items-center gap-2 rounded-lg border border-ink-700 bg-ink-950 p-1 pr-1.5">
                {a.previewUrl ? (
                  <img src={a.previewUrl} alt={a.name} className="h-10 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded bg-ink-800 text-ink-300" aria-hidden>
                    <FileText size={20} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-ink-100">{a.name}</span>
                  <span className="block text-[11px] text-ink-400">{formatBytes(a.size)}</span>
                </span>
                <Button type="button" variant="transparent" color="gray" shape="circle" size="tiny" aria-label={t('attach.remove', { name: a.name })} onClick={() => onRemove(a.id)}>
                  <X size={12} />
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-ink-400" aria-live="polite">{t('attach.count', { n: attachments.length, max: MAX_ATTACHMENTS })}</p>
        </>
      )}
      {failures.length > 0 && (
        <div role="alert" className="mt-1 flex items-start gap-2 text-xs text-roseish">
          <ul className="min-w-0 flex-1">
            {failures.map((f, i) => <li key={`${f.reason}-${f.name}-${i}`}>{failureText(t, f)}</li>)}
          </ul>
          <Button type="button" variant="transparent" color="danger" shape="circle" size="tiny" aria-label={t('attach.dismiss')} onClick={onDismissFailures}>
            <X size={12} />
          </Button>
        </div>
      )}
    </section>
  );
}
