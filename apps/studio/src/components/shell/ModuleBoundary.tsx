'use client';

import { Button } from '@e-burgos/tucu-ui';
import { Component, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { useT } from '@/lib/i18n/i18n';
import { PANEL_TYPE } from '@/lib/typography-tokens';

function BoundaryFallback({ error, onRetry }: { error: Error; onRetry(): void }) {
  const { t } = useT();
  return (
    <div role="alert" className="flex h-full min-h-0 flex-col items-start justify-center gap-2 p-4">
      <TriangleAlert aria-hidden size={16} className="text-roseish" />
      <p className={`${PANEL_TYPE.item} text-ink-100`}>{t('shell.module.error')}</p>
      <code className="max-w-full break-words rounded-md bg-ink-900 px-2 py-1 font-mono text-meta text-roseish">{error.message}</code>
      <Button type="button" size="tiny" variant="outline" color="gray" className="text-ui" onClick={onRetry}>
        {t('shell.module.retry')}
      </Button>
    </div>
  );
}

interface Props {
  resetKey: string;
  children: ReactNode;
}

export class ModuleBoundary extends Component<Props, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  override componentDidUpdate(previous: Props): void {
    if (previous.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <BoundaryFallback error={error} onRetry={() => this.setState({ error: null })} />;
  }
}
