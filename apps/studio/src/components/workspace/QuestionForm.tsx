'use client';

import { MessageCircleQuestion } from 'lucide-react';
import { useState } from 'react';
import type { QuestionAnswer } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import { bridgeErrorText } from '@/lib/bridge/error-text';
import { useT } from '@/lib/i18n/i18n';
import type { TimelineItem } from '@/lib/store/timeline';

type QuestionItem = Extract<TimelineItem, { kind: 'question' }>;

export interface AnswerQuestionFn {
  (answers: QuestionAnswer[], decline: boolean): Promise<unknown>;
}

interface Choice {
  labels: string[];
  otherOn: boolean;
  otherText: string;
}

const EMPTY: Choice = { labels: [], otherOn: false, otherText: '' };
const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:opacity-50';

export const valuesOf = (choice: Choice): string[] => [...choice.labels, ...(choice.otherOn && choice.otherText.trim() ? [choice.otherText.trim()] : [])];

export function QuestionForm({ item, onAnswer }: { item: QuestionItem; onAnswer: AnswerQuestionFn }) {
  const { t } = useT();
  const [choices, setChoices] = useState<Choice[]>(() => item.questions.map(() => EMPTY));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = item.outcome === 'pending';
  const complete = choices.every((choice) => valuesOf(choice).length > 0);

  const change = (index: number, next: (choice: Choice) => Choice) => setChoices((all) => all.map((choice, i) => (i === index ? next(choice) : choice)));

  const submit = async (decline: boolean) => {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const answers = decline ? [] : item.questions.map((q, i) => ({ question: q.question, values: valuesOf(choices[i]!) }));
      await onAnswer(answers, decline);
    } catch (e) {
      setSending(false);
      setError(t('question.sendError', { message: bridgeErrorText(e, t) }));
    }
  };

  const summaryKey = item.outcome === 'answered' ? 'question.answered' : item.outcome === 'declined' ? 'question.declined' : 'question.cancelled';

  return (
    <div data-testid="question-form" data-outcome={item.outcome} className={`min-w-0 rounded-xl border p-4 ${pending ? 'border-accent-400/50 bg-accent-dim/30' : 'border-ink-700 bg-ink-900'}`}>
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <MessageCircleQuestion size={18} className="text-accent-300" aria-hidden />
        {t('question.title', { name: agentMeta(item.author.agent).name })}
      </div>
      <div className="space-y-4">
        {item.questions.map((q, index) => {
          const choice = choices[index]!;
          const group = `${item.id}:${index}`;
          const answered = item.answers?.find((a) => a.question === q.question);
          return (
            <fieldset key={group} disabled={!pending || sending} className="min-w-0 space-y-2">
              <legend className="mb-1 text-sm text-ink-100">
                {q.header && <span className="mr-2 rounded-full bg-ink-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-300">{q.header}</span>}
                {q.question}
                {q.multiSelect && <span className="ml-2 text-xs text-ink-400">{t('question.multiHint')}</span>}
              </legend>
              {pending ? (
                <>
                  {q.options.map((option) => {
                    const checked = choice.labels.includes(option.label);
                    return (
                      <label key={option.label} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 text-sm hover:bg-ink-800">
                        <input
                          type={q.multiSelect ? 'checkbox' : 'radio'}
                          name={group}
                          className="mt-1"
                          checked={checked}
                          onChange={() =>
                            change(index, (c) =>
                              q.multiSelect
                                ? { ...c, labels: checked ? c.labels.filter((l) => l !== option.label) : [...c.labels, option.label] }
                                : { labels: [option.label], otherOn: false, otherText: c.otherText },
                            )
                          }
                        />
                        <span className="min-w-0">
                          <span className="block">{option.label}</span>
                          {option.description && <span className="block text-xs text-ink-400">{option.description}</span>}
                        </span>
                      </label>
                    );
                  })}
                  <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 text-sm hover:bg-ink-800">
                    <input
                      type={q.multiSelect ? 'checkbox' : 'radio'}
                      name={group}
                      className="mt-1"
                      checked={choice.otherOn}
                      onChange={() => change(index, (c) => (q.multiSelect ? { ...c, otherOn: !c.otherOn } : { labels: [], otherOn: true, otherText: c.otherText }))}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block">{t('question.other')}</span>
                      {choice.otherOn && (
                        <input
                          type="text"
                          aria-label={t('question.other')}
                          placeholder={t('question.otherPlaceholder')}
                          value={choice.otherText}
                          onChange={(e) => change(index, (c) => ({ ...c, otherText: e.target.value }))}
                          className={`mt-1 w-full rounded-md border border-ink-700 bg-ink-950 px-2 py-1 text-sm ${ring}`}
                        />
                      )}
                    </span>
                  </label>
                </>
              ) : (
                answered && <p className="rounded-md bg-ink-950 px-2 py-1 text-sm text-accent-300">{answered.values.join(', ')}</p>
              )}
            </fieldset>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-roseish">{error}</p>}
      {pending ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" disabled={!complete || sending} onClick={() => void submit(false)} className={`rounded-md bg-accent-500 px-3 py-1.5 text-sm font-medium text-ink-950 hover:bg-accent-400 ${ring}`}>
            {t('question.send')}
          </button>
          <button type="button" disabled={sending} title={t('help.question.decline')} onClick={() => void submit(true)} className={`ml-auto rounded-md border border-ink-700 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-800 ${ring}`}>
            {t('question.decline')}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-300">{t(summaryKey)}</p>
      )}
    </div>
  );
}
