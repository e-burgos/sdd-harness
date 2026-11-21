# spec-e-burgos-029-studio-claude-connect — cycle-01 · plan (lite)

> Módulo: studio-claude-connect | Subproyectos: libs/studio-protocol, apps/studio-bridge, apps/studio | 2026-11-20 · Rama `feat/studio-claude-tools`.
> Objetivo: Chrome conectado por defecto con pedido de permiso al instante, y login/reconexión de MCP desde Studio. Fuera de alcance: Claude in Chrome, guardar credenciales, MCP de otros clientes.

## Historias
- US-1 — Chrome por defecto con pedido al instante. CA: default `browser.enabled: true`; al arrancar el puente y al prender el navegador se chequea Chrome y, si no está conectado, se dispara el pedido; Studio muestra un aviso global con el estado y la acción.
- US-2 — Login de MCP. CA: «Iniciar sesión» corre `claude mcp login <name>` del motor; éxito ⇒ inventario refrescado con el MCP `connected`; error ⇒ mensaje con la salida recortada.
- US-3 — Reconectar MCP. CA: «Reconectar» refresca el estado de ese servidor (sonda nueva) y lo muestra.

## Tasks (detalle en tasks.json)
- TASK-001 — Prueba real (fuera del repo): (a) conexión al WebSocket de `DevToolsActivePort` → 101/403, si dispara el aviso de Chrome y cuánto dura la aceptación (mismo proceso, proceso nuevo, reinicio de Chrome); (b) `claude mcp login <name>` del binario del SDK con un MCP de plugin (`plugin:<p>:<s>`) y uno de usuario: ¿acepta el nombre, abre el navegador, sale 0 al completar, qué imprime? Resultado en `artifacts/spike.md`; ajusta D-02/D-03 si hace falta.
- TASK-002 — Protocolo: `ClaudeBrowserStatus` (`connected` | `permission-pending` | `debugging-disabled` | `chrome-closed` | `off` | `unknown`, `checkedAt`, `detail?`); comandos `claude.browser.check`, `claude.browser.openSettings`, `claude.mcp.login {name}`, `claude.mcp.reconnect {name}`; resultados; bot kind `claude-browser.changed`; feature `claude-connect`; `DEFAULT_CLAUDE_TOOLS_CONFIG.browser.enabled = true`; specs.
- TASK-003 — Puente: `workspace/chrome-status.ts` (rutas de `DevToolsActivePort` por SO, intento de conexión con timeout, mapeo a estados), chequeo al arrancar el runtime y al prender el navegador, `openSettings` (abre `chrome://inspect/#remote-debugging` en Chrome según SO, `execFile` sin shell); `claude-mcp.ts` (`login` con el binario del SDK, cwd = root, timeout 5 min, salida recortada; `reconnect` = sonda de inventario); router, bot event y specs con fakes.
- TASK-004 — Studio: aviso global (shell) cuando el navegador está prendido y no conectado, con acción por estado; sección Navegador con estado y botones; filas MCP con «Iniciar sesión» (needs-auth) y «Reconectar» (failed/pending) con progreso; i18n es/en; specs.
- TASK-005 — Verificación real (headless + Chrome del dev si conecta) y cierre.

## Decisiones técnicas
- D-01 Contrato aditivo bajo la feature `claude-connect`; `PROTOCOL_VERSION` sigue en 2.
- D-02 Estado de Chrome: sin proceso ⇒ `chrome-closed`; sin `DevToolsActivePort` ⇒ `debugging-disabled`; WebSocket 403/timeout ⇒ `permission-pending`; 101 ⇒ `connected` (se cierra enseguida). Se ajusta según TASK-001.
- D-03 Login: binario del SDK (`@anthropic-ai/claude-agent-sdk-<plataforma>/claude`) con `mcp login <name>`; nunca `--no-browser`; el puente no lee ni guarda tokens.
- D-04 El cambio de default afecta a todos los usuarios del kit: quien no quiera navegador lo apaga desde el módulo Claude (la config global de spec-e-burgos-027 lo recuerda).

## Cambio de diseño (dev, 2026-11-20) — Chrome propio de Studio
Con `--autoConnect` Chrome muestra «Allow remote debugging?» en **cada conexión nueva** (cada turno levanta
un `chrome-devtools-mcp` nuevo) y el aviso no tiene «permitir siempre». Decisión del dev: Chrome propio de Studio.
- **D-05** El puente lanza (si no responde) un Chrome aparte: `--remote-debugging-port=9333
  --user-data-dir=~/.sdd-studio/chrome-profile --no-first-run --no-default-browser-check`, desacoplado, perfil
  persistente (los logins se hacen una vez ahí). Todos los turnos usan `chrome-devtools-mcp --browserUrl
  http://127.0.0.1:9333`; se elimina `--autoConnect`. Con `browserUrl` propio del dev, se usa ese y no se lanza nada.
- **D-06** Estado de Chrome = `GET http://127.0.0.1:9333/json/version` (sin WebSocket: nunca dispara avisos):
  responde ⇒ `connected`; no responde ⇒ `chrome-closed` (el chequeo lo lanza y reintenta); sin binario de Chrome ⇒
  `unknown` con detalle. `permission-pending`/`debugging-disabled` quedan en el enum por compatibilidad y dejan de emitirse.
  `claude.browser.openSettings` pasa a «abrir el Chrome de Studio» (lanzar o traer al frente).
- TASK-006 (puente) y TASK-007 (Studio) implementan D-05/D-06; TASK-005 (verificación) pasa al final.

## Hallazgo de la verificación (TASK-005)
- «Iniciar sesión» en Notion falló con «the Claude engine binary was not found»: `resolveSdkBinary` resolvía
  `@anthropic-ai/claude-agent-sdk-<plataforma>` desde el puente, pero es dependencia del SDK (con pnpm no se ve
  desde el puente). Se resuelve desde el paquete del SDK (corrección dentro de TASK-005).
