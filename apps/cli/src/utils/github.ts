import { execFile } from 'node:child_process';

export const REQUIRED_CHECK = 'sdd:validate';

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  cwd: string;
  input?: string;
}

export type Runner = (cmd: string, args: string[], opts: RunOptions) => Promise<RunResult>;

export const defaultRunner: Runner = (cmd, args, opts) =>
  new Promise((resolvePromise) => {
    const child = execFile(
      cmd,
      args,
      { cwd: opts.cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (!error) return resolvePromise({ code: 0, stdout, stderr });
        const code = typeof error.code === 'number' ? error.code : 127;
        resolvePromise({ code, stdout: stdout ?? '', stderr: stderr || error.message });
      },
    );
    if (opts.input !== undefined) child.stdin?.end(opts.input);
  });

let activeRunner: Runner = defaultRunner;

export function setGithubRunner(runner: Runner | null): void {
  activeRunner = runner ?? defaultRunner;
}

export function getGithubRunner(): Runner {
  return activeRunner;
}

export interface GhStatus {
  installed: boolean;
  authenticated: boolean;
  user: string | null;
}

export async function ghStatus(run: Runner, cwd: string): Promise<GhStatus> {
  const version = await run('gh', ['--version'], { cwd });
  if (version.code !== 0) return { installed: false, authenticated: false, user: null };
  const auth = await run('gh', ['auth', 'status'], { cwd });
  if (auth.code !== 0) return { installed: true, authenticated: false, user: null };
  const who = await run('gh', ['api', 'user', '--jq', '.login'], { cwd });
  const user = who.code === 0 ? who.stdout.trim() || null : null;
  return { installed: true, authenticated: true, user };
}

export interface GitStatus {
  repo: boolean;
  branch: string | null;
  hasCommits: boolean;
  originUrl: string | null;
}

export async function gitStatus(run: Runner, cwd: string): Promise<GitStatus> {
  const inside = await run('git', ['rev-parse', '--is-inside-work-tree'], { cwd });
  if (inside.code !== 0 || inside.stdout.trim() !== 'true') {
    return { repo: false, branch: null, hasCommits: false, originUrl: null };
  }
  const branch = await run('git', ['symbolic-ref', '--short', 'HEAD'], { cwd });
  const head = await run('git', ['rev-parse', '--verify', 'HEAD'], { cwd });
  const origin = await run('git', ['remote', 'get-url', 'origin'], { cwd });
  return {
    repo: true,
    branch: branch.code === 0 ? branch.stdout.trim() || null : null,
    hasCommits: head.code === 0,
    originUrl: origin.code === 0 ? origin.stdout.trim() || null : null,
  };
}

export interface RepoRef {
  owner: string;
  name: string;
}

const REMOTE_PATTERNS = [
  /^https?:\/\/(?:[^@/]+@)?github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i,
  /^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i,
  /^ssh:\/\/git@github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i,
];

export function parseRemoteUrl(url: string): RepoRef | null {
  const trimmed = url.trim();
  for (const pattern of REMOTE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match) return { owner: match[1], name: match[2] };
  }
  return null;
}

export function createRepoArgs(opts: {
  owner?: string;
  name: string;
  visibility: 'private' | 'public';
}): string[] {
  const slug = opts.owner ? `${opts.owner}/${opts.name}` : opts.name;
  return ['repo', 'create', slug, `--${opts.visibility}`, '--source', '.', '--remote', 'origin', '--push'];
}

export async function createRepo(
  run: Runner,
  opts: { owner?: string; name: string; visibility: 'private' | 'public'; cwd: string },
): Promise<RunResult> {
  return run('gh', createRepoArgs(opts), { cwd: opts.cwd });
}

export function protectBranchBody(): string {
  return JSON.stringify({
    required_status_checks: { strict: false, contexts: [REQUIRED_CHECK] },
    enforce_admins: false,
    required_pull_request_reviews: null,
    restrictions: null,
  });
}

export function protectBranchArgs(opts: { owner: string; name: string; branch: string }): string[] {
  return [
    'api',
    '-X',
    'PUT',
    `repos/${opts.owner}/${opts.name}/branches/${opts.branch}/protection`,
    '--input',
    '-',
  ];
}

export async function protectBranch(
  run: Runner,
  opts: { owner: string; name: string; branch: string; cwd: string },
): Promise<RunResult> {
  return run('gh', protectBranchArgs(opts), { cwd: opts.cwd, input: protectBranchBody() });
}
