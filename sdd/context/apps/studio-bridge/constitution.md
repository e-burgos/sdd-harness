# Constitución — apps/studio-bridge

> Versión 1.0 | Última actualización: 2026-10-23 (profundización de contexto)

## 1. Propósito y Alcance

- **Tipo:** app (Daemon local CLI publicado en npm)
- **Paquete:** `@e-burgos/sdd-studio` (binario: `sdd-studio`)
- **Rol en el sistema:** Puente local para SDD Studio. Se ejecuta en la máquina del desarrollador en la raíz del repositorio, monta un servidor WebSocket local con un token efímero de seguridad, observa cambios en el filesystem de `sdd/`, ejecuta los agentes del kit utilizando `@anthropic-ai/claude-agent-sdk`, y aplica el SPEC GATE en tiempo real antes de permitir cualquier modificación de código.
- **Seguridad:** Las credenciales y claves API (`ANTHROPIC_API_KEY`) nunca viajan al navegador. La web app solo envía comandos por WebSocket local (127.0.0.1) autenticados por token de pairing.

## 2. Stack Tecnológico

- **Runtime:** Node.js >=18 (ESM nativo).
- **Agent SDK:** `@anthropic-ai/claude-agent-sdk` para orquestación directa de subagentes, streaming de herramientas y llamadas de modelo en Claude.
- **Red y Servidor:** `ws` (servidor WebSocket local), `citty` (CLI runner), `picocolors`.
- **Filesystem Watcher:** `chokidar` (monitorea cambios reactivos en `sdd/` y archivos del proyecto).
- **Validación de Protocolo:** `@sdd-studio/protocol` y `zod`.
- **Testing:** `vitest` (incluye motor `fake-engine.ts` para pruebas offline sin consumir tokens reales y grabación de fixtures con `scripts/record-sdk-fixtures.mjs`).

## 3. Arquitectura y Componentes Internos

### 3.1 Motor de Agentes (`src/engine/`)
- `claude-sdk-engine.ts`: Conecta con el SDK de Anthropic (`query`). Mapea los modelos simbólicos (`haiku`, `sonnet`, `opus`, `fable`) a sus IDs canónicos exactos (ej. `claude-sonnet-5-5`). Inyecta hooks en el ciclo de vida del agente:
  - `SubagentStart` y `SubagentStop`: Notifica el fan-out de subagentes.
  - `PreToolUse`: Intercepta cada llamada a herramientas. Aquí se evalúa el SPEC GATE (`judgeTool`).
- `sdk-mapper.ts` & `tool-summary.ts`: Transforma los deltas de mensajes y tool calls del SDK a eventos estructurados del protocolo (`ThreadEvent`), extrayendo resúmenes y diffs unificados.
- `fake-engine.ts`: Implementación mock de `AgentEngine` para tests unitarios y suites E2E en Playwright sin red.

### 3.2 Enforcement del SPEC GATE (`src/gate/`)
- `judge.ts`: Núcleo de validación de ediciones de código (`judgeEdit`).
  - Herramientas monitoreadas: `EDIT_TOOLS` (`Edit`, `Write`, `MultiEdit`, `NotebookEdit`).
  - Carpetas exentas de gate: `sdd`, `.claude`, `.github`, `.gemini`, `.agents`, `.agent`, `.vscode`, `.idea`.
  - Regla: Toda edición fuera de carpetas exentas es RECHAZADA (`deny`) a menos que exista un ciclo con `status: "in-progress"` o un fix abierto con `status: "pending" | "in-progress"`. Si el permiso está en modo warn, se deriva a la UI como solicitud de aprobación con aviso visible.

### 3.3 Gestión de Sesiones y Presencia (`src/sessions/`)
- `session-manager.ts`: Coordina las conversaciones (`threads`), el historial persistido en disco (`store.ts`), las aprobaciones interactivas (`approval.respond`) y las notificaciones automáticas del bot (`channel.botHistory`).
- `presence.ts`: Seguimiento en memoria de qué agentes y usuarios están activos en cada canal.

### 3.4 Espacio de Trabajo e Introspección (`src/workspace/`)
- `snapshot.ts`: Lee el sistema SDD local (`global.json`, `specs/index.json`, ciclos, `fixes.json`, `tools.json`, `pricing.json`) y construye el `WorkspaceSnapshot`.
- `watcher.ts`: Watcher con chokidar que debounceriza escrituras en disco y emite eventos `workspace.changed` para que la UI se actualice automáticamente.
- `paths.ts`: Sanitización estricta de rutas de archivos para evitar directory traversal fuera de la raíz del repo.

### 3.5 Servidor y Seguridad (`src/server/`)
- `ws-server.ts`: Servidor WebSocket en `127.0.0.1` con autenticación estricta durante el handshake (`handshake.ts`).
- `security.ts`: Genera tokens criptográficamente seguros para la URL de pairing (`/w#bridge=ws://127.0.0.1:...&token=...`).
- `static.ts`: Sirve la interfaz web estática si se pasa la bandera `--local-ui`.

## 4. Comandos de Trabajo

- **Compilar puente:** `pnpm --filter @e-burgos/sdd-studio build` (ejecuta `node build.js`, emite a `dist/`).
- **Tests unitarios e integración:** `pnpm --filter @e-burgos/sdd-studio test`
- **Verificación de tipos:** `pnpm --filter @e-burgos/sdd-studio typecheck`
- **Ejecutar localmente con engine simulado:**
  `node apps/studio-bridge/bin/sdd-studio.mjs --engine fake --no-open --root apps/studio-bridge/test/fixtures/workspace`

## 5. Reglas Inviolables y Gotchas

1. **Aislamiento de credenciales:** Ningún secreto, token o clave de entorno puede enviarse jamás a través de eventos WebSocket a la interfaz web.
2. **Invariante del SPEC GATE:** `judge.ts` debe mantenerse en sincronía de comportamiento exacta con el mod de Claude Code (`sdd/skills/sdd-mod/hooks/.src/sdd.ts`) y `spec-gate.mjs`.
3. **Mapeo de modelos:** Siempre utilizar los identificadores completos de modelo en `claude-sdk-engine.ts` (`MODEL_IDS`), ya que aliases cortos pueden causar facturaciones de tier equivocado por parte de la API.
