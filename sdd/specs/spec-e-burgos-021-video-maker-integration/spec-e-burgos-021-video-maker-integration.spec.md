# SPEC-e-burgos-021: El kit trae la vinculación con video-maker

> Estado: **in-progress** (2026-11-12). cycle-01 abierto (flow lite). Mismo patrón que la integración
> tucu-ui (spec-e-burgos-011): interruptor en `sdd/tools.json`, comando `pnpm sdd:<x>`, opt-in.

## Resumen ejecutivo
video-maker publicó `@e-burgos/video-maker-mcp@0.1.0` (MCP por stdio, 41 tools, sin API keys: habla
con el studio local por HTTP) y un plugin de Claude Code (`video-maker@video-maker`, marketplace en
el repo `e-burgos/video-maker`) con cinco skills (video-maker, brand, motion-brief, screen-capture,
raw-material). El dev quiere que cualquier repo con el kit pueda generar videos de su producto con
video-maker sin cablear nada a mano: el kit ya trae la conexión al MCP y las skills del plugin.

## Historias de usuario
- US-1 — Prender y apagar. Como dev, con `pnpm sdd:video -- --enable` el repo queda vinculado a
  video-maker; `--disable` lo desvincula sin tocar lo ajeno; `--status` dice qué falta, sin red.
- US-2 — Claude Code completo. Como dev en Claude Code, el plugin queda declarado en
  `.claude/settings.json` (marketplace + plugin habilitado): trae sus skills y su propio MCP; el
  kit no duplica el servidor en `.mcp.json`.
- US-3 — Copilot y Gemini con las tools. Como dev en Copilot o Gemini/Antigravity, el MCP fijado
  (`npx -y @e-burgos/video-maker-mcp@0.1.0`) queda en `.vscode/mcp.json` y `.gemini/settings.json`.
- US-4 — El kit lo conoce. `harness init` / `configure sdd` lo ofrecen (`--video-maker`), el
  steward lo opera a pedido, `sdd:validate` avisa si está prendido e incompleto, y la doc explica
  requisitos (Node 22+, studio abierto) y el flujo de punta a punta.

## Decisiones (dev + sesión video-maker, 2026-11-12)
- Versión fijada `0.1.0` del MCP; override con `video_maker.version` en `sdd/tools.json`.
- Claude → plugin (no MCP en `.mcp.json`); Copilot/Gemini → MCP fijado. Las skills del plugin son de
  Claude Code; los otros arneses reciben las tools.
- Requisito declarado: studio corriendo (`pnpm studio` del repo video-maker, o variables
  `VIDEO_MAKER_API_URL` + `VIDEO_MAKER_API_TOKEN`). La app de escritorio 0.4.3 todavía no publica
  `~/.video-maker/studio.json`: no se promociona como requisito hasta su próxima versión.
- Publicar y borrar publicaciones quedan fuera del MCP (los hace el dev en el studio).

## Restricciones
- Apagado por defecto; nada se escribe sin `--enable`. No pisa entradas ajenas de los archivos MCP
  ni claves ajenas de `.claude/settings.json`. `--status` no usa red.
- Mismas garantías que tucu-ui: Windows (`cmd /c npx`), `update sdd` no toca `sdd/tools.json`.

## Ciclos propuestos
- cycle-01 — Integración completa (US-1..US-4).
