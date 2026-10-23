import type { AgentSummary, FileSearchResult, SkillSummary } from '@sdd-studio/protocol';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import type { ActiveMention } from '@/lib/mention';
import { useMentionMenu, type MentionMenuOptions } from '@/lib/use-mention-menu';
import { MentionMenu } from './MentionMenu';

const agent = (id: string): AgentSummary => ({ id, description: `desc ${id}`, model: null, source: 'sdd', path: `.claude/agents/${id}.md` });
const skill = (id: string, path = `.claude/skills/${id}/SKILL.md`, kind: 'skill' | 'prompt' = 'skill'): SkillSummary => ({ id, kind, description: `skill ${id}`, source: 'sdd', path });
const files = (paths: string[], truncated = false): FileSearchResult => ({ query: '', files: paths.map((path) => ({ path })), truncated, source: 'git' });

const base = (over: Partial<MentionMenuOptions> = {}): MentionMenuOptions => ({
  mention: { trigger: '@', query: '', start: 0 },
  agents: [agent('sdd-planner'), agent('sdd-reviewer')],
  skills: [skill('generate:react'), skill('sdd-hermes-prompt', 'sdd/prompts/hermes-resume.prompt.md', 'prompt')],
  catalogEnabled: true,
  searchFiles: null,
  onSelect: vi.fn(),
  onClose: vi.fn(),
  ...over,
});

function Harness(props: MentionMenuOptions) {
  const menu = useMentionMenu(props);
  return (
    <div>
      <textarea aria-label="box" {...menu.comboboxProps} onKeyDown={(e) => { if (!menu.onKeyDown(e) && e.key === 'Enter') e.currentTarget.dataset['sent'] = 'yes'; }} />
      <MentionMenu menu={menu} />
    </div>
  );
}

const ui = (props: MentionMenuOptions) => <I18nProvider initial="es"><Harness {...props} /></I18nProvider>;
const options = () => screen.queryAllByRole('option').map((o) => o.textContent);

