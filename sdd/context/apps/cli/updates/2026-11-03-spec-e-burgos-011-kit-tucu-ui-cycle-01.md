# apps/cli — spec-e-burgos-011-kit-tucu-ui · cycle-01

## Estado
El kit tiene una integración opcional de tucu-ui, apagada por defecto: `tucu_ui: { enabled, skill, mcp, version }` en `sdd/tools.json` y `pnpm sdd:tucu -- --status | --enable [--parts=skill,mcp] [--force] | --disable [--purge]`. Al prender instala la skill `tucu-ui-design` desde `@e-burgos/tucu-ui-mcp@0.16.0` en `sdd/integrations/skills/`, la enlaza en `.claude/skills`, `.github/skills` y `.agents/skills`, y agrega el servidor `tucu-ui` a `.mcp.json`, `.vscode/mcp.json` y `.gemini/settings.json` sin pisar servidores ni claves ajenas. `harness init` y `configure sdd` lo ofrecen solo con apps `react`/`nextjs` (`--tucu-ui` / `--no-tucu-ui`; `init --config` acepta `sdd.tucu_ui`).

## Estructura
- Kit: `scripts/sdd-tucu.mjs` (switch, instalación atómica, `--sync` sin red), `scripts/tucu-ui-common.mjs` (constantes, entrada MCP, estado), `scripts/mcp-config.mjs` (merge de los tres formatos MCP); `setup-agents.{sh,ps1}` llaman a `sdd-tucu.mjs --sync`; `validate-sdd.mjs` avisa por arnés y archivo MCP; playbook 8 del steward.
- `kit-manifest.ts`: `integrations/` es prefijo de datos (update no lo toca).
- `configure mcp` y `configure memory` usan el merge compartido; `tucu-ui` está en el catálogo MCP.
- `.claude/skills` puede ser un directorio con enlaces por skill (antes era siempre un symlink entero a `sdd/skills`).

## Dependencias
- Ninguna nueva en la CLI; el kit usa `npx -p @e-burgos/tucu-ui-mcp@0.16.0` en tiempo de ejecución.

## Qué sigue
- Interruptor de tucu-ui en el módulo Kit de Studio.
- Correr los casos de Windows en una máquina Windows.
