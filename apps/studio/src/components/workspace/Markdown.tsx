'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import { useMemo } from 'react';
import remarkGfm from 'remark-gfm';
import { useT } from '@/lib/i18n/i18n';

const REL = 'noopener noreferrer';
const A: Components['a'] = ({ node: _node, ...props }) => <a {...props} target="_blank" rel={REL} />;

export function Markdown({ text }: { text: string }) {
  const { t } = useT();
  // Las imágenes remotas no se cargan (privacidad): se muestran como enlace.
  const components = useMemo<Components>(
    () => ({
      a: A,
      img: ({ src, alt }) => (
        <a href={typeof src === 'string' ? src : undefined} target="_blank" rel={REL}>{`[${t('markdown.image', { alt: alt ?? '' })}]`}</a>
      ),
    }),
    [t],
  );
  return (
    <div className="prose-studio min-w-0 break-words space-y-2 text-sm leading-relaxed [&_code]:rounded [&_code]:bg-ink-800 [&_code]:px-1 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-ink-950 [&_pre]:p-3 [&_a]:text-accent-300 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:block [&_table]:max-w-full [&_table]:overflow-auto [&_table]:text-xs">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{text}</ReactMarkdown>
    </div>
  );
}
