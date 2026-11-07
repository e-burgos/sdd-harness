'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SeamState } from '@/lib/motion/seam-shader';
import { useSectionMotion } from '@/lib/motion/use-section-motion';
import { SeamCanvas } from '../modules/new-project/steps/scope/SeamCanvas';
import { createBackdropMotion, type BackdropController, type SeamTarget } from './entry-backdrop-motion';

const STATIC_GLOW =
  'bg-[radial-gradient(ellipse_at_12%_30%,rgba(234,88,12,0.22),transparent_55%),radial-gradient(ellipse_at_88%_70%,rgba(14,165,233,0.22),transparent_55%)]';

const DOT_GRID =
  'bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklab,var(--color-foreground)_12%,transparent)_1px,transparent_0)] bg-[size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]';

export function EntryBackdrop({ animate, target }: { animate: boolean; target: SeamTarget }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [seam] = useState<SeamState>(() => ({ split: target.split, mouseX: 0.5, mouseY: 0.5, hover: target.hover }));
  const controller = useRef<BackdropController | null>(null);
  const build = useMemo(() => createBackdropMotion(seam, controller), [seam]);
  useSectionMotion(rootRef, build, animate);

  useEffect(() => {
    controller.current?.settle(target);
  }, [target]);

  return (
    <div ref={rootRef} aria-hidden data-testid="entry-backdrop" data-split={target.split} data-hover={target.hover} className="pointer-events-none absolute inset-0 overflow-hidden">
      {animate ? (
        <div data-backdrop-layer className="absolute inset-0 opacity-60 [filter:invert(1)_hue-rotate(180deg)] dark:opacity-100 dark:[filter:none]">
          <SeamCanvas state={seam} />
        </div>
      ) : (
        <div className={`absolute inset-0 ${STATIC_GLOW}`} />
      )}
      <div className={`absolute inset-0 ${DOT_GRID}`} />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink-950/80 to-transparent" />
    </div>
  );
}
