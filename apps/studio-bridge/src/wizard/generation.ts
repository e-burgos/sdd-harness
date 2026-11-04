import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import {
  FRAME_BUDGET_BYTES,
  GENERATION_BUFFER_BYTES,
  GENERATION_CHUNK_MAX,
  type GenerationOutputChunk,
  type GenerationSnapshot,
  type GenerationStage,
  type GenerationState,
  type ServerMessage,
} from '@sdd-studio/protocol';
import { SessionError } from '../sessions/session-manager';
import { buildCliEnv } from './cli-env';
import type { HarnessCli } from './cli-locator';
import { nativeRealpath } from './fs-paths';
import { classifyInitLine, type InitMode, type StageSignal } from './init-output';

export const CONFIG_FILE_NAME = 'harness.config.json';
export const INIT_ARGV = ['harness', 'init', '--config', CONFIG_FILE_NAME, '--here', '-y'] as const;
export const OUTPUT_FLUSH_INTERVAL_MS = 50;
export const KILL_GRACE_MS = 5_000;

const STAGES: GenerationStage[] = ['prepare', 'scaffold', 'install', 'generate', 'validate', 'build'];
const MESSAGE_LIMIT = 2000;

type Failure = NonNullable<GenerationState['failure']>;
type StageStatus = GenerationState['stages'][number]['status'];

export type PrepareOutcome = 'ready' | 'config-differs';

async function ensureDirectory(target: string): Promise<void> {
  const missing: string[] = [];
  let current = target;
  for (;;) {
    const info = await lstat(current).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (info) {
      if (!info.isDirectory()) throw new Error(`${current} is not a directory`);
      break;
    }
    missing.unshift(current);
    const parent = path.dirname(current);
    if (parent === current) throw new Error(`no existing ancestor for ${target}`);
    current = parent;
  }
  for (const directory of missing) {
    await mkdir(directory);
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`${directory} changed while it was being created`);
  }
  if ((await nativeRealpath(target)) !== target) throw new Error(`${target} no longer resolves to itself`);
}

