import { render, screen } from '@testing-library/react';
import type { WorkspaceSnapshot } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from '../BridgeProvider';
import { ChannelView } from './ChannelView';

const snapshot: WorkspaceSnapshot = {
  project: 'p', profile: 'team', kitVersion: '0.16.0', gateMode: 'block', pricing: null, stale: [], fixes: [], agents: [],
  specs: [
    { id: 's1', title: 'Uno', status: 'in-progress', folder: 'sdd/specs/s1', module: null, app: null, dependsOn: [] },
    { id: 's2', title: 'Dos', status: 'draft', folder: 'sdd/specs/s2', module: null, app: null, dependsOn: [] },
  ],
  cycles: [],
};

function view(channelId: string, lang: 'es' | 'en') {
  const store = createStudioStore();
  store.getState().setSnapshot(snapshot);
  const value = { client: { request: vi.fn() }, store, connection: { status: 'idle' } } as unknown as BridgeContextValue;
  render(
    <I18nProvider initial={lang}>
      <BridgeContext.Provider value={value}>
        <ChannelView channelId={channelId} onOpenThread={vi.fn()} composer={null} />
      </BridgeContext.Provider>
    </I18nProvider>,
  );
}

describe('ChannelView header', () => {
  it('translates a known spec status', () => {
    view('spec:s1', 'es');
    expect(screen.getByText('en curso')).toBeInTheDocument();
  });
  it('translates to English', () => {
    view('spec:s1', 'en');
    expect(screen.getByText('in progress')).toBeInTheDocument();
  });
  it('falls back to the raw status', () => {
    view('spec:s2', 'es');
    expect(screen.getByText('draft')).toBeInTheDocument();
  });
});
