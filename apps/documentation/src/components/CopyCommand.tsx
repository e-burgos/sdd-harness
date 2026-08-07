import { useState } from 'react';
import { CheckIcon, CopyIcon } from '@phosphor-icons/react';

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      onClick={copy}
      className="group inline-flex max-w-full items-center gap-3 rounded-xl border hairline bg-ink-900 px-4 py-3 text-left font-mono text-[13px] text-zinc-200 transition-colors duration-200 hover:border-accent-500/40 active:scale-[0.985]"
    >
      <span className="text-accent-400">$</span>
      <span className="truncate">{command}</span>
      {copied ? (
        <CheckIcon size={15} weight="bold" className="shrink-0 text-accent-400" />
      ) : (
        <CopyIcon
          size={15}
          className="shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-300"
        />
      )}
    </button>
  );
}
