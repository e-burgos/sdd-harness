import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineCommand } from 'citty';
import { ghStatus, getGithubRunner, gitStatus, parseRemoteUrl } from '../../utils/github.js';
import { dirArg, printJson, printLine, resolveDir } from './shared.js';

export const WORKFLOW_PATH = '.github/workflows/sdd-validate.yml';

function describeGh(gh: { installed: boolean; authenticated: boolean; user: string | null }): string {
  if (!gh.installed) return 'not installed';
  if (!gh.authenticated) return 'installed, not authenticated';
  return gh.user ? `authenticated as ${gh.user}` : 'authenticated';
}

export const statusCommand = defineCommand({
  meta: { name: 'status', description: 'Report gh, git, remote and CI workflow state for this project' },
  args: {
    dir: dirArg,
    json: { type: 'boolean', description: 'Machine-readable output', default: false },
  },
  async run({ args }) {
    const cwd = resolveDir(args.dir);
    const run = getGithubRunner();
    const gh = await ghStatus(run, cwd);
    const git = await gitStatus(run, cwd);
    const ref = git.originUrl ? parseRemoteUrl(git.originUrl) : null;
    const remote = git.originUrl
      ? { url: git.originUrl, owner: ref?.owner ?? null, name: ref?.name ?? null }
      : null;
    const workflow = existsSync(resolve(cwd, WORKFLOW_PATH));

    if (args.json) {
      printJson({
        gh,
        git: { repo: git.repo, branch: git.branch, hasCommits: git.hasCommits },
        remote,
        workflow,
      });
      return;
    }
    printLine(`gh: ${describeGh(gh)}`);
    const gitLine = git.repo
      ? `repo on ${git.branch ?? '(detached)'}${git.hasCommits ? '' : ', no commits'}`
      : 'not a repository';
    printLine(`git: ${gitLine}`);
    printLine(`remote: ${remote ? remote.url : 'none'}`);
    printLine(`workflow ${WORKFLOW_PATH}: ${workflow ? 'present' : 'missing'}`);
  },
});
