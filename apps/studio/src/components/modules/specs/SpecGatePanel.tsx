'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { KitGateResult } from '@sdd-studio/protocol';
import { Button } from '@e-burgos/tucu-ui';
import { bridgeErrorText } from '@/lib/bridge/error-text';
import { useBridgeFeatures } from '@/lib/use-bridge-features';
import { useT } from '@/lib/i18n/i18n';
import { useBridge } from '../../BridgeProvider';
import { Chip } from '../../workspace/NavParts';
import { Muted, Section } from './SpecParts';

type Loaded = { key: string; result: KitGateResult; error?: undefined } | { key: string; error: string; result?: undefined };

export function SpecGatePanel({ spec, cycle }: { spec: string; cycle: string | null }) {
  const { supports } = useBridgeFeatures();
  if (!supports('kit-gate')) return null;
  return <GatePanel spec={spec} cycle={cycle} />;
}

function GatePanel({ spec, cycle }: { spec: string; cycle: string | null }) {
  const { t } = useT();
  const { client } = useBridge();
  const key = `${spec}:${cycle ?? ''}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  const check = useCallback(() => {
    const run = ++latest.current;
    setLoading(true);
    client.request({ cmd: 'kit.gate.check', spec, ...(cycle ? { cycle } : {}) }).then(
      (data) => {
        if (run !== latest.current) return;
        const parsed = KitGateResult.safeParse(data);
        setLoaded(parsed.success ? { key, result: parsed.data } : { key, error: t('gate.invalid') });
        setLoading(false);
      },
      (e: unknown) => {
        if (run !== latest.current) return;
        setLoaded({ key, error: bridgeErrorText(e, t) });
        setLoading(false);
      },
    );
  }, [client, spec, cycle, key, t]);

  useEffect(() => {
    check();
    return () => {
      latest.current += 1;
    };
  }, [check]);

  const current = loaded && loaded.key === key ? loaded : null;
  const result = current?.result ?? null;
  const next = result?.next;
  return (
    <Section title={t('gate.title')}>
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {result ? (
            <>
              <Chip tone={result.passed ? 'success' : 'danger'} testId="gate-status">
                {t(result.passed ? 'gate.passed' : 'gate.blocked')}
              </Chip>
              <span className="text-meta text-ink-400">{t('gate.label', { gate: result.gate })}</span>
            </>
          ) : current && 'error' in current ? (
            <p role="alert" className="text-copy text-roseish">
              {current.error}
            </p>
          ) : (
            <Muted>{t('gate.loading')}</Muted>
          )}
        </div>
        <Button type="button" size="tiny" variant="transparent" color="gray" disabled={loading} onClick={check}>
          {t('gate.check')}
        </Button>
      </div>
      {result && (
        <ul className="flex flex-col gap-1">
          {result.checks.map((item) => (
            <li key={item.id} data-gate-check={item.id} data-ok={item.ok} className="flex min-w-0 flex-col gap-px">
              <span className={`flex items-baseline gap-1.5 text-copy ${item.ok ? 'text-ink-100' : 'text-roseish'}`}>
                <span aria-hidden="true">{item.ok ? '✔' : '✘'}</span>
                <span className="min-w-0">{`${item.id}. ${item.label}`}</span>
              </span>
              {item.detail && <span className="pl-5 text-meta text-ink-400">{item.detail}</span>}
            </li>
          ))}
        </ul>
      )}
      {next && (next.cycle || next.flow || next.profile) && (
        <p data-testid="gate-next" className="text-meta text-ink-300">
          {t('gate.next', { cycle: next.cycle ?? '—', flow: next.flow ?? '—', profile: next.profile ?? '—' })}
        </p>
      )}
    </Section>
  );
}
