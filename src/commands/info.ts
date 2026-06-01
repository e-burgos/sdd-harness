import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export const infoCommand = defineCommand({
  meta: {
    name: 'info',
    description: 'Show workspace information',
  },
  async run() {
    p.intro(pc.bgCyan(pc.black(' harness info ')));

    const cwd = process.cwd();

    // ─── Package info ──────────────────────────────────────────
    const pkgPath = resolve(cwd, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const scope = pkg.name?.startsWith('@') ? pkg.name.split('/')[0] : 'none';
      p.note(
        [
          `${pc.bold('Name:')} ${pkg.name || 'unknown'}`,
          `${pc.bold('Scope:')} ${scope}`,
          `${pc.bold('Version:')} ${pkg.version || '0.0.0'}`,
        ].join('\n'),
        'Project',
      );
    } else {
      p.log.warn('No package.json found — not a valid workspace root.');
      p.outro('');
      return;
    }

    // ─── Apps ──────────────────────────────────────────────────
    const appsDir = resolve(cwd, 'apps');
    if (existsSync(appsDir)) {
      const apps = readdirSync(appsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .filter((d) => existsSync(resolve(appsDir, d.name, 'project.json')))
        .map((d) => d.name);

      if (apps.length > 0) {
        p.note(
          apps.map((a) => `  ${pc.cyan('•')} ${a}`).join('\n'),
          `Apps (${apps.length})`,
        );
      } else {
        p.log.info('No apps detected.');
      }
    }

    // ─── Libs ──────────────────────────────────────────────────
    const libsDir = resolve(cwd, 'libs');
    if (existsSync(libsDir)) {
      const libs = readdirSync(libsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .filter((d) => existsSync(resolve(libsDir, d.name, 'project.json')))
        .map((d) => d.name);

      if (libs.length > 0) {
        p.note(
          libs.map((l) => `  ${pc.cyan('•')} ${l}`).join('\n'),
          `Libs (${libs.length})`,
        );
      } else {
        p.log.info('No libs detected.');
      }
    }

    // ─── Docker services ───────────────────────────────────────
    const composePath = resolve(cwd, 'docker-compose.yml');
    if (existsSync(composePath)) {
      const content = readFileSync(composePath, 'utf-8');
      const services: string[] = [];
      const knownServices = ['postgres', 'redis', 'rabbitmq', 'minio'];
      for (const svc of knownServices) {
        if (new RegExp(`^\\s{2}${svc}:`, 'm').test(content)) {
          services.push(svc);
        }
      }
      if (services.length > 0) {
        p.note(
          services.map((s) => `  ${pc.cyan('•')} ${s}`).join('\n'),
          `Docker Services (${services.length})`,
        );
      }
    } else {
      p.log.info('No docker-compose.yml found.');
    }

    // ─── SDD status ────────────────────────────────────────────
    const globalPath = resolve(cwd, 'sdd/global.json');
    if (existsSync(globalPath)) {
      const global = JSON.parse(readFileSync(globalPath, 'utf-8'));
      p.note(
        [
          `${pc.bold('Project:')} ${global.project || global.projectName || 'unknown'}`,
          `${pc.bold('Current Cycle:')} ${global.currentCycle ?? global.current_cycle ?? 0}`,
          `${pc.bold('Status:')} ${global.status || 'unknown'}`,
          `${pc.bold('Completed:')} ${(global.completedModules || global.completed_modules || []).join(', ') || 'none'}`,
        ].join('\n'),
        'SDD Status',
      );
    } else {
      p.log.info('No SDD configuration (sdd/global.json missing).');
    }

    // ─── Nx workspace ──────────────────────────────────────────
    const nxPath = resolve(cwd, 'nx.json');
    if (existsSync(nxPath)) {
      p.log.success(`${pc.green('✓')} Nx workspace detected`);
    } else {
      p.log.warn('Not an Nx workspace (nx.json missing).');
    }

    p.outro('');
  },
});
