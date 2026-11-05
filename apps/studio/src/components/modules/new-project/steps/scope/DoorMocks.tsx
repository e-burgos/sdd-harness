'use client';

const FRONT_BLOCKS = [
  { id: 'nav', className: 'col-span-6 h-3' },
  { id: 'hero', className: 'col-span-6 h-12 bg-gradient-to-r from-[#f59e0b]/70 to-[#ea580c]/60' },
  { id: 'card-a', className: 'col-span-2 h-10' },
  { id: 'card-b', className: 'col-span-2 h-10' },
  { id: 'card-c', className: 'col-span-2 h-10' },
] as const;

const BACK_REQUESTS = [
  { method: 'GET', path: '/health', ms: '4ms' },
  { method: 'POST', path: '/graph/run', ms: '38ms' },
  { method: 'GET', path: '/items?page=1', ms: '6ms' },
] as const;

function WindowDots() {
  return (
    <span className="flex gap-1" aria-hidden>
      <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
      <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
      <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
    </span>
  );
}

export function FrontMock({ statusBuilding, statusLive }: { statusBuilding: string; statusLive: string }) {
  return (
    <div data-depth="14" className="w-full max-w-[17rem]" aria-hidden>
      <div data-mock="front" className="relative">
      <div data-float className="rounded-xl border border-white/10 bg-[#0c0c10]/85 p-2 shadow-[0_24px_60px_-20px_rgba(234,88,12,0.45)] backdrop-blur">
        <div className="mb-2 flex items-center gap-2 px-1">
          <WindowDots />
          <span className="truncate rounded bg-white/5 px-2 py-0.5 font-mono text-micro text-white/45">app.localhost:4200</span>
          <span data-status data-online="false" className="ml-auto flex items-center gap-1 rounded-full border border-white/10 px-1.5 py-0.5 font-mono text-micro uppercase tracking-wider text-white/60 data-[online=true]:border-emerald-400/50 data-[online=true]:text-emerald-300">
            <span className="h-1 w-1 rounded-full bg-current" />
            <span data-status-text data-building={statusBuilding} data-live={statusLive}>
              {statusLive}
            </span>
          </span>
        </div>
        <div className="relative grid grid-cols-6 gap-1.5 p-1">
          {FRONT_BLOCKS.map((block) => (
            <span key={block.id} data-block={block.id} className={`rounded-md bg-white/10 ${block.className}`} />
          ))}
          <span data-select className="pointer-events-none absolute left-0 top-0 rounded-md border border-[#fb923c] opacity-0 shadow-[0_0_18px_-2px_rgba(251,146,60,0.7)]" />
        </div>
      </div>
      <span data-depth="28" className="absolute -bottom-3 -left-4 rounded-lg border border-white/10 bg-[#141418]/90 px-2 py-1 font-mono text-micro text-[#fdba74] shadow-lg">
        tucu-ui · tailwind
      </span>
      </div>
    </div>
  );
}

export function BackMock() {
  return (
    <div data-depth="14" className="w-full max-w-[17rem]" aria-hidden>
      <div data-mock="back" className="relative">
      <div data-float className="rounded-xl border border-white/10 bg-[#07090d]/85 p-2 shadow-[0_24px_60px_-20px_rgba(14,165,233,0.45)] backdrop-blur">
        <div className="mb-2 flex items-center gap-2 px-1">
          <WindowDots />
          <span className="font-mono text-micro text-white/45">api · :3000</span>
        </div>
        <ul className="flex flex-col gap-1 px-1 pb-1 font-mono text-micro">
          {BACK_REQUESTS.map((request) => (
            <li key={request.path} data-req className="flex items-center gap-2 rounded bg-white/[0.04] px-1.5 py-1">
              <span className={request.method === 'GET' ? 'text-[#7dd3fc]' : 'text-[#5eead4]'}>{request.method}</span>
              <span className="min-w-0 flex-1 truncate text-white/70">{request.path}</span>
              <span data-code className="rounded bg-emerald-400/15 px-1 text-emerald-300">
                200
              </span>
              <span className="text-white/35">{request.ms}</span>
            </li>
          ))}
        </ul>
      </div>
      <span data-depth="28" className="absolute -right-4 -top-3 rounded-lg border border-white/10 bg-[#0d1117]/90 px-2 py-1 font-mono text-micro text-[#7dd3fc] shadow-lg">
        nest · fastapi · uv
      </span>
      </div>
    </div>
  );
}
