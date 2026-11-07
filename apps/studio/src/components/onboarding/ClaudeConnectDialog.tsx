'use client';

import { Modal } from '@e-burgos/tucu-ui';
import { useT } from '@/lib/i18n/i18n';
import { AuthPanel } from '../workspace/AuthPanel';

export function ClaudeConnectDialog({ isOpen, onClose }: { isOpen: boolean; onClose(): void }) {
  const { t } = useT();
  return (
    <Modal isOpen={isOpen} setIsOpen={() => undefined} onClose={onClose} hideButtons size="md" text={{ title: t('onboarding.claude.dialog') }}>
      <AuthPanel defaultOpen />
    </Modal>
  );
}