export async function prepareTarget(target: string, config: Record<string, unknown>): Promise<PrepareOutcome> {
  await ensureDirectory(target);
  const file = path.join(target, CONFIG_FILE_NAME);
  const text = `${JSON.stringify(config, null, 2)}\n`;
  try {
    await writeFile(file, text, { flag: 'wx' });
    return 'ready';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  return (await readFile(file, 'utf8')) === text ? 'ready' : 'config-differs';
}

interface RunOptions {
  id: string;
  target: string;
  projectName: string;
  mode: InitMode;
  cli: HarnessCli;
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  now: () => Date;
  broadcast: (message: ServerMessage) => void;
  flushIntervalMs: number;
  ringBytes: number;
  killGraceMs: number;
  onSettled: () => void;
}

class GenerationRun {
  private readonly state: GenerationState;
  private readonly chunks: GenerationOutputChunk[] = [];
  private bufferedBytes = 0;
  private droppedThroughSeq = 0;
  private readonly pending: Record<'stdout' | 'stderr', string> = { stdout: '', stderr: '' };
  private readonly partialLine: Record<'stdout' | 'stderr', string> = { stdout: '', stderr: '' };
  private readonly decoders = { stdout: new StringDecoder('utf8'), stderr: new StringDecoder('utf8') };
  private flushTimer: NodeJS.Timeout | null = null;
  private child: ChildProcess | null = null;
  private killTimer: NodeJS.Timeout | null = null;
  private cancelRequested = false;
  private problem: 'network' | 'pnpm-missing' | null = null;
  private lastErrorLine: string | null = null;
  private failedChecks: string[] = [];
  private resolveDone!: () => void;
  readonly done = new Promise<void>((resolve) => {
    this.resolveDone = resolve;
  });

  constructor(private readonly o: RunOptions) {
    this.state = {
      id: o.id,
      target: o.target,
      projectName: o.projectName,
      mode: o.mode,
      cliVersion: o.cli.version,
      argv: [...INIT_ARGV],
      status: 'running',
      stages: STAGES.map((stage, index) => ({ stage, status: index === 0 ? 'active' : 'pending' })),
      gate: { validate: 'pending', build: 'pending' },
      failure: null,
      exitCode: null,
      hasSdd: false,
      startedAt: o.now().toISOString(),
      finishedAt: null,
      lastSeq: 0,
    };
  }

  get id(): string {
    return this.state.id;
  }

  isRunning(): boolean {
    return this.state.status === 'running';
  }

  snapshotState(): GenerationState {
    return structuredClone(this.state);
  }

  announce(): void {
    this.o.broadcast({ kind: 'generation.status', generation: this.snapshotState() });
  }

  snapshot(sinceSeq: number): GenerationSnapshot {
    const output: GenerationOutputChunk[] = [];
    let used = 0;
    let hasMore = false;
    for (const chunk of this.chunks) {
      if (chunk.seq <= sinceSeq) continue;
      const size = Buffer.byteLength(chunk.chunk) + 128;
      if (used + size > FRAME_BUDGET_BYTES && output.length > 0) {
        hasMore = true;
        break;
      }
      used += size;
      output.push({ ...chunk });
    }
    return { generation: this.snapshotState(), output, truncatedBefore: this.droppedThroughSeq > sinceSeq, hasMore };
  }

  private stageStatus(stage: GenerationStage): StageStatus {
    return this.state.stages[STAGES.indexOf(stage)]!.status;
  }

  private setStage(stage: GenerationStage, status: StageStatus): void {
    this.state.stages[STAGES.indexOf(stage)]!.status = status;
  }

  private activeStage(): GenerationStage {
    return this.state.stages.find((entry) => entry.status === 'active')?.stage ?? 'prepare';
  }

  private advanceTo(stage: GenerationStage): boolean {
    const index = STAGES.indexOf(stage);
    if (this.stageStatus(stage) !== 'pending') return false;
    for (const earlier of STAGES.slice(0, index)) {
      if (this.stageStatus(earlier) === 'pending' || this.stageStatus(earlier) === 'active') this.setStage(earlier, 'done');
    }
    this.setStage(stage, 'active');
    return true;
  }

  private failStage(stage: GenerationStage): void {
    this.advanceTo(stage);
    this.setStage(stage, 'failed');
    for (const later of STAGES.slice(STAGES.indexOf(stage) + 1)) {
      if (this.stageStatus(later) === 'pending') this.setStage(later, 'skipped');
    }
  }

  private applySignal(signal: StageSignal): boolean {
    if (signal.type === 'problem') {
      this.problem = signal.problem;
      return false;
    }
    if (signal.type === 'stage') return this.advanceTo(signal.stage);
    if (signal.check === 'validate') {
      this.advanceTo('validate');
      this.state.gate.validate = signal.result;
      if (signal.result === 'pass') {
        this.setStage('validate', 'done');
        this.advanceTo('build');
      } else {
        this.setStage('validate', 'failed');
      }
      return true;
    }
    this.advanceTo('build');
    if (signal.result === 'fail') {
      this.state.gate.build = 'fail';
      this.setStage('build', 'failed');
    } else if (this.state.gate.build !== 'fail') {
      this.state.gate.build = 'pass';
    }
    return true;
  }

  private consumeLines(stream: 'stdout' | 'stderr', text: string): void {
    const lines = (this.partialLine[stream] + text).split(/\r?\n/);
    this.partialLine[stream] = lines.pop() ?? '';
    let changed = false;
    for (const line of lines) changed = this.consumeLine(line) || changed;
    if (changed) this.announce();
  }

  private consumeLine(line: string): boolean {
    const trimmed = line.trim();
    if (trimmed.startsWith('✗') || /ERR_[A-Z_]+/.test(trimmed) || /command not found/.test(trimmed)) this.lastErrorLine = trimmed;
    const signal = classifyInitLine(line, this.o.mode);
    if (!signal) return false;
    if (signal.type === 'gate' && signal.result === 'fail') this.failedChecks.push(trimmed.replace(/^[✗\s]+/, ''));
    return this.applySignal(signal);
  }

  private onData(stream: 'stdout' | 'stderr', data: Buffer): void {
    const text = this.decoders[stream].write(data);
    if (text === '') return;
    this.pending[stream] += text;
    this.consumeLines(stream, text);
    if (this.pending[stream].length >= GENERATION_CHUNK_MAX) this.flushOutput();
    else this.scheduleFlush();
  }

  private scheduleFlush(): void {
    this.flushTimer ??= setTimeout(() => this.flushOutput(), this.o.flushIntervalMs);
  }

  private flushOutput(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    for (const stream of ['stdout', 'stderr'] as const) {
      const text = this.pending[stream];
      this.pending[stream] = '';
      for (let offset = 0; offset < text.length; offset += GENERATION_CHUNK_MAX) {
        this.pushChunk(stream, text.slice(offset, offset + GENERATION_CHUNK_MAX));
      }
    }
  }

  private pushChunk(stream: 'stdout' | 'stderr', chunk: string): void {
    const seq = ++this.state.lastSeq;
    this.chunks.push({ seq, stream, chunk });
    this.bufferedBytes += Buffer.byteLength(chunk);
    while (this.bufferedBytes > this.o.ringBytes && this.chunks.length > 1) {
      const evicted = this.chunks.shift()!;
      this.bufferedBytes -= Buffer.byteLength(evicted.chunk);
      this.droppedThroughSeq = evicted.seq;
    }
    this.o.broadcast({ kind: 'generation.output', generationId: this.state.id, seq, stream, chunk });
  }

  launch(): void {
    this.setStage('prepare', 'done');
    if (this.cancelRequested) {
      this.skipUnfinished();
      return this.conclude('cancelled', { stage: 'scaffold', kind: 'cancelled', message: 'cancelled by the user' });
    }
    this.setStage('scaffold', 'active');
    const child = spawn(process.execPath, [this.o.cli.bin, ...INIT_ARGV.slice(1)], {
      cwd: this.o.target,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: this.o.platform !== 'win32',
      env: buildCliEnv(this.o.env),
      windowsHide: true,
    });
    this.child = child;
    child.stdout!.on('data', (data: Buffer) => this.onData('stdout', data));
    child.stderr!.on('data', (data: Buffer) => this.onData('stderr', data));
    child.once('error', (error) => this.finish({ spawnError: error }));
    child.once('close', (code, signal) => this.finish({ code, signal }));
    this.announce();
  }

  failPrepare(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.failStage('prepare');
    this.conclude('failed', { stage: 'prepare', kind: 'prepare', message });
  }

  private killGroup(signal: NodeJS.Signals): void {
    const pid = this.child?.pid;
    if (pid === undefined) return;
    if (this.o.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { shell: false, stdio: 'ignore', windowsHide: true }).on('error', () => undefined);
      return;
    }
    try {
      process.kill(-pid, signal);
    } catch {
      return;
    }
  }

  cancel(): Promise<void> {
    if (!this.isRunning()) return this.done;
    this.cancelRequested = true;
    if (this.child === null) return this.done;
    this.killGroup('SIGTERM');
    if (this.o.platform !== 'win32') {
      this.killTimer ??= setTimeout(() => this.killGroup('SIGKILL'), this.o.killGraceMs);
    }
    return this.done;
  }

  private finish(result: { code: number | null; signal: NodeJS.Signals | null } | { spawnError: Error }): void {
    if (!this.isRunning()) return;
    if (this.killTimer) clearTimeout(this.killTimer);
    for (const stream of ['stdout', 'stderr'] as const) {
      const rest = this.decoders[stream].end();
      if (rest !== '') {
        this.pending[stream] += rest;
        this.partialLine[stream] += rest;
      }
      const tail = this.partialLine[stream];
      this.partialLine[stream] = '';
      if (tail !== '') this.consumeLine(tail);
    }
    this.flushOutput();

    if ('spawnError' in result) {
      this.failStage(this.activeStage());
      return this.conclude('failed', { stage: 'scaffold', kind: 'cli-missing', message: result.spawnError.message });
    }
    const { code, signal } = result;
    this.state.exitCode = code;
    if (this.cancelRequested && code !== 0) {
      const stage = this.activeStage();
      this.skipUnfinished();
      return this.conclude('cancelled', { stage, kind: 'cancelled', message: 'cancelled by the user' });
    }
    if (code === null) {
      const stage = this.activeStage();
      this.failStage(stage);
      return this.conclude('interrupted', { stage, kind: 'signal', message: `process terminated by ${signal ?? 'a signal'}` });
    }
    if (code === 0) return this.concludeCleanExit();
    return this.concludeFailedExit(code);
  }

  private skipUnfinished(): void {
    for (const entry of this.state.stages) {
      if (entry.status === 'pending' || entry.status === 'active') entry.status = 'skipped';
    }
  }

  private concludeCleanExit(): void {
    const { validate, build } = this.state.gate;
    if (validate === 'pass' && build === 'pass') {
      for (const entry of this.state.stages) entry.status = 'done';
      return this.conclude('succeeded', null);
    }
    const stage: GenerationStage = validate !== 'pass' ? 'validate' : 'build';
    this.failStage(stage);
    return this.conclude('gate-failed', { stage, kind: 'gate', message: 'the verification gate did not report success' });
  }

  private concludeFailedExit(code: number): void {
    const { validate, build } = this.state.gate;
    const gateReached = this.stageStatus('validate') !== 'pending';
    if (gateReached && (validate === 'fail' || build === 'fail')) {
      const stage: GenerationStage = validate === 'fail' ? 'validate' : 'build';
      this.failStage(stage);
      return this.conclude('gate-failed', { stage, kind: 'gate', message: this.failedChecks.join('; ') || `exit code ${code}` });
    }
    const stage = this.activeStage();
    this.failStage(stage);
    const kind: Failure['kind'] = this.problem ?? (stage === 'install' ? 'install' : 'cli');
    return this.conclude('failed', { stage, kind, message: this.lastErrorLine ?? `harness exited with code ${code}` });
  }

  private conclude(status: GenerationState['status'], failure: Failure | null): void {
    this.state.status = status;
    this.state.failure = failure ? { ...failure, message: failure.message.slice(0, MESSAGE_LIMIT) } : null;
    this.state.finishedAt = this.o.now().toISOString();
    this.state.hasSdd = existsSync(path.join(this.o.target, 'sdd'));
    this.o.onSettled();
    this.announce();
    this.resolveDone();
  }
}

