'use client';

import { Button } from '@e-burgos/tucu-ui';
import { useLayoutEffect, useRef, useState } from 'react';
import type { GenerationOutputChunk } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { stripAnsi } from '@/lib/wizard/log-text';

const BOTTOM_TOLERANCE_PX = 24;

export interface OutputLogProps {
  chunks: readonly GenerationOutputChunk[];
  truncatedBefore: boolean;
  maxHeightClass?: string;
}

export function OutputLog({ chunks, truncatedBefore, maxHeightClass = 'max-h-72' }: OutputLogProps) {
  const { t } = useT();
  const container = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [pinned, setPinned] = useState(true);

  useLayoutEffect(() => {
    const element = container.current;
    if (element !== null && following.current) element.scrollTop = element.scrollHeight;
  }, [chunks]);

  const onScroll = () => {
    const element = container.current;
    if (element === null) return;
    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight <= BOTTOM_TOLERANCE_PX;
    following.current = atBottom;
    setPinned(atBottom);
  };

  const jumpToEnd = () => {
    const element = container.current;
    following.current = true;
    setPinned(true);
    if (element !== null) element.scrollTop = element.scrollHeight;
  };

  return (
    <div className="flex flex-col gap-1">
      {truncatedBefore && <p className="text-small text-amberish">{t('wizard.log.truncated')}</p>}
      <div
        ref={container}
        role="log"
        tabIndex={0}
        aria-label={t('wizard.log.title')}
        data-testid="output-log"
        onScroll={onScroll}
        className={`${maxHeightClass} overflow-y-auto rounded-md bg-ink-950 p-2 font-mono text-meta text-ink-100`}
      >
        {chunks.length === 0 ? (
          <p className="text-ink-400">{t('wizard.log.empty')}</p>
        ) : (
          <pre className="whitespace-pre-wrap break-all">
            {chunks.map((chunk) => (
              <span key={chunk.seq} data-stream={chunk.stream} className={chunk.stream === 'stderr' ? 'text-amberish' : undefined}>
                {stripAnsi(chunk.chunk)}
              </span>
            ))}
          </pre>
        )}
      </div>
      {!pinned && (
        <Button type="button" size="tiny" variant="outline" color="gray" className="w-fit text-ui" onClick={jumpToEnd}>
          {t('wizard.log.toEnd')}
        </Button>
      )}
    </div>
  );
}
