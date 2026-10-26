'use client';

import { useT } from '@/lib/i18n/i18n';
import type { MentionItem } from '@/lib/mention';
import type { MentionGroupId, MentionMenuModel } from '@/lib/use-mention-menu';

const GROUP_LABEL = {
  files: 'mention.files',
  agents: 'mention.agents',
  commands: 'mention.commands',
  skills: 'mention.skills',
} as const satisfies Record<MentionGroupId, string>;

const UNDISCOVERED_LABEL = {
  agents: 'mention.agents.none',
  skills: 'mention.skills.none',
} as const satisfies Partial<Record<MentionGroupId, string>>;

function UndiscoveredHint({ id }: { id: MentionGroupId }) {
  const { t } = useT();
  if (id !== 'agents' && id !== 'skills') return null;
  return <p className="px-2 py-1 text-xs text-ink-400">{t(UNDISCOVERED_LABEL[id])}</p>;
}

const itemLabel = (item: MentionItem): string => {
  switch (item.kind) {
    case 'file':
      return item.path;
    case 'agent':
      return `@${item.id}`;
    case 'command':
    case 'skill':
      return `/${item.id}`;
  }
};

export function MentionMenu({ menu }: { menu: MentionMenuModel }) {
  const { t } = useT();
  if (!menu.open) return null;
  const filesGroup = menu.groups.find((g) => g.id === 'files');
  const searching = menu.trigger === '@' && menu.files.enabled && menu.files.status === 'loading';
  const showsUndiscovered = menu.groups.some((g) => g.undiscovered);
  const empty = menu.flat.length === 0 && !searching && menu.files.status !== 'error' && (menu.query !== '' || !showsUndiscovered);
  let index = -1;
  return (
    <div className="absolute bottom-full left-0 right-0 z-20 mb-2 max-h-72 overflow-auto rounded-xl border border-ink-700 bg-ink-900 p-1 shadow-xl">
      <div id={menu.listboxId} role="listbox" aria-label={t('mention.label')}>
        {menu.groups.map((group) =>
          group.items.length === 0 && !group.undiscovered ? null : (
            <div key={group.id} role="group" aria-labelledby={`${menu.listboxId}-${group.id}`}>
              <div id={`${menu.listboxId}-${group.id}`} className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
                {t(GROUP_LABEL[group.id])}
              </div>
              {group.items.length === 0 && <UndiscoveredHint id={group.id} />}
              {group.items.map((item) => {
                index += 1;
                const current = index;
                const selected = current === menu.activeIndex;
                return (
                  <div
                    key={`${item.kind}:${item.id}`}
                    id={menu.optionId(current)}
                    role="option"
                    aria-selected={selected}
                    className={`flex cursor-pointer items-baseline gap-2 rounded-md px-2 py-1 text-sm ${selected ? 'bg-accent-500/20 text-ink-50' : 'text-ink-100 hover:bg-ink-800'}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      menu.select(item);
                    }}
                    onMouseEnter={() => menu.setActiveIndex(current)}
                  >
                    <span className="truncate font-mono text-xs">{itemLabel(item)}</span>
                    {'description' in item && item.description && <span className="truncate text-xs text-ink-400">{item.description}</span>}
                  </div>
                );
              })}
            </div>
          ),
        )}
      </div>
      {searching && <p role="status" className="px-2 py-1 text-xs text-ink-400">{t('mention.loading')}</p>}
      {menu.trigger === '@' && menu.files.status === 'error' && <p role="alert" className="px-2 py-1 text-xs text-roseish">{t('mention.error')}</p>}
      {filesGroup && menu.files.truncated && <p className="px-2 py-1 text-xs text-ink-400">{t('mention.more')}</p>}
      {empty && <p role="status" className="px-2 py-1 text-xs text-ink-400">{menu.query === '' ? t('mention.empty') : t('mention.emptyFor', { query: menu.query })}</p>}
    </div>
  );
}