export interface GenerationRegistryOptions {
  broadcast: (message: ServerMessage) => void;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  now?: () => Date;
  newId?: () => string;
  flushIntervalMs?: number;
  ringBytes?: number;
  killGraceMs?: number;
}

export type StartOutcome = { outcome: 'started'; generation: GenerationState } | { outcome: 'config-differs' };

export class GenerationRegistry {
  private active: GenerationRun | null = null;
  private last: GenerationRun | null = null;

  constructor(private readonly o: GenerationRegistryOptions) {}

  activeTarget(): string | null {
    return this.active?.snapshotState().target ?? null;
  }

  find(id: string): GenerationState | null {
    const run = [this.active, this.last].find((candidate) => candidate?.id === id);
    return run?.snapshotState() ?? null;
  }

  async start(a: { cli: HarnessCli; config: Record<string, unknown>; target: string; mode: InitMode; projectName: string }): Promise<StartOutcome> {
    if (this.active) throw new SessionError('conflict', `a generation is already running in ${this.active.snapshotState().target}`);
    const run = new GenerationRun({
      id: (this.o.newId ?? randomUUID)(),
      target: a.target,
      projectName: a.projectName,
      mode: a.mode,
      cli: a.cli,
      env: this.o.env ?? process.env,
      platform: this.o.platform ?? process.platform,
      now: this.o.now ?? (() => new Date()),
      broadcast: this.o.broadcast,
      flushIntervalMs: this.o.flushIntervalMs ?? OUTPUT_FLUSH_INTERVAL_MS,
      ringBytes: this.o.ringBytes ?? GENERATION_BUFFER_BYTES,
      killGraceMs: this.o.killGraceMs ?? KILL_GRACE_MS,
      onSettled: () => this.retire(run),
    });
    this.active = run;
    let outcome: PrepareOutcome;
    try {
      outcome = await prepareTarget(a.target, a.config);
    } catch (error) {
      run.failPrepare(error);
      return { outcome: 'started', generation: run.snapshotState() };
    }
    if (outcome === 'config-differs') {
      this.active = null;
      return { outcome: 'config-differs' };
    }
    run.launch();
    return { outcome: 'started', generation: run.snapshotState() };
  }

  private retire(run: GenerationRun): void {
    if (this.active === run) this.active = null;
    this.last = run;
  }

  get(generationId: string | undefined, sinceSeq: number): GenerationSnapshot {
    const run = generationId === undefined ? (this.active ?? this.last) : [this.active, this.last].find((candidate) => candidate?.id === generationId);
    if (generationId !== undefined && !run) throw new SessionError('not-found', 'unknown generation');
    if (!run) return { generation: null, output: [], truncatedBefore: false, hasMore: false };
    return run.snapshot(sinceSeq);
  }

  async cancel(generationId: string): Promise<GenerationState> {
    const run = [this.active, this.last].find((candidate) => candidate?.id === generationId);
    if (!run) throw new SessionError('not-found', 'unknown generation');
    if (!run.isRunning()) throw new SessionError('conflict', 'the generation already finished');
    await run.cancel();
    return run.snapshotState();
  }

  async closeAll(): Promise<void> {
    const run = this.active;
    if (run) await run.cancel();
  }
}
