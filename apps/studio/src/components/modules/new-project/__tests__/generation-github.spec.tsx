import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { GenerationState } from '@sdd-studio/protocol';
import { isGithubSkipped, saveGenerationPointer } from '@/lib/wizard/persist';
import { renderWizard, withFeatures } from './harness';
import { generationState, preloadFullstack, summaryClient } from './summary-fixtures';

const succeeded = (): GenerationState =>
  generationState({
    status: 'succeeded',
    stages: ['prepare', 'scaffold', 'install', 'generate', 'validate', 'build'].map((stage) => ({ stage, status: 'done' })) as GenerationState['stages'],
    gate: { validate: 'pass', build: 'pass' },
    hasSdd: true,
    exitCode: 0,
    finishedAt: '2026-11-04T10:05:00.000Z',
  });

const githubStatus = {
  gh: { installed: true, authenticated: true, user: 'octo' },
  git: { repo: true, branch: 'main', hasCommits: true },
  remote: null,
  workflow: true,
};

function open(features: string[]) {
  preloadFullstack();
  const generation = succeeded();
  saveGenerationPointer({ generationId: generation.id, target: generation.target, lastSeq: 0, lastStatus: generation.status }, window.sessionStorage);
  const fake = withFeatures(
    summaryClient({
      'wizard.generation.get': () => ({ generation, output: [], truncatedBefore: false, hasMore: false }),
      'github.status': () => githubStatus,
    }),
    features,
  );
  renderWizard({ fake });
  return { fake, generation };
}

afterEach(cleanup);

describe('GenerationResult GitHub step', () => {
  it('offers the GitHub panel for the generation next to the open button', async () => {
    const { fake, generation } = open(['project-wizard', 'workspace-switch', 'github']);
    expect(await screen.findByTestId('result-github')).toBeInTheDocument();
    expect(await screen.findByTestId('github-name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir en Studio' })).toBeEnabled();
    expect(fake.requests.find((r) => r.cmd === 'github.status')).toEqual({ cmd: 'github.status', generationId: generation.id });
  });

  it('prefills the repository name from the wizard project', async () => {
    open(['project-wizard', 'workspace-switch', 'github']);
    const name = (await screen.findByTestId('github-name')) as HTMLInputElement;
    expect(name.value).not.toBe('');
  });

  it('hides the section on Ahora no, remembers it for the session and keeps opening available', async () => {
    const { generation } = open(['project-wizard', 'workspace-switch', 'github']);
    await screen.findByTestId('github-name');
    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
    await waitFor(() => expect(screen.queryByTestId('result-github')).toBeNull());
    expect(isGithubSkipped(generation.id, window.sessionStorage)).toBe(true);
    expect(screen.getByRole('button', { name: 'Abrir en Studio' })).toBeEnabled();
  });

  it('shows a one-line note when the bridge lacks the github feature', async () => {
    open(['project-wizard', 'workspace-switch']);
    expect(await screen.findByTestId('result-github-unavailable')).toHaveTextContent('no está disponible con este puente');
    expect(screen.queryByTestId('github-form')).toBeNull();
    expect(screen.getByRole('button', { name: 'Abrir en Studio' })).toBeEnabled();
  });
});
