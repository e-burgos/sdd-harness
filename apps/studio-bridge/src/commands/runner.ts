import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { KitCommandName, ServerEvent } from '@sdd-studio/protocol';

const SCRIPTS: Record<KitCommandName, string> = {
  gate: 'spec-gate.mjs',
  validate: 'validate-sdd.mjs',
  'rebuild-tasks-index': 'rebuild-tasks-index.mjs',
  'rebuild-catalog': 'rebuild-catalog.mjs',
};

export class CommandRunner {
  constructor(
    private readonly root: string,
    private readonly broadcast: (event: ServerEvent) => void,
    private readonly newId: () => string = randomUUID,
  ) {}

  /** `args` ya viene validado por el protocolo; se pasa sin shell. */
  run(name: KitCommandName, args: string[]): string {
    const runId = this.newId();
    const script = path.join(this.root, 'sdd', 'scripts', SCRIPTS[name]);
    const child = spawn(process.execPath, [script, ...args], { cwd: this.root, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    let exited = false;
    const exit = (exitCode: number) => {
      if (exited) return;
      exited = true;
      this.broadcast({ kind: 'command.exit', runId, exitCode });
    };
    child.stdout.on('data', (chunk: string) =>
      this.broadcast({ kind: 'command.output', runId, stream: 'stdout', chunk }),
    );
    child.stderr.on('data', (chunk: string) =>
      this.broadcast({ kind: 'command.output', runId, stream: 'stderr', chunk }),
    );
    child.on('error', (error) => {
      this.broadcast({ kind: 'command.output', runId, stream: 'stderr', chunk: error.message });
      exit(127);
    });
    child.on('close', (code) => exit(code ?? 1));
    return runId;
  }
}
