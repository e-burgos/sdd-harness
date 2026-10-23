'use client';

import { FilePdf, FileText } from '@phosphor-icons/react';
import type { AttachmentRef } from '@sdd-studio/protocol';
import { useEffect, useState } from 'react';
import { formatBytes } from '@/lib/format';
import { useT } from '@/lib/i18n/i18n';
import { useAttachmentContent } from '@/lib/use-attachment-content';

const IMAGE_BOX_MAX_WIDTH = 320;
const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400';
const card = 'flex max-w-xs items-center gap-2 rounded-lg border border-ink-700 bg-ink-950 px-2 py-1.5 text-xs';

function Unavailable({ name }: { name: string }) {
  const { t } = useT();
  return (
    <span role="img" aria-label={`${t('attach.unavailable')}: ${name}`} className={`${card} text-ink-400`}>
      <span aria-hidden>⚠</span>
      <span className="truncate">{t('attach.unavailable')}: {name}</span>
    </span>
  );
}

function ImageAttachment({ attachment }: { attachment: AttachmentRef }) {
  const content = useAttachmentContent(attachment);
  const width = Math.min(attachment.width ?? 240, IMAGE_BOX_MAX_WIDTH);
  const aspectRatio = attachment.width && attachment.height ? `${attachment.width} / ${attachment.height}` : '4 / 3';
  if (content.status === 'unavailable') return <Unavailable name={attachment.name} />;
  return (
    <div data-testid="attachment-image-box" className="overflow-hidden rounded-lg border border-ink-700 bg-ink-900" style={{ width, aspectRatio }}>
      {content.status === 'ready' ? (
        <a href={content.url} target="_blank" rel="noreferrer" aria-label={attachment.name} className={`block h-full w-full ${ring}`}>
          <img src={content.url} alt={attachment.name} width={attachment.width} height={attachment.height} className="h-full w-full object-contain" />
        </a>
      ) : (
        <div className="h-full w-full animate-pulse bg-ink-800" aria-hidden />
      )}
    </div>
  );
}

function PdfAttachment({ attachment }: { attachment: AttachmentRef }) {
  const { t } = useT();
  const content = useAttachmentContent(attachment);
  if (content.status === 'unavailable') return <Unavailable name={attachment.name} />;
  return (
    <div className={card}>
      <FilePdf size={20} className="shrink-0 text-ink-300" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-ink-100">{attachment.name}</span>
        <span className="block text-[11px] text-ink-400">{formatBytes(attachment.size)}</span>
      </span>
      {content.status === 'ready' && (
        <a href={content.url} target="_blank" rel="noreferrer" className={`rounded-md border border-ink-700 px-2 py-0.5 hover:bg-ink-800 ${ring}`}>
          {t('attach.open')}
        </a>
      )}
    </div>
  );
}

function TextBody({ attachment }: { attachment: AttachmentRef }) {
  const content = useAttachmentContent(attachment);
  const [body, setBody] = useState<string | null>(null);
  const url = content.status === 'ready' ? content.url : null;
  useEffect(() => {
    if (!url) return;
    let active = true;
    void fetch(url)
      .then((r) => r.text())
      .then((text) => active && setBody(text));
    return () => {
      active = false;
    };
  }, [url]);
  if (content.status === 'unavailable') return <Unavailable name={attachment.name} />;
  return <pre className="mt-1 max-h-48 max-w-xl overflow-auto whitespace-pre-wrap break-words rounded-lg bg-ink-950 p-2 font-mono text-[11px]">{body ?? '…'}</pre>;
}

function TextAttachment({ attachment }: { attachment: AttachmentRef }) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <div className={card}>
        <FileText size={20} className="shrink-0 text-ink-300" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ink-100">{attachment.name}</span>
          <span className="block text-[11px] text-ink-400">{formatBytes(attachment.size)}</span>
        </span>
        <button type="button" aria-expanded={expanded} className={`rounded-md border border-ink-700 px-2 py-0.5 hover:bg-ink-800 ${ring}`} onClick={() => setExpanded((v) => !v)}>
          {expanded ? t('attach.collapse') : t('attach.expand')}
        </button>
      </div>
      {expanded && <TextBody attachment={attachment} />}
    </div>
  );
}

export function AttachmentView({ attachment }: { attachment: AttachmentRef }) {
  switch (attachment.kind) {
    case 'image':
      return <ImageAttachment attachment={attachment} />;
    case 'pdf':
      return <PdfAttachment attachment={attachment} />;
    case 'text':
      return <TextAttachment attachment={attachment} />;
  }
}

export function AttachmentList({ attachments }: { attachments: readonly AttachmentRef[] }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-2">
      {attachments.map((a) => (
        <li key={a.sha256}>
          <AttachmentView attachment={a} />
        </li>
      ))}
    </ul>
  );
}