describe('MentionMenu @', () => {
  it('shows only agents when the query is empty and file search is unavailable', () => {
    render(ui(base()));
    expect(screen.getByRole('group', { name: 'Agentes' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Archivos' })).toBeNull();
    expect(options()).toEqual(['@sdd-plannerdesc sdd-planner', '@sdd-reviewerdesc sdd-reviewer']);
  });

  it('hides the agents group without the catalog capability', () => {
    render(ui(base({ catalogEnabled: false })));
    expect(screen.queryByRole('group', { name: 'Agentes' })).toBeNull();
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });

  it('keeps the agents group with a not-found hint when the repo has no agents', () => {
    render(ui(base({ agents: [] })));
    expect(screen.getByRole('group', { name: 'Agentes' })).toHaveTextContent('No se encontraron agentes en el repo.');
    expect(screen.queryByText('Sin resultados')).toBeNull();
  });

  it('names the query when nothing matches', async () => {
    render(ui(base({ mention: { trigger: '@', query: 'zzz', start: 0 }, searchFiles: async () => files([]) })));
    expect(await screen.findByText('Sin resultados para «zzz»')).toBeInTheDocument();
  });

  it('filters agents locally by query', () => {
    const mention: ActiveMention = { trigger: '@', query: 'rev', start: 0 };
    render(ui(base({ mention })));
    expect(options()).toEqual(['@sdd-reviewerdesc sdd-reviewer']);
  });

  it('puts the agents group above files when the query matches an agent', async () => {
    const searchFiles = vi.fn(async () => files(['docs/reviewer-notes.md']));
    render(ui(base({ mention: { trigger: '@', query: 'rev', start: 0 }, searchFiles })));
    await screen.findByRole('group', { name: 'Archivos' });
    expect(screen.getAllByRole('group').map((g) => g.firstElementChild?.textContent)).toEqual(['Agentes', 'Archivos']);
    expect(options()).toEqual(['@sdd-reviewerdesc sdd-reviewer', 'docs/reviewer-notes.md']);
  });

  it('keeps files above the agents hint when the query matches no agent', async () => {
    const searchFiles = vi.fn(async () => files(['docs/notes.md']));
    render(ui(base({ mention: { trigger: '@', query: 'notes', start: 0 }, searchFiles, agents: [] })));
    await screen.findByRole('group', { name: 'Archivos' });
    expect(screen.getAllByRole('group').map((g) => g.firstElementChild?.textContent)).toEqual(['Archivos', 'Agentes']);
  });

  it('debounces file search by 120 ms and shows loading then results with the file group', async () => {
    const searchFiles = vi.fn(async () => files(['src/a.ts', 'src/b.ts']));
    render(ui(base({ mention: { trigger: '@', query: 'src', start: 0 }, searchFiles })));
    expect(searchFiles).not.toHaveBeenCalled();
    expect(screen.getByText('Buscando…')).toBeInTheDocument();
    await waitFor(() => expect(searchFiles).toHaveBeenCalledWith('src', 30));
    await screen.findByRole('group', { name: 'Archivos' });
    expect(options().slice(0, 2)).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('collapses rapid typing into one search and discards stale responses by sequence', async () => {
    const resolvers: Record<string, (r: FileSearchResult) => void> = {};
    const searchFiles = vi.fn((q: string) => new Promise<FileSearchResult>((resolve) => { resolvers[q] = resolve; }));
    const { rerender } = render(ui(base({ mention: { trigger: '@', query: 'a', start: 0 }, searchFiles })));
    await waitFor(() => expect(searchFiles).toHaveBeenCalledTimes(1));
    rerender(ui(base({ mention: { trigger: '@', query: 'ab', start: 0 }, searchFiles })));
    await waitFor(() => expect(searchFiles).toHaveBeenCalledTimes(2));
    resolvers['ab']!(files(['ab.ts']));
    await screen.findByText('ab.ts');
    resolvers['a']!(files(['a-old.ts']));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText('a-old.ts')).toBeNull();
    expect(screen.getByText('ab.ts')).toBeInTheDocument();
  });

  it('reports search errors and truncated results', async () => {
    const failing = vi.fn(async () => { throw new Error('x'); });
    const { unmount } = render(ui(base({ mention: { trigger: '@', query: 'q', start: 0 }, searchFiles: failing })));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo buscar archivos.');
    unmount();
    render(ui(base({ mention: { trigger: '@', query: 'q', start: 0 }, searchFiles: async () => files(['x.ts'], true) })));
    expect(await screen.findByText('Hay más resultados: afiná la búsqueda.')).toBeInTheDocument();
  });
});

describe('MentionMenu /', () => {
  const slash: ActiveMention = { trigger: '/', query: '', start: 0 };

  it('lists fixed commands and skills without prompts already exposed as commands', () => {
    render(ui(base({ mention: slash })));
    expect(screen.getByRole('group', { name: 'Comandos' })).toBeInTheDocument();
    const labels = options().join('|');
    expect(labels).toContain('/gate');
    expect(labels).toContain('/open-cycle');
    expect(labels).toContain('/generate:react');
    expect(labels).not.toContain('sdd-hermes-prompt');
  });

  it('keeps the commands and a not-found hint when the repo has no skills or prompts', () => {
    render(ui(base({ mention: slash, skills: [] })));
    expect(options().join('|')).toContain('/validate');
    expect(screen.getByRole('group', { name: 'Skills y prompts' })).toHaveTextContent('No se encontraron skills ni prompts en el repo.');
  });

  it('hides the skills group without the catalog capability', () => {
    render(ui(base({ mention: slash, catalogEnabled: false })));
    expect(screen.queryByRole('group', { name: 'Skills y prompts' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Comandos' })).toBeInTheDocument();
  });
});

describe('MentionMenu keyboard and ARIA', () => {
  it('wires combobox, listbox and activedescendant', () => {
    render(ui(base()));
    const box = screen.getByRole('combobox');
    const list = screen.getByRole('listbox');
    expect(box).toHaveAttribute('aria-expanded', 'true');
    expect(box).toHaveAttribute('aria-controls', list.id);
    const [first] = screen.getAllByRole('option');
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(box).toHaveAttribute('aria-activedescendant', first!.id);
  });

  it('moves with arrows, wraps, and picks with Enter or Tab without sending', () => {
    const onSelect = vi.fn();
    render(ui(base({ onSelect })));
    const box = screen.getByRole('combobox');
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(box, { key: 'ArrowUp' });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'agent', id: 'sdd-reviewer' }));
    fireEvent.keyDown(box, { key: 'Tab' });
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(box.dataset['sent']).toBeUndefined();
  });

  it('closes on Escape and treats Enter on an empty menu as close, not send', () => {
    const onClose = vi.fn();
    render(ui(base({ onClose, catalogEnabled: false })));
    const box = screen.getByRole('combobox');
    fireEvent.keyDown(box, { key: 'Escape' });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(box.dataset['sent']).toBeUndefined();
  });

  it('selects with the mouse and lets Enter through when the menu is closed', () => {
    const onSelect = vi.fn();
    const { rerender } = render(ui(base({ onSelect })));
    fireEvent.mouseDown(screen.getAllByRole('option')[0]!);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'sdd-planner' }));
    rerender(ui(base({ onSelect, mention: null })));
    const box = screen.getByRole('combobox');
    expect(box).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(box.dataset['sent']).toBe('yes');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
