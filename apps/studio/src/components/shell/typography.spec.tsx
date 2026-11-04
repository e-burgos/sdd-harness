import { act, fireEvent, screen } from '@testing-library/react';
import { Fragment } from 'react';
import { MODULE_ICONS, MODULES } from '@/lib/nav/modules';
import { MODULE_IDS } from '@/lib/nav/module-ids';
import { useRailPreferences } from '@/lib/nav/use-rail-preferences';
import { ModulePanel } from './ModulePanel';
import { ModuleRail } from './ModuleRail';
import { PanelGroup } from './PanelGroup';
import { PanelRow } from './PanelRow';
import { RightPanelFrame } from './RightPanelFrame';
import { SectionListPanel } from './SectionListPanel';
import { wizardClient } from '../modules/new-project/__tests__/harness';
import { bridgeValue, renderShell } from './shell-test-utils';

const FORBIDDEN = /^text-(?:xs|sm|base|lg|[2-9]?xl|body|\[(?:\d|length:).*)$/;
const SCOPES = '[data-studio-panel], [data-studio-rail]';

function forbiddenClassesWithin(root: ParentNode): string[] {
  const found: string[] = [];
  root.querySelectorAll(SCOPES).forEach((scope) => {
    [scope, ...Array.from(scope.querySelectorAll('*'))].filter((element) => !element.closest('[data-studio-exempt]')).forEach((element) => {
      const tokens = (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
      tokens.filter((token) => FORBIDDEN.test(token.replace(/^[a-z-]+:/, ''))).forEach((token) => found.push(`${element.tagName.toLowerCase()}.${token}`));
    });
  });
  return found;
}

function RailHarness() {
  const preferences = useRailPreferences('fixture-project');
  return (
    <ModuleRail
      project="fixture-project"
      kitVersion="0.17.0"
      activeModule="home"
      icons={MODULE_ICONS}
      preferences={preferences}
      connection="open"
      onSelectModule={() => undefined}
      onNewConversation={() => undefined}
    />
  );
}

describe('panel type scale', () => {
  beforeEach(() => window.localStorage.clear());

  it.each(MODULE_IDS)('the %s module panel and right panel use only scale tokens', (id) => {
    const { Panel, Right, Scope = Fragment } = MODULES[id];
    const { container } = renderShell(
      <Scope>
        <Panel />
        {Right && <Right />}
      </Scope>,
      { value: id === 'new-project' ? bridgeValue({ client: wizardClient().client as never }) : undefined },
    );
    expect(container.querySelector(SCOPES)).not.toBeNull();
    expect(forbiddenClassesWithin(container)).toEqual([]);
  });

  it('ModulePanel keeps the scale in ready, loading, error and empty-search states', () => {
    const states = [
      <ModulePanel key="ready" moduleId="specs">
        <PanelGroup id="a" title="Activas" count={2}>
          <PanelRow label="spec-dev-001-pagos" meta="2/4" selected onClick={() => undefined} />
          <PanelRow label="otra" />
        </PanelGroup>
      </ModulePanel>,
      <ModulePanel key="loading" moduleId="specs" status="loading" />,
      <ModulePanel key="error" moduleId="specs" status="error" onRetry={() => undefined} />,
    ];
    states.forEach((state) => {
      const { container, unmount } = renderShell(state);
      expect(forbiddenClassesWithin(container)).toEqual([]);
      unmount();
    });
    const { container } = renderShell(
      <ModulePanel moduleId="specs" hasResults={false}>
        <span />
      </ModulePanel>,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zzz' } });
    expect(screen.getByText(/Sin resultados para «zzz»/)).toBeInTheDocument();
    expect(forbiddenClassesWithin(container)).toEqual([]);
  });

  it('SectionListPanel keeps the scale', () => {
    const { container } = renderShell(<SectionListPanel moduleId="architecture" groupTitle="Secciones" sections={[{ id: 'db', label: 'Base de datos', count: 3 }]} selected="db" onSelect={() => undefined} />);
    expect(forbiddenClassesWithin(container)).toEqual([]);
  });

  it('the rail, the customize menu and the account popover keep the scale', () => {
    const { container } = renderShell(<RailHarness />);
    expect(forbiddenClassesWithin(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    expect(screen.getByRole('dialog', { name: 'Personalizar riel' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar Specs' }));
    expect(forbiddenClassesWithin(container)).toEqual([]);
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cuenta y conexión' }));
    expect(screen.getByRole('dialog', { name: 'Cuenta y conexión' })).toBeInTheDocument();
    expect(forbiddenClassesWithin(container)).toEqual([]);
  });

  it('the detector flags forbidden classes', () => {
    const { container } = renderShell(
      <RightPanelFrame>
        <span className="text-sm">x</span>
        <span className="text-[13px]">y</span>
        <span className="md:text-xs">z</span>
        <span className="text-body">w</span>
      </RightPanelFrame>,
    );
    expect(forbiddenClassesWithin(container).sort()).toEqual(['span.md:text-xs', 'span.text-[13px]', 'span.text-body', 'span.text-sm'].sort());
  });
});
