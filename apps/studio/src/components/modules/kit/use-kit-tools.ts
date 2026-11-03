'use client';

import { ToolsSetResult, WorkspaceSnapshot, type KitToolsState, type ToolsChange } from '@sdd-studio/protocol';
import { useCallback, useState } from 'react';
import { BridgeError } from '@/lib/bridge/client';
import { useBridge, useStudio } from '../../BridgeProvider';

export type ToolId = 'rtk' | 'mod' | 'gate';
export type ToolValue = boolean | 'block' | 'warn';

export interface PendingToolChange {
  change: ToolsChange;
  tool: ToolId;
  from: ToolValue | null;
  to: ToolValue;
  expectedRevision: string;
}

export type ToolsNotice = { kind: 'applied'; tool: ToolId; to: ToolValue; changed: boolean } | { kind: 'conflict' | 'not-found' | 'bad-request' | 'error'; message: string };

export type ToolsReadOnlyReason = 'offline' | 'unsupported' | 'no-data' | 'missing' | 'invalid' | 'no-revision';

export const toolValueOf = (tools: KitToolsState, tool: ToolId): ToolValue | null =>
  tool === 'rtk' ? tools.rtkEnabled : tool === 'mod' ? tools.modEnabled : tools.gate;

export const changeOf = (tool: ToolId, to: ToolValue): ToolsChange =>
  tool === 'gate' ? { tool, mode: to as 'block' | 'warn' } : { tool, enabled: to as boolean };

export function readOnlyReason(open: boolean, supported: boolean, tools: KitToolsState | undefined): ToolsReadOnlyReason | null {
  if (!open) return 'offline';
  if (!supported) return 'unsupported';
  if (!tools) return 'no-data';
  if (tools.status === 'missing') return 'missing';
  if (tools.status === 'invalid') return 'invalid';
  if (tools.revision === null) return 'no-revision';
  return null;
}

const KNOWN_ERRORS = ['conflict', 'not-found', 'bad-request'] as const;

export function useKitTools() {
  const { client, store, connection } = useBridge();
  const tools = useStudio((s) => s.snapshot?.tools);
  const open = connection.status === 'open';
  const supported = open && client.supports('kit-tools');
  const reason = readOnlyReason(open, supported, tools);
  const [pending, setPending] = useState<PendingToolChange | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<ToolsNotice | null>(null);

  const refreshSnapshot = useCallback(async () => {
    const parsed = WorkspaceSnapshot.safeParse(await client.request({ cmd: 'workspace.snapshot' }));
    if (parsed.success) store.getState().setSnapshot(parsed.data);
  }, [client, store]);

  const ask = useCallback(
    (tool: ToolId, to: ToolValue) => {
      if (reason !== null || !tools?.revision) return;
      setNotice(null);
      setPending({ change: changeOf(tool, to), tool, from: toolValueOf(tools, tool), to, expectedRevision: tools.revision });
    },
    [reason, tools],
  );

  const cancel = useCallback(() => setPending((current) => (busy ? current : null)), [busy]);

  const confirm = useCallback(async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const parsed = ToolsSetResult.safeParse(await client.request({ cmd: 'kit.tools.set', change: pending.change, expectedRevision: pending.expectedRevision }));
      if (parsed.success) {
        const current = store.getState().snapshot;
        if (current) store.getState().setSnapshot({ ...current, tools: parsed.data.tools, gateMode: parsed.data.tools.gate ?? current.gateMode });
      } else {
        await refreshSnapshot().catch(() => undefined);
      }
      setNotice({ kind: 'applied', tool: pending.tool, to: pending.to, changed: parsed.success ? parsed.data.changed : true });
    } catch (error) {
      const code = error instanceof BridgeError ? error.code : 'error';
      const kind = (KNOWN_ERRORS as readonly string[]).includes(code) ? (code as (typeof KNOWN_ERRORS)[number]) : 'error';
      if (kind === 'conflict' || kind === 'not-found') await refreshSnapshot().catch(() => undefined);
      setNotice({ kind, message: error instanceof Error ? error.message : '' });
    } finally {
      setPending(null);
      setBusy(false);
    }
  }, [pending, client, store, refreshSnapshot]);

  return { tools, reason, pending, busy, notice, ask, confirm, cancel, dismissNotice: () => setNotice(null) };
}
