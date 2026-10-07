import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const REL = 'noopener noreferrer';
const COMPONENTS: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel={REL} />,
  // Las imágenes remotas no se cargan (privacidad): se muestran como enlace.
  img: ({ src, alt }) => (
    <a href={typeof src === 'string' ? src : undefined} target="_blank" rel={REL}>{`[imagen: ${alt ?? ''}]`}</a>
  ),
};

export function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-studio min-w-0 break-words space-y-2 text-sm leading-relaxed [&_code]:rounded [&_code]:bg-ink-800 [&_code]:px-1 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-ink-950 [&_pre]:p-3 [&_a]:text-accent-300 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:block [&_table]:max-w-full [&_table]:overflow-auto [&_table]:text-xs">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>{text}</ReactMarkdown>
    </div>
  );
}
