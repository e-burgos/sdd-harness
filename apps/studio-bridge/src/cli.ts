import { spawn } from 'node:child_process';
import { defineCommand, runMain } from 'citty';
import pc from 'picocolors';
import { BridgeStartError, DEFAULT_ORIGINS, DEFAULT_WEB_URL, startBridge } from './main';
import { BRIDGE_VERSION } from './version';

function openBrowser(url: string): void {
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '""', url]]
        : ['xdg-open', [url]];
  const child = spawn(cmd, args as string[], { detached: true, stdio: 'ignore' });
  child.on('error', () => undefined);
  child.unref();
}

const main = defineCommand({
  meta: { name: 'sdd-studio', version: BRIDGE_VERSION, description: 'Puente local de SDD Studio' },
  args: {
    root: { type: 'string', description: 'Raíz del repo (default: directorio actual)' },
    port: { type: 'string', description: 'Puerto del WebSocket (default: 4320, o el siguiente libre)' },
    engine: { type: 'string', description: 'claude | fake', default: 'claude' },
    'allow-origin': { type: 'string', description: 'Orígenes extra permitidos, separados por coma' },
    'web-url': { type: 'string', description: 'URL de la web', default: DEFAULT_WEB_URL },
    open: { type: 'boolean', description: 'Abrir el navegador (--no-open para no abrirlo)', default: true },
  },
  async run({ args }) {
    const engine = args.engine === 'fake' ? 'fake' : 'claude';
    const extraOrigins = (args['allow-origin'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    try {
      const bridge = await startBridge({
        root: args.root ?? process.cwd(),
        port: args.port ? Number(args.port) : 4320,
        strictPort: Boolean(args.port),
        engine,
        allowedOrigins: [...DEFAULT_ORIGINS, ...extraOrigins],
        webUrl: args['web-url'],
      });
      const auth = bridge.authMode === 'api-key' ? 'API key (ANTHROPIC_API_KEY)' : 'login local de Claude Code';
      console.log(`${pc.bold('SDD Studio')} ${pc.dim(`v${BRIDGE_VERSION}`)} · ${bridge.project}`);
      console.log(`  motor:  ${engine === 'fake' ? pc.yellow('fake (sin tokens)') : 'Claude Agent SDK'}`);
      console.log(`  auth:   ${auth}`);
      console.log(`  puerto: 127.0.0.1:${bridge.port}`);
      console.log(`  abrí:   ${pc.cyan(bridge.url)}`);
      console.log(pc.dim('  Ctrl+C para cerrar.'));
      if (args.open) openBrowser(bridge.url);
      const shutdown = async () => {
        await bridge.close();
        process.exit(0);
      };
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
    } catch (error) {
      console.error(pc.red(error instanceof BridgeStartError ? error.message : String(error)));
      process.exit(1);
    }
  },
});

runMain(main);
