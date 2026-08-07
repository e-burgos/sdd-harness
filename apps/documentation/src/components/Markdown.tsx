import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function extractH2(markdown: string): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && line.startsWith('## ')) {
      const label = line.slice(3).trim();
      out.push({ id: slugify(label), label });
    }
  }
  return out;
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return textOf((node as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

function scrollToSlug(slug: string) {
  document.getElementById(slug)?.scrollIntoView({ behavior: 'smooth' });
}

function AnchorLink({
  href,
  children,
}: {
  href?: string;
  children?: ReactNode;
}) {
  if (href?.startsWith('#')) {
    return (
      <button
        onClick={() => scrollToSlug(decodeURIComponent(href.slice(1)))}
        className="text-accent-300 underline decoration-accent-500/30 underline-offset-4 transition-colors hover:decoration-accent-400"
      >
        {children}
      </button>
    );
  }
  if (href?.startsWith('http')) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-accent-300 underline decoration-accent-500/30 underline-offset-4 hover:decoration-accent-400"
      >
        {children}
      </a>
    );
  }
  return <code className="font-mono text-[0.9em] text-zinc-300">{children}</code>;
}

export function Markdown({ source }: { source: string }) {
  return (
    <div className="min-w-0 overflow-x-clip">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-6 mt-2 text-3xl font-medium tracking-tighter text-zinc-100">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              id={slugify(textOf(children))}
              className="mb-5 mt-14 scroll-mt-24 border-t hairline pt-10 text-2xl font-medium tracking-tight text-zinc-100"
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              id={slugify(textOf(children))}
              className="mb-3 mt-9 scroll-mt-24 text-lg font-medium tracking-tight text-zinc-200"
            >
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-2 mt-6 font-mono text-[13px] uppercase tracking-[0.12em] text-zinc-400">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="mb-4 max-w-[75ch] break-words text-[14px] leading-relaxed text-zinc-400">
              {children}
            </p>
          ),
          a: ({ href, children }) => <AnchorLink href={href}>{children}</AnchorLink>,
          strong: ({ children }) => (
            <strong className="font-medium text-zinc-200">{children}</strong>
          ),
          code: ({ children, className }) =>
            className || String(children).includes('\n') ? (
              <code className={`${className ?? ''} font-mono`}>{children}</code>
            ) : (
              <code className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-[0.85em] text-accent-300 [overflow-wrap:anywhere]">
                {children}
              </code>
            ),
          pre: ({ children }) => (
            <pre className="mb-5 overflow-x-auto rounded-xl border hairline bg-ink-900/80 p-4 font-mono text-[12px] leading-[1.7] text-zinc-300">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-5 rounded-r-xl border-l-2 border-accent-500/40 bg-ink-900/50 px-5 py-3 text-[13.5px] [&>p]:mb-2 [&>p:last-child]:mb-0">
              {children}
            </blockquote>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 space-y-1.5 break-words pl-5 text-[14px] leading-relaxed text-zinc-400 [&>li]:list-['—__'] [&>li]:pl-1 marker:[&>li]:text-zinc-600">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 list-decimal space-y-1.5 pl-6 text-[14px] leading-relaxed text-zinc-400 marker:font-mono marker:text-[12px] marker:text-zinc-500">
              {children}
            </ol>
          ),
          table: ({ children }) => (
            <div className="mb-6 overflow-x-auto rounded-xl border hairline">
              <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-ink-900 font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-400">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="border-b hairline px-4 py-2.5 font-medium">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b hairline px-4 py-2.5 align-top text-zinc-400 last:border-b-0">
              {children}
            </td>
          ),
          hr: () => <hr className="my-10 border-0" />,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
