'use client';

import { Button } from '@e-burgos/tucu-ui';
import { ChevronDown, ChevronUp, Eye, EyeOff, RotateCcw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useT } from '@/lib/i18n/i18n';
import { MODULE_LABEL_KEY } from '@/lib/nav/module-labels';
import { isHideable, type ModuleId } from '@/lib/nav/module-ids';
import type { useRailPreferences } from '@/lib/nav/use-rail-preferences';
import { PANEL_TYPE, ROW_ICON } from '@/lib/typography-tokens';
import { focusRing } from './shell-context';

type RailPreferences = ReturnType<typeof useRailPreferences>;

const iconButton = 'h-7 w-7 shrink-0 p-0';

function IconAction({ label, icon: Icon, disabled, onClick }: { label: string; icon: LucideIcon; disabled?: boolean; onClick(): void }) {
  return (
    <Button type="button" variant="transparent" color="gray" size="mini" className={`${iconButton} text-ui`} aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      <Icon aria-hidden size={14} />
    </Button>
  );
}

export interface RailCustomizeMenuProps {
  preferences: RailPreferences;
  icons: Record<ModuleId, LucideIcon>;
  onOpenModule(id: ModuleId): void;
}

export function RailCustomizeMenu({ preferences, icons, onOpenModule }: RailCustomizeMenuProps) {
  const { t } = useT();
  const name = (id: ModuleId) => t(MODULE_LABEL_KEY[id]);
  const { visible, hidden } = preferences;
  return (
    <div className="flex flex-col gap-2">
      <h2 className={PANEL_TYPE.title}>{t('shell.rail.custom.title')}</h2>
      <p className={`${PANEL_TYPE.meta} text-ink-400`}>{t('shell.rail.custom.hint')}</p>

      <section aria-label={t('shell.rail.custom.hiddenGroup')} className="border-t border-foreground/10 pt-2">
        <h3 className={`${PANEL_TYPE.group} mb-1 px-1`}>{t('shell.rail.custom.hiddenGroup')}</h3>
        {hidden.length === 0 ? (
          <p className={`${PANEL_TYPE.meta} px-1 text-ink-400`}>{t('shell.rail.custom.noneHidden')}</p>
        ) : (
          <ul className="flex flex-col">
            {hidden.map((id) => {
              const Icon = icons[id];
              return (
                <li key={id} className="flex h-7 items-center gap-1">
                  <button type="button" onClick={() => onOpenModule(id)} className={`${focusRing} flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md px-1 text-left hover:bg-ink-800`}>
                    <Icon aria-hidden size={ROW_ICON} className="shrink-0 text-ink-400" />
                    <span className={`${PANEL_TYPE.item} truncate`}>{name(id)}</span>
                  </button>
                  <IconAction label={t('shell.rail.custom.show', { name: name(id) })} icon={Eye} onClick={() => preferences.show(id)} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label={t('shell.rail.custom.visible')} className="border-t border-foreground/10 pt-2">
        <h3 className={`${PANEL_TYPE.group} mb-1 px-1`}>{t('shell.rail.custom.visible')}</h3>
        <ul className="flex flex-col">
          {visible.map((id, index) => {
            const Icon = icons[id];
            return (
              <li key={id} className="flex h-7 items-center gap-1">
                <span className="flex min-w-0 flex-1 items-center gap-2 px-1">
                  <Icon aria-hidden size={ROW_ICON} className="shrink-0 text-ink-400" />
                  <span className={`${PANEL_TYPE.item} truncate`}>{name(id)}</span>
                </span>
                <IconAction label={t('shell.rail.custom.moveUp', { name: name(id) })} icon={ChevronUp} disabled={index === 0} onClick={() => preferences.move(id, -1)} />
                <IconAction label={t('shell.rail.custom.moveDown', { name: name(id) })} icon={ChevronDown} disabled={index === visible.length - 1} onClick={() => preferences.move(id, 1)} />
                {isHideable(id) && <IconAction label={t('shell.rail.custom.hide', { name: name(id) })} icon={EyeOff} onClick={() => preferences.hide(id)} />}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="border-t border-foreground/10 pt-2">
        <Button type="button" size="tiny" variant="outline" color="gray" className="text-ui" disabled={preferences.isDefault} onClick={preferences.reset}>
          <RotateCcw aria-hidden size={14} /> {t('shell.rail.custom.reset')}
        </Button>
      </div>
    </div>
  );
}
