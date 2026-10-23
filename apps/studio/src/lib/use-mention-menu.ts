'use client';

import type { AgentSummary, FileSearchResult, SkillSummary } from '@sdd-studio/protocol';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { FIXED_COMMANDS } from './composer-refs';
import type { ActiveMention, MentionItem } from './mention';
import { PROMPT_COMMANDS } from './slash';

export const FILE_SEARCH_DEBOUNCE_MS = 120;
export const FILE_SEARCH_LIMIT = 30;

export type MentionGroupId = 'files' | 'agents' | 'commands' | 'skills';

export interface MentionGroup {
  id: MentionGroupId;
  items: MentionItem[];
}

export type FileSearchStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface MentionMenuOptions {
  mention: ActiveMention | null;
  agents: readonly AgentSummary[];
  skills: readonly SkillSummary[];
  catalogEnabled: boolean;
  searchFiles: ((query: string, limit: number) => Promise<FileSearchResult>) | null;
  onSelect(item: MentionItem): void;
  onClose(): void;
}

const PROMPT_PATHS: ReadonlySet<string> = new Set(Object.values(PROMPT_COMMANDS));

function rank<T extends { id: string }>(items: T[], query: string): T[] {
  const needle = query.toLowerCase();
  const matches = items.filter((i) => i.id.toLowerCase().includes(needle));
  const starts = (i: T) => (i.id.toLowerCase().startsWith(needle) ? 0 : 1);
  return matches.sort((a, b) => starts(a) - starts(b));
}

function useFileSearch(query: string, active: boolean, search: MentionMenuOptions['searchFiles']) {
  const [state, setState] = useState<{ status: FileSearchStatus; files: string[]; truncated: boolean }>({ status: 'idle', files: [], truncated: false });
  const sequence = useRef(0);
  useEffect(() => {
    const seq = ++sequence.current;
    if (!active || !search || query === '') {
      setState({ status: 'idle', files: [], truncated: false });
      return;
    }
    setState((s) => ({ ...s, status: 'loading' }));
    const timer = setTimeout(() => {
      search(query, FILE_SEARCH_LIMIT).then(
        (result) => {
          if (seq === sequence.current) setState({ status: 'ready', files: result.files.map((f) => f.path), truncated: result.truncated });
        },
        () => {
          if (seq === sequence.current) setState({ status: 'error', files: [], truncated: false });
        },
      );
    }, FILE_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, active, search]);
  return state;
}

export function useMentionMenu(o: MentionMenuOptions) {
  const listboxId = useId();
  const open = o.mention !== null;
  const trigger = o.mention?.trigger ?? null;
  const query = o.mention?.query ?? '';
  const files = useFileSearch(query, trigger === '@' && o.searchFiles !== null, o.searchFiles);

  const groups = useMemo<MentionGroup[]>(() => {
    if (trigger === '@') {
      const result: MentionGroup[] = [];
      if (o.searchFiles) result.push({ id: 'files', items: files.files.map((path) => ({ kind: 'file', id: path, path })) });
      if (o.catalogEnabled) {
        const agents = rank(o.agents.map((a) => ({ ...a })), query);
        result.push({ id: 'agents', items: agents.map((a) => ({ kind: 'agent', id: a.id, description: a.description })) });
      }
      return result;
    }
    if (trigger === '/') {
      const commands = rank(FIXED_COMMANDS.map((id) => ({ id })), query);
      const result: MentionGroup[] = [{ id: 'commands', items: commands.map((c) => ({ kind: 'command', id: c.id, description: '' })) }];
      if (o.catalogEnabled) {
        const skills = rank(o.skills.filter((s) => !PROMPT_PATHS.has(s.path)).map((s) => ({ ...s })), query);
        result.push({ id: 'skills', items: skills.map((s) => ({ kind: 'skill', id: s.id, description: s.description, skillKind: s.kind })) });
      }
      return result;
    }
    return [];
  }, [trigger, query, o.agents, o.skills, o.catalogEnabled, o.searchFiles, files.files]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => setActiveIndex(0), [trigger, query]);
  const active = Math.min(activeIndex, Math.max(0, flat.length - 1));

  const optionId = (index: number) => `${listboxId}-opt-${index}`;

  const onKeyDown = (e: KeyboardEvent<HTMLElement>): boolean => {
    if (!open || e.nativeEvent.isComposing) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (flat.length === 0) return false;
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((active + step + flat.length) % flat.length);
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      const item = flat[active];
      if (!item && e.key === 'Tab') return false;
      e.preventDefault();
      if (item) o.onSelect(item);
      else o.onClose();
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      o.onClose();
      return true;
    }
    return false;
  };

  return {
    open,
    trigger,
    groups,
    flat,
    activeIndex: active,
    setActiveIndex,
    listboxId,
    optionId,
    onKeyDown,
    files: { status: files.status, truncated: files.truncated, enabled: o.searchFiles !== null },
    select: o.onSelect,
    comboboxProps: {
      role: 'combobox' as const,
      'aria-autocomplete': 'list' as const,
      'aria-expanded': open,
      'aria-controls': open ? listboxId : undefined,
      'aria-activedescendant': open && flat.length > 0 ? optionId(active) : undefined,
    },
  };
}

export type MentionMenuModel = ReturnType<typeof useMentionMenu>;
