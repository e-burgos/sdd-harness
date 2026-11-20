# spec-e-burgos-026-studio-claude-tools · cycle-01 — 2026-11-20

## Estructura
- `workspace/claude-tools.ts`: config de Claude en `<root>/.sdd-studio/claude-tools.json` (revisión por hash, escritura atómica, cola; reusa `KitToolsError`); `cachedClaudeTools(root)` alimenta el getter del motor. Sin archivo ⇒ defaults ⇒ el motor arranca como antes.
- `engine/claude-sdk-engine.ts` `applyClaudeTools`: `settingSources` = `project` + fuentes prendidas; plugins apagados con `settings.enabledPlugins[id] = false`; MCP apagados con `settings.deniedMcpServers` (verificado con el SDK real: `toggleMcpServer` no hace falta); navegador = `mcpServers['chrome-devtools']` con `npx -y chrome-devtools-mcp@1.13.0` (`engine/chrome-devtools.ts`) y `--autoConnect` o `--browserUrl`.
- `engine/claude-init.ts` `deriveInitInfo` + `EngineCallbacks.onInit`: el `system/init` de cada turno actualiza el estado de los MCP del inventario.
- `workspace/claude-inventory.ts`: sonda con dos `query()` (solo proyecto y todas las fuentes) abortadas al llegar el init, timeout 30 s, promesa en vuelo reusada; persiste en `.sdd-studio/claude-inventory.json`.
- Router: `claude.tools.get|set`, `claude.inventory.refresh`; bot event `claude-tools.changed` (kit bot kind).

## Dependencias
- Claude in Chrome exige login de claude.ai: con API key el motor la deja apagada aun con `--chrome`. El navegador va por chrome-devtools-mcp y `--autoConnect` necesita la depuración remota habilitada en `chrome://inspect/#remote-debugging`.
- Importar `dist/cli.js` arranca un puente (el bin ejecuta al cargar): no importarlo desde scripts.

## Qué sigue
- Explicar en la UI cuando chrome-devtools-mcp no encuentra `DevToolsActivePort`; la config editada a mano no se ve hasta el próximo get/set.
