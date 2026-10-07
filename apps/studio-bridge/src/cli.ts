import { defineCommand, runMain } from 'citty';
import pc from 'picocolors';
import { BridgeStartError, DEFAULT_ORIGINS, DEFAULT_WEB_URL, startBridge } from './main';
import { parseEngine, parsePort, parseWebUrl } from './cli-options';
import { openBrowser } from './open-browser';
import { BRIDGE_VERSION } from './version';

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
    const extraOrigins = (args['allow-origin'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    try {
      const engine = parseEngine(args.engine);
      const port = args.port === undefined ? 4320 : parsePort(args.port);
      const webUrl = parseWebUrl(args['web-url']);
      const bridge = await startBridge({
        root: args.root ?? process.cwd(),
        port,
        strictPort: args.port !== undefined,
        engine,
        allowedOrigins: [...DEFAULT_ORIGINS, ...extraOrigins],
        webUrl,
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
        try {
          await bridge.close();
        } catch (error) {
          console.error(pc.red(String(error)));
        }
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
