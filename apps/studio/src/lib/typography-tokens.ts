import { extendClassMergeTokens } from '@e-burgos/tucu-ui';

extendClassMergeTokens({ fontSize: ['micro', 'meta', 'ui', 'small', 'copy', 'title'] });

export const PANEL_TYPE = {
  title: 'text-title font-semibold',
  group: 'text-small font-medium text-ink-400',
  item: 'text-copy',
  meta: 'text-meta',
  rail: 'text-meta',
} as const;

export const ROW_HEIGHT = 'h-7';
export const ROW_ICON = 16;
