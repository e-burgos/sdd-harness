'use client';

import { useState } from 'react';
import { agentMeta } from '@/lib/agents';
import type { ConversationView } from '@/lib/conversation';
import { gateLabel, type ConversationGate } from '@/lib/conversation-gate';
import { useT } from '@/lib/i18n/i18n';
import { RelatedDocuments } from '../mission-control/RelatedDocuments';

export interface ConversationPanelData {
  view: ConversationView;
  gate: ConversationGate;
}

const RECENT_ACTIONS = 5;
const ACTION_TEXT_MAX = 120;

const clip = (text: string): string => (text.length > ACTION_TEXT_MAX ? `${text.slice(0, ACTION_TEXT_MAX - 1)}…` : text);
const heading = 'mb-2 text-[11px] uppercase tracking-wider text-ink-500';

export function ConversationPanelSections({ view, gate }: ConversationPanelData) {
  const { t } = useT();
  const [documentsOpen, setDocumentsOpen] = useState(true);
  const recent = view.dialogues.slice(-RECENT_ACTIONS).reverse();

  return (
    <>
      <section data-testid="panel-where">
        <h2 className={heading}>{t('panel.where')}</h2>
        <p data-testid="panel-gate" data-gate={gate.kind} className="rounded-lg border border-ink-800 p-2 font-mono text-xs text-ink-100">
          {gate.kind === 'idle' ? t('gate.modal.noGate') : gateLabel(gate, t)}
        </p>
      </section>
      <section data-testid="panel-documents">
        <h2 className={heading}>{t('panel.documents')}</h2>
        <RelatedDocuments specs={view.specs} fixes={view.fixes} documents={view.documents} open={documentsOpen} onToggle={() => setDocumentsOpen((open) => !open)} />
      </section>
      {recent.length > 0 && (
        <section data-testid="panel-recent">
          <h2 className={heading}>{t('panel.recent')}</h2>
          <ul className="space-y-1.5">
            {recent.map((dialogue) => (
              <li key={dialogue.id} className="rounded-md border border-ink-800 px-2 py-1 text-xs">
                <span className="font-medium">{agentMeta(dialogue.from).name}</span>
                <p className="truncate text-ink-300" title={dialogue.text}>
                  {clip(dialogue.text)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
