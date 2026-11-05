import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  DirListing,
  GenerateResult,
  GenerationState,
  Preflight,
  TargetCheck,
  WizardCatalogResult,
  WorkspaceOpenResult,
} from '@sdd-studio/protocol';
import type { ProjectRuntime } from '../project/runtime';
import type { HostCommand } from '../server/router';
import { SessionError } from '../sessions/session-manager';
import { locateHarnessCli, type HarnessCli } from './cli-locator';
import { createConfigCli, type ConfigCli } from './config-cli';
import { listDirs } from './dirs';
import { containingBase, nativeRealpath, resolveBases, type PathPlatform } from './fs-paths';
import { INIT_ARGV, type GenerationRegistry } from './generation';
import type { InitMode } from './init-output';
import { defaultPreflight } from './preflight';
import { revealPath } from './reveal';
import { checkTarget, isGeneratable } from './target';

export interface WizardHost {
  readonly generations: GenerationRegistry;
  readonly allowTargets: string[];
  readonly runtime: ProjectRuntime | null;
  switchProject(root: string): Promise<WorkspaceOpenResult>;
}

export interface WizardServiceOptions {
  cli?: HarnessCli;
  configCli?: ConfigCli;
  preflight?: () => Promise<Preflight>;
  reveal?: typeof revealPath;
  homeDir?: string;
  cwd?: string;
  platform?: NodeJS.Platform;
}

const OPENABLE_STATUSES: GenerationState['status'][] = ['succeeded', 'gate-failed'];
const PROJECT_NAME_LIMIT = 64;

export class WizardService {
  private cliCache: HarnessCli | null = null;
  private configCliCache: ConfigCli | null = null;

  constructor(
    private readonly host: WizardHost,
    private readonly o: WizardServiceOptions = {},
  ) {}

  private get platform(): NodeJS.Platform {
    return this.o.platform ?? process.platform;
  }

  private get pathPlatform(): PathPlatform {
    return this.platform === 'win32' ? 'win32' : 'posix';
  }

  private cli(): HarnessCli {
    this.cliCache ??= this.o.cli ?? locateHarnessCli();
    return this.cliCache;
  }

  private configCli(): ConfigCli {
    this.configCliCache ??= this.o.configCli ?? createConfigCli({ cli: this.cli() });
    return this.configCliCache;
  }

  private bases(): Promise<string[]> {
    return resolveBases([this.o.homeDir ?? os.homedir(), ...this.host.allowTargets]);
  }

  private async suggestedParent(bases: string[]): Promise<string> {
    const cwd = await nativeRealpath(this.o.cwd ?? process.cwd()).catch(() => null);
    if (cwd && containingBase(cwd, bases, this.pathPlatform)) return cwd;
    return bases[0] ?? (this.o.homeDir ?? os.homedir());
  }

  private async catalog(): Promise<WizardCatalogResult> {
    const [catalog, bases] = await Promise.all([this.configCli().catalog(), this.bases()]);
    const home = await nativeRealpath(this.o.homeDir ?? os.homedir()).catch(() => bases[0] ?? '');
    return { catalog, initArgv: [...INIT_ARGV], home, suggestedParent: await this.suggestedParent(bases), platform: this.pathPlatform };
  }

  private async check(input: string): Promise<TargetCheck> {
    const [catalog, bases] = await Promise.all([this.configCli().catalog(), this.bases()]);
    return checkTarget(input, {
      bases,
      projectRoot: this.host.runtime?.root ?? null,
      platform: this.pathPlatform,
      tolerated: catalog.targetDir.tolerated,
    });
  }

  private async list(command: Extract<HostCommand, { cmd: 'wizard.listDirs' }>): Promise<DirListing> {
    const bases = await this.bases();
    return listDirs(command.path, { bases, start: await this.suggestedParent(bases), platform: this.pathPlatform, showHidden: command.showHidden });
  }

  private async generate(command: Extract<HostCommand, { cmd: 'wizard.generate' }>): Promise<GenerateResult> {
    const validation = await this.configCli().validateExact(command.config);
    if (!validation.ok) return { outcome: 'invalid-config', validation };

    const check = await this.check(command.path);
    if (!isGeneratable(check)) return { outcome: 'blocked', check, reason: check.reason ?? check.state };
    if (check.needsConfirmation && command.fingerprint !== check.fingerprint) return { outcome: 'needs-confirmation', check };
    if (check.resolvedPath === null) throw new Error('target check produced no resolved path');

    const mode: InitMode = validation.resolved?.mode ?? (command.config['mode'] === 'standalone' ? 'standalone' : 'nx');
    const projectName = validation.resolved?.project.name ?? String((command.config['project'] as { name?: unknown } | undefined)?.name ?? path.basename(check.resolvedPath));
    const started = await this.host.generations.start({
      cli: this.cli(),
      config: command.config,
      target: check.resolvedPath,
      mode,
      projectName: projectName.slice(0, PROJECT_NAME_LIMIT),
    });
    if (started.outcome === 'config-differs') return { outcome: 'blocked', check, reason: 'config-differs' };
    return started;
  }

  private async reveal(generationId: string): Promise<null> {
    const state = this.host.generations.find(generationId);
    if (!state) throw new SessionError('not-found', 'unknown generation');
    await (this.o.reveal ?? revealPath)(state.target, { bases: await this.bases(), platform: this.platform });
    return null;
  }

  private async open(generationId: string): Promise<WorkspaceOpenResult> {
    const state = this.host.generations.find(generationId);
    if (!state) throw new SessionError('not-found', 'unknown generation');
    if (state.status === 'running') throw new SessionError('conflict', 'the generation is still running');
    if (!OPENABLE_STATUSES.includes(state.status) || !existsSync(path.join(state.target, 'sdd'))) {
      throw new SessionError('not-found', 'the generation did not produce a project with sdd/');
    }
    const real = await nativeRealpath(state.target).catch(() => null);
    if (real === null || real !== state.target) throw new SessionError('bad-request', 'the generated folder moved or is no longer the folder that was generated');
    if (containingBase(real, await this.bases(), this.pathPlatform)?.relation !== 'inside') throw new SessionError('bad-request', 'the generated folder is outside the allowed folders');
    return this.host.switchProject(real);
  }

  readonly handle = async (command: HostCommand): Promise<unknown> => {
    switch (command.cmd) {
      case 'wizard.catalog':
        return this.catalog();
      case 'wizard.preflight':
        return (this.o.preflight ?? defaultPreflight)();
      case 'wizard.validate':
        return this.configCli().validate(command.config);
      case 'wizard.listDirs':
        return this.list(command);
      case 'wizard.checkTarget':
        return this.check(command.path);
      case 'wizard.generate':
        return this.generate(command);
      case 'wizard.generation.get':
        return this.host.generations.get(command.generationId, command.sinceSeq);
      case 'wizard.generation.cancel':
        return this.host.generations.cancel(command.generationId);
      case 'wizard.reveal':
        return this.reveal(command.generationId);
      case 'workspace.open':
        return this.open(command.generationId);
      default:
        throw new SessionError('bad-request', `unsupported: ${(command as { cmd: string }).cmd}`);
    }
  };
}

export const createWizardCommands = (host: WizardHost, options?: WizardServiceOptions) => new WizardService(host, options).handle;

