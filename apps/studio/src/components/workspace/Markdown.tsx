'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import { useMemo } from 'react';
import remarkGfm from 'remark-gfm';
import { useT } from '@/lib/i18n/i18n';

const REL = 'noopener noreferrer';
const A: Components['a'] = ({ node: _node, ...props }) => <a {...props} target="_blank" rel={REL} />;

export type MarkdownDensity = 'doc' | 'chat';
export type FrontmatterEntry = [key: string, value: string];

const FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const PAIR = /^([A-Za-z0-9_.-]+):[ \t]*(.*)$/;

export function splitFrontmatter(text: string): { meta: FrontmatterEntry[] | null; body: string } {
  const match = FRONTMATTER.exec(text);
  if (!match) return { meta: null, body: text };
  const meta: FrontmatterEntry[] = [];
  for (const line of match[1].split(/\r?\n/)) {
    const pair = PAIR.exec(line);
    if (pair) meta.push([pair[1], pair[2].trim()]);
    else if (line.trim() && meta.length > 0) {
      const last = meta[meta.length - 1];
      last[1] = `${last[1]} ${line.trim()}`.trim();
    }
  }
  if (meta.length === 0) return { meta: null, body: text };
  return { meta, body: text.slice(match[0].length) };
}

const SHARED =
  'prose-studio min-w-0 break-words select-text [&_a]:text-accent-300 [&_a]:underline [&_a]:underline-offset-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:text-ink-100 [&_p]:text-ink-100 [&_strong]:font-semibold [&_strong]:text-ink-100 [&_hr]:border-foreground/10 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-foreground/10 [&_pre]:bg-ink-950 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_code]:rounded [&_code]:bg-foreground/10 [&_code]:font-mono [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-500/60 [&_blockquote]:text-ink-300 [&_th]:border [&_th]:border-foreground/15 [&_th]:bg-foreground/5 [&_th]:text-left [&_th]:font-bold [&_th]:text-ink-100 [&_td]:border [&_td]:border-foreground/10 [&_td]:text-ink-100';

const DENSITY: Record<MarkdownDensity, string> = {
  doc: 'mx-auto max-w-[72ch] text-copy leading-7 [&_h1]:mb-4 [&_h1]:border-b [&_h1]:border-foreground/10 [&_h1]:pb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-ink-100 [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink-100 [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-ink-100 [&_h4]:mb-1.5 [&_h4]:mt-3 [&_h4]:text-copy [&_h4]:font-bold [&_h4]:text-ink-100 [&_p]:my-2.5 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-ui [&_code]:text-emerald-300 [&_pre]:my-3 [&_pre]:rounded-xl [&_pre]:p-4 [&_blockquote]:my-3 [&_blockquote]:pl-4 [&_blockquote]:italic [&_hr]:my-5 [&_table]:my-4 [&_table]:block [&_table]:w-full [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_th]:p-2 [&_th]:text-ui [&_td]:p-2 [&_td]:text-ui',
  chat: 'text-small leading-relaxed [&_h1]:mb-1.5 [&_h1]:text-copy [&_h1]:font-bold [&_h2]:mb-1 [&_h2]:mt-3 [&_h2]:text-small [&_h2]:font-bold [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-small [&_h3]:font-bold [&_h4]:text-small [&_h4]:font-bold [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-meta [&_pre]:my-2 [&_pre]:rounded-lg [&_pre]:p-2.5 [&_blockquote]:my-2 [&_blockquote]:pl-3 [&_hr]:my-3 [&_table]:my-2 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_th]:px-2 [&_th]:py-1 [&_th]:text-meta [&_td]:px-2 [&_td]:py-1 [&_td]:text-meta',
};

function FrontmatterCard({ meta }: { meta: FrontmatterEntry[] }) {
  return (
    <dl data-testid="markdown-frontmatter" className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3">
      {meta.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="font-mono text-meta text-ink-400">{key}</dt>
          <dd className="min-w-0 break-words text-small text-ink-100">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Markdown({ text, density = 'chat' }: { text: string; density?: MarkdownDensity }) {
  const { t } = useT();
  const components = useMemo<Components>(
    () => ({
      a: A,
      img: ({ src, alt }) => (
        <a href={typeof src === 'string' ? src : undefined} target="_blank" rel={REL}>{`[${t('markdown.image', { alt: alt ?? '' })}]`}</a>
      ),
    }),
    [t],
  );
  const { meta, body } = useMemo(() => (density === 'doc' ? splitFrontmatter(text) : { meta: null, body: text }), [text, density]);
  return (
    <div className={`${SHARED} ${DENSITY[density]}`}>
      {meta && <FrontmatterCard meta={meta} />}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{body}</ReactMarkdown>
    </div>
  );
}
