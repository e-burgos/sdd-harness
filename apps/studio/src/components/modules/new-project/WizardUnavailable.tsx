'use client';

import { CapabilityNotice } from '../../mission-control/CapabilityNotice';
import { useBridgeFeatures } from '@/lib/use-bridge-features';

export function useWizardUnavailable(): boolean {
  return useBridgeFeatures().missing(['project-wizard']).length > 0;
}

export function WizardUnavailable() {
  return (
    <div data-testid="wizard-unavailable" className="p-4">
      <CapabilityNotice capabilities={['project-wizard']} />
    </div>
  );
}
