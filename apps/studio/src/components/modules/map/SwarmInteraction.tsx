'use client';

import { Button } from '@e-burgos/tucu-ui';
import { ArrowRight, Moon, Pause, Play, SkipForward } from 'lucide-react';
import { useMemo, useState } from 'react';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import { focusRing } from '../../shell/shell-context';
import { ConversationSessionInfo } from '../../mission-control/ConversationSessionInfo';
import { useSwarmPlayback } from './swarm-playback';

const PAGE_SIZE = 50;

export function SwarmInteraction({ onSelectAgent, agentId }: { onSelectAgent: (agentId: string) => void; agentId?: string }) {
  const { t } = useT();
  const { view, dialogues: allDialogues, currentDialogue, isPlaying, togglePlay, next, inspect, conversationPresence } = useSwarmPlayback();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const dialogues = useMemo(() => (agentId ? allDialogues.filter((d) => d.from === agentId || d.to === agentId) : allDialogues), [allDialogues, agentId]);
  const title = agentId ? t('module.map.agent.history', { name: agentMeta(agentId).name }) : t('module.map.swarm.title');
  const displayName = (id: string): string => (id === 'user' ? t('ui.you') : agentMeta(id).name);
  const live = conversationPresence.some((p) => p.state === 'working') || dialogues.some((d) => d.isLive);
  const shown = dialogues.slice(-limit);

  return (
    <section data-testid={agentId ? 'agent-history' : 'swarm-interaction'} aria-label={title} className="flex min-h-0 flex-col gap-2">
      <div className="flex h-7 items-center gap-2">
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${live ? 'bg-rose-400 motion-safe:animate-pulse' : 'bg-emerald-400'}`} />
        <h3 className="min-w-0 flex-1 truncate text-small font-medium text-ink-400">
          {title}
          <span className="ml-2 text-meta font-normal">{t('module.map.swarm.count', { n: dialogues.length })}</span>
        </h3>
        <span className="text-meta text-ink-400" data-testid="swarm-live-state">{live ? t('ui.comms.live') : t('ui.comms.idle')}</span>
      </div>

      {!agentId && (
      <div className="flex items-center gap-1">
        <Button type="button" variant="transparent" color="gray" size="tiny" className="text-ui" onClick={togglePlay} disabled={dialogues.length === 0}>
          {isPlaying ? <Pause aria-hidden size={16} /> : <Play aria-hidden size={16} />}
          <span>{isPlaying ? t('ui.comms.pause') : t('ui.comms.play')}</span>
        </Button>
        <Button type="button" variant="transparent" color="gray" size="tiny" className="text-ui" onClick={next} disabled={dialogues.length === 0}>
          <SkipForward aria-hidden size={16} />
          <span>{t('ui.comms.next')}</span>
        </Button>
      </div>
      )}

      {view && !agentId && <ConversationSessionInfo sessionTitle={view.sessionTitle} engineSessionId={view.engineSessionId} provider={view.provider} />}

      <div data-testid="swarm-comms-scroll" className="flex max-h-72 min-h-0 flex-col gap-px overflow-y-auto">
        {!view ? (
          <p data-testid="swarm-no-conversation" className="px-1 py-2 text-ui text-ink-300">
            {t('module.map.swarm.noConversation')}
          </p>
        ) : view.isEmpty ? (
          <div data-testid="swarm-comms-empty" className="flex items-center gap-2 px-1 py-2 text-ui text-ink-300">
            <Moon aria-hidden size={16} className="shrink-0 text-ink-400" />
            <span>{t('mc.noActivity')}</span>
          </div>
        ) : (
          <>
            {dialogues.length > shown.length && (
              <Button type="button" variant="transparent" color="gray" size="tiny" className="text-ui" onClick={() => setLimit((v) => v + PAGE_SIZE)}>
                {t('module.map.swarm.older')}
              </Button>
            )}
            {shown.map((item) => {
              const sender = agentMeta(item.from);
              const receiver = item.to ? agentMeta(item.to) : null;
              const current = item.id === currentDialogue?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid="swarm-dialogue"
                  aria-current={current ? 'true' : undefined}
                  onClick={() => {
                    onSelectAgent(item.from);
                    inspect(item);
                  }}
                  className={`${focusRing} flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors ${current ? 'bg-accent-dim' : 'hover:bg-ink-800'}`}
                >
                  <span className="flex items-center gap-1 text-meta">
                    <span className="font-medium" style={{ color: sender.color }}>{displayName(item.from)}</span>
                    {receiver && (
                      <>
                        <ArrowRight aria-hidden size={12} className="shrink-0 text-ink-400" />
                        <span className="font-medium" style={{ color: receiver.color }}>{displayName(item.to as string)}</span>
                      </>
                    )}
                    {item.isLive && <span className="ml-auto text-micro font-medium text-rose-400">{t('ui.comms.live')}</span>}
                  </span>
                  <span className="line-clamp-3 break-words text-ui text-ink-100">{item.text}</span>
                </button>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}
