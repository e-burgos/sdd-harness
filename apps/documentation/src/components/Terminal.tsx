import { memo, useEffect, useRef, useState } from 'react';
import { TERMINAL_SCRIPT, type TerminalLine } from '../data/content';

type Frame = { done: number; partial: string | null };

const TICK_MS = 36;
const PAUSE_TICKS: Record<TerminalLine['kind'], number> = {
  cmd: 18,
  prompt: 7,
  answer: 11,
  out: 8,
  ok: 10,
};
const RESTART_TICKS = 140;

function buildFrames(): Frame[] {
  const frames: Frame[] = [];
  TERMINAL_SCRIPT.forEach((line, i) => {
    const typed = line.kind === 'cmd' || line.kind === 'answer';
    if (typed) {
      for (let c = 1; c <= line.text.length; c++) {
        frames.push({ done: i, partial: line.text.slice(0, c) });
      }
    }
    for (let p = 0; p < PAUSE_TICKS[line.kind]; p++) {
      frames.push({ done: i + 1, partial: null });
    }
  });
  for (let p = 0; p < RESTART_TICKS; p++) {
    frames.push({ done: TERMINAL_SCRIPT.length, partial: null });
  }
  return frames;
}

const FRAMES = buildFrames();

export const Terminal = memo(function Terminal() {
  const [step, setStep] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(
      () => setStep((s) => (s + 1) % FRAMES.length),
      TICK_MS,
    );
    return () => clearInterval(timer);
  }, []);

  const frame = FRAMES[step];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [frame.done, frame.partial]);

  return (
    <div className="overflow-hidden rounded-2xl border hairline bg-ink-900/90 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)]">
      <div className="flex items-center gap-2 border-b hairline px-4 py-3">
        <span className="size-2.5 rounded-full bg-zinc-700" />
        <span className="size-2.5 rounded-full bg-zinc-700" />
        <span className="size-2.5 rounded-full bg-accent-500/60" />
        <span className="ml-3 font-mono text-[11px] tracking-wide text-zinc-500">
          ~/proyectos — harness
        </span>
      </div>
      <div
        ref={scrollRef}
        className="h-[340px] overflow-hidden px-5 py-4 font-mono text-[12.5px] leading-[1.9] sm:text-[13px]"
      >
        {TERMINAL_SCRIPT.slice(0, frame.done).map((line, i) => (
          <TerminalRow key={i} line={line} text={line.text} />
        ))}
        {frame.partial !== null && (
          <TerminalRow
            line={TERMINAL_SCRIPT[frame.done]}
            text={frame.partial}
          />
        )}
        <span className="ml-0.5 inline-block h-[1.1em] w-[7px] translate-y-[3px] animate-blink bg-accent-400" />
      </div>
    </div>
  );
});

function TerminalRow({ line, text }: { line: TerminalLine; text: string }) {
  if (line.kind === 'cmd') {
    return (
      <div className="text-zinc-100">
        <span className="mr-2 text-accent-400">$</span>
        {text}
      </div>
    );
  }
  if (line.kind === 'prompt') {
    return (
      <div className="text-zinc-400">
        <span className="mr-2 text-accent-400">◆</span>
        {text}
      </div>
    );
  }
  if (line.kind === 'answer') {
    return <div className="pl-5 text-zinc-100">{text}</div>;
  }
  if (line.kind === 'ok') {
    return <div className="text-accent-400">{text}</div>;
  }
  return <div className="text-zinc-500">{text}</div>;
}
