import { defineCommand } from 'citty';
import {
  ghStatus,
  getGithubRunner,
  gitStatus,
  parseRemoteUrl,
  protectBranch,
  REQUIRED_CHECK,
} from '../../utils/github.js';
import {
  decideConfirmation,
  dirArg,
  GH_AUTH_HELP,
  GH_INSTALL_HELP,
  printError,
  printJson,
  printLine,
  resolveDir,
} from './shared.js';

export const protectCommand = defineCommand({
  meta: {
    name: 'protect',
    description: `Require the "${REQUIRED_CHECK}" status check on a branch (default: the current branch)`,
  },
  args: {
    dir: dirArg,
    branch: { type: 'string', description: 'Branch to protect (default: current branch)' },
    yes: { type: 'boolean', description: 'Skip the confirmation prompt', default: false },
    json: { type: 'boolean', description: 'Machine-readable output', default: false },
  },
  async run({ args }) {
    const cwd = resolveDir(args.dir);
    const run = getGithubRunner();
    const fail = (message: string, code: string) => {
      printError(message);
      if (args.json) printJson({ ok: false, error: { code, message } });
      process.exitCode = 1;
    };

    const gh = await ghStatus(run, cwd);
    if (!gh.installed) return fail(GH_INSTALL_HELP, 'gh-missing');
    if (!gh.authenticated) return fail(GH_AUTH_HELP, 'gh-unauthenticated');

    const git = await gitStatus(run, cwd);
    const ref = git.originUrl ? parseRemoteUrl(git.originUrl) : null;
    if (!ref) return fail('No GitHub `origin` remote found. Run `harness github connect` first.', 'no-remote');
    const branch = args.branch || git.branch;
    if (!branch) return fail('Could not determine the branch to protect. Pass --branch.', 'no-branch');

    const plan = { owner: ref.owner, name: ref.name, branch, requiredCheck: REQUIRED_CHECK };
    if (!args.json) {
      printLine(`Protect ${ref.owner}/${ref.name}@${branch}: require status check "${REQUIRED_CHECK}".`);
    }
    const decision = await decideConfirmation({
      yes: args.yes,
      json: args.json,
      message: `Apply branch protection on ${branch}?`,
    });
    if (decision === 'needs-confirmation') {
      if (args.json) printJson({ ok: false, needsConfirmation: true, plan });
      else printLine('Not applied: re-run with --yes to confirm.');
      return;
    }
    if (decision === 'declined') {
      printLine('Cancelled.');
      return;
    }

    const result = await protectBranch(run, { owner: ref.owner, name: ref.name, branch, cwd });
    if (result.code !== 0) return fail(result.stderr.trim() || 'gh api failed', 'protect-failed');
    if (args.json) printJson({ ok: true, plan, protected: true });
    else printLine(`Branch ${branch} is now protected.`);
  },
});
