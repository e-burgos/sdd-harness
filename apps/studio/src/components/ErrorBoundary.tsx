'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useT } from '@/lib/i18n/i18n';

function ErrorFallback({ error, onReload }: { error: Error; onReload(): void }) {
  const { t } = useT();
  return (
    <div role="alert" className="flex h-full min-h-screen flex-col items-center justify-center gap-3 bg-ink-950 p-6 text-center">
      <h1 className="text-lg font-semibold">{t('error.boundary.title')}</h1>
      <p className="max-w-md text-sm text-ink-300">{t('error.boundary.body')}</p>
      <code className="max-w-md break-words rounded-md bg-ink-900 px-3 py-2 font-mono text-xs text-roseish">{error.message}</code>
      <button
        type="button"
        className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-accent-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
        onClick={onReload}
      >
        {t('error.boundary.reload')}
      </button>
    </div>
  );
}

interface Props {
  children: ReactNode;
  onReload?(): void;
  onError?(error: Error, info: ErrorInfo): void;
}

export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <ErrorFallback error={error} onReload={this.props.onReload ?? (() => window.location.reload())} />;
  }
}
