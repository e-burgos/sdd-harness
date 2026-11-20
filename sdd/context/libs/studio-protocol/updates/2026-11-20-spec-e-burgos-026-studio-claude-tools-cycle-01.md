# spec-e-burgos-026-studio-claude-tools · cycle-01 — 2026-11-20

## Estructura
- `src/claude-tools.ts`: `ClaudeToolsConfig` (fuentes user/local, `disabledPlugins` por id `name@marketplace`, `disabledMcpServers` por nombre exacto del init, `browser {enabled, browserUrl}`), `DEFAULT_CLAUDE_TOOLS_CONFIG`, `ClaudeToolsRevision` (= `ToolsRevision`), `ClaudeMcpStatus` (estado desconocido ⇒ `unknown`), `ClaudeInventory` (plugins, MCP con estado, `counts.project`/`counts.all`) y resultados de `get`/`set`/`refresh`.
- Comandos `claude.tools.get`, `claude.tools.set {config, expectedRevision}`, `claude.inventory.refresh`; bot kind `claude-tools.changed`; feature `claude-tools`. `PROTOCOL_VERSION` sigue en 2.
