'use client';

import { Input } from '@e-burgos/tucu-ui';
import { Search } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useT } from '@/lib/i18n/i18n';

export function SidebarSearch({ value, onChange }: { value: string; onChange(next: string): void }) {
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusOnShortcut = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener('keydown', focusOnShortcut);
    return () => window.removeEventListener('keydown', focusOnShortcut);
  }, []);

  const clearOnEscape = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Escape') return;
    if (value !== '') {
      e.stopPropagation();
      onChange('');
    } else {
      input.current?.blur();
    }
  };

  return (
    <Input
      ref={input}
      type="text"
      size="xs"
      variant="ghost"
      className="min-w-0 flex-1"
      icon={<Search aria-hidden size={13} />}
      placeholder={t('sidebar.search')}
      aria-label={t('sidebar.search')}
      aria-keyshortcuts="Meta+K Control+K"
      autoComplete="off"
      spellCheck={false}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={clearOnEscape}
    />
  );
}
