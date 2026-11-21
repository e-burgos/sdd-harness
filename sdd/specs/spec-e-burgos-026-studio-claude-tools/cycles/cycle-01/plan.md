# spec-e-burgos-026-studio-claude-tools — cycle-01 · plan (lite)

> Módulo: studio-claude-tools | Subproyectos: libs/studio-protocol, apps/studio-bridge, apps/studio | 2026-11-20 · Rama `feat/studio-claude-tools`.
> Objetivo: Studio deja elegir qué configuración de Claude Code del dev usa el motor (fuentes, plugins, MCP),
> muestra su estado real y suma el navegador por `chrome-devtools-mcp`. Fuera de alcance: login de suscripción,
> Claude in Chrome, escribir en la configuración de Claude Code del dev, autenticar MCP desde la web.

## Historias
- US-1 — Ver fuentes, plugins y MCP con su estado y los conteos de skills/agentes que suma cada fuente. CA: el módulo Claude lista lo que reporta el motor real.
- US-2 — Prender/apagar las fuentes `user` y `local`. CA: el próximo turno arranca con `settingSources` acorde; `project` siempre va.
- US-3 — Apagar plugins o MCP puntuales solo para Studio. CA: el `system/init` del turno siguiente ya no los lista; `~/.claude*` y `.claude/` no cambian.
- US-4 — Prender «Chrome (DevTools)». CA: el turno siguiente tiene el servidor `chrome-devtools` y sus herramientas; si no conecta, se ve el estado y la causa.
- US-5 — Aviso de costo. CA: con skills sumadas o herramientas MCP por encima del umbral se muestra un aviso con los números.
- US-6 — Claude in Chrome figura como no disponible con su motivo (requiere login de claude.ai; el puente usa API key).

## Tasks (detalle en tasks.json)
- TASK-001 — Protocolo: `claude-tools.ts` (config, revisión, inventario, resultados), comandos `claude.tools.get|set`, `claude.inventory.refresh`, bot kind `claude-tools.changed`, feature `claude-tools`; specs.
- TASK-002 — Puente: `workspace/claude-tools.ts` lee/escribe `<root>/.sdd-studio/claude-tools.json` con revisión por hash, escritura atómica y cola; defaults = comportamiento actual; specs.
- TASK-003 — Puente/motor: `buildQueryOptions` aplica la config (fuentes, plugins y MCP apagados, servidor del navegador) y el motor captura `system/init` en un callback; verificación real de cada mecanismo con el SDK fijado; specs con fixtures.
- TASK-004 — Puente: sonda de inventario, handlers del router, bot event, wiring en `ProjectRuntime` y estado MCP actualizado desde cada `system/init`; specs.
- TASK-005 — Studio: módulo `claude` en el riel (panel de secciones Fuentes · Plugins · MCP · Navegador), hook y modelo, interruptores con confirmación, aviso de costo, fila de Claude in Chrome, i18n es/en; specs.
- TASK-006 — Verificación real en Studio local (`--local-ui`) sobre este repo: fuentes, apagar un plugin y un MCP, navegador conectado a Chrome; cierre.

## Decisiones técnicas
- **D-01 Config en Studio, no en Claude Code.** `<root>/.sdd-studio/claude-tools.json` (git-ignorado, junto a los
  hilos): `{ sources: {user, local}, disabledPlugins: string[] (id `name@marketplace` = `plugins[].source` del init),
  disabledMcpServers: string[] (nombre del init), browser: {enabled, browserUrl: string|null} }`. Archivo ausente ⇒
  defaults (todo apagado) ⇒ el motor arranca igual que hoy. Revisión = 16 hex del hash de los bytes, `expectedRevision`
  en `set` y `conflict` si cambió, como `kit-tools`.
- **D-02 Cómo se aplica (por turno, `startTurn`).** `settingSources: ['project', ...fuentes prendidas]`. Plugins
  apagados ⇒ `settings: { enabledPlugins: { id: false } }` (las flag settings le ganan a user/project/local).
  MCP apagados ⇒ el mecanismo que la verificación de TASK-003 confirme, en este orden: flag settings
  (`deniedMcpServers: [{serverName}]`), y si el motor no lo respeta, `query.toggleMcpServer(name, false)` tras el
  init. La config llega al motor con un getter inyectado (como `getEnv`), no por `ThreadOptions`: es del proyecto,
  no del hilo. Vale desde el próximo turno; la UI lo dice.
- **D-03 Navegador.** `browser.enabled` ⇒ `mcpServers['chrome-devtools'] = { type: 'stdio', command, args }` con
  `chrome-devtools-mcp@<CHROME_DEVTOOLS_MCP_VERSION>` (constante del puente, última estable al implementar; hoy
  1.13.0) vía `npx -y` (corre un binario externo, no instala en el workspace), y `--autoConnect` al Chrome abierto o
  `--browserUrl <url>` si el dev lo cargó. Si el servidor no conecta, el estado viene del init como cualquier MCP.
- **D-04 Inventario.** Dos fuentes: (a) sonda `claude.inventory.refresh`: dos `query()` en paralelo (solo `project`
  y todas las fuentes, nada apagado, sin navegador) que se abortan al recibir `system/init` (sin turno del modelo),
  timeout 30 s; da el catálogo completo y los conteos por fuente (diferencia entre ambas). (b) cada `system/init` de
  un turno real actualiza el estado de los MCP prendidos. Se cachea en memoria y en
  `.sdd-studio/claude-inventory.json` con `capturedAt`. Solo nombres, fuentes, estados y conteos: nada de rutas
  de credenciales ni env.
- **D-05 Contrato.** `libs/studio-protocol/src/claude-tools.ts`. `claude.tools.get` ⇒ `{config, revision, inventory |
  null, browserMcpVersion}`; `claude.tools.set {config, expectedRevision}` ⇒ `{config, revision, changed}` y bot
  event `claude-tools.changed` en `general`; `claude.inventory.refresh` ⇒ `{inventory}`. Sin campo nuevo en el
  snapshot (el snapshot sale de archivos del workspace; esto es estado del puente). Feature `claude-tools` en
  `BRIDGE_FEATURES`, `PROTOCOL_VERSION` sigue en 2.
- **D-06 Costo de contexto.** Umbrales en la UI (constantes del modelo): skills sumadas > 100 o herramientas MCP
  > 50 ⇒ aviso con los números del inventario. Las herramientas MCP se cargan bajo demanda (ToolSearch), por eso el
  umbral es más alto que el de skills.
- **D-07 Nombre.** Módulo y feature se llaman «Claude» / `claude-tools`: «Integraciones» ya es la sección del módulo
  Kit (tucu-ui, video-maker; spec-e-burgos-022).
- **D-08 Flow lite pese a tocar el contrato:** protocolo, puente y Studio cambian en el mismo ciclo y por el mismo
  actor, como en spec-e-burgos-022. `components.json` registra los componentes nuevos del módulo bajo `apps/studio`.
