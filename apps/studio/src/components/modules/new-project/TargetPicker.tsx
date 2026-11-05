'use client';

import { Button } from '@e-burgos/tucu-ui';
import { FolderOpen } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/lib/i18n/i18n';
import type { TargetCheckState } from '@/lib/wizard/use-target-check';
import { DirectoryBrowserModal } from './DirectoryBrowserModal';
import { TargetStatus } from './TargetStatus';
import { WizardField } from './WizardField';
import { useWizard } from './wizard-context';

export function TargetPicker({ status }: { status: TargetCheckState }) {
  const { t } = useT();
  const { targetPath, setTargetPath } = useWizard();
  const [browsing, setBrowsing] = useState(false);
  const resolved = status.check?.resolvedPath ?? null;
  return (
    <div className="flex flex-col gap-2">
      <WizardField field="target" label={t('wizard.target.label')} value={targetPath} hint={t('wizard.target.hint')} onChange={setTargetPath} />
      <Button type="button" size="tiny" variant="outline" color="gray" className="w-fit text-ui" onClick={() => setBrowsing(true)}>
        <FolderOpen aria-hidden size={14} className="mr-1" />
        {t('wizard.target.browse')}
      </Button>
      {resolved !== null && (
        <p data-testid="target-normalized" className="break-all text-small text-ink-300">
          {t('wizard.target.normalized', { path: resolved })}
        </p>
      )}
      <TargetStatus state={status} />
      <DirectoryBrowserModal
        isOpen={browsing}
        onClose={() => setBrowsing(false)}
        onPick={(path) => {
          setTargetPath(path);
          setBrowsing(false);
        }}
      />
    </div>
  );
}
