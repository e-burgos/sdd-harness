'use client';

import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { RightPanelFrame } from '../../shell/RightPanelFrame';
import { ConfigPreview } from './ConfigPreview';
import { IssueList } from './IssueList';
import { ProjectTree } from './ProjectTree';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-foreground/10 pt-3 first:border-t-0 first:pt-0">
      <h3 className="text-small font-medium text-ink-400">{title}</h3>
      {children}
    </section>
  );
}

export function NewProjectRight() {
  const { t } = useT();
  return (
    <RightPanelFrame title={t('wizard.right.title')}>
      <div className="flex flex-col gap-4">
        <Section title={t('wizard.right.issues')}>
          <IssueList />
        </Section>
        <Section title={t('wizard.right.tree')}>
          <ProjectTree />
        </Section>
        <Section title={t('wizard.right.config')}>
          <ConfigPreview label={t('wizard.summary.config')} />
        </Section>
      </div>
    </RightPanelFrame>
  );
}
