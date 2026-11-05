# Constitución — apps/studio-bridge

> Versión 1.4 | Última actualización: cycle-01 (spec-e-burgos-013-studio-project-wizard) | Fecha: 2026-11-05

## 1. Propósito y Alcance

- **Tipo:** app (Daemon local CLI publicado en npm)
- **Paquete:** `@e-burgos/sdd-studio` (binario: `sdd-studio`)
- **Rol en el sistema:** Puente local para SDD Studio. Se ejecuta en la máquina del desarrollador en la raíz del repositorio (o, sin `sdd/`, en modo launcher para el wizard «Nuevo proyecto»), monta un servidor WebSocket local con un token efímero de seguridad, observa cambios en el filesystem de `sdd/`, ejecuta los agentes del kit utilizando `@anthropic-ai/claude-agent-sdk`, y aplica el SPEC GATE en tiempo real antes de permitir cualquier modificación de código.
- **Seguridad:** Las credenciales y claves API (`ANTHROPIC_API_KEY`) nunca viajan al navegador. La web app solo envía comandos por WebSocket local (127.0.0.1) autenticados por token de pairing.

## 2. Stack Tecnológico

- **Runtime:** Node.js >=20.6 (ESM nativo; `import.meta.resolve` para localizar la CLI fijada).
- **Agent SDK:** `@anthropic-ai/claude-agent-sdk` para orquestación directa de subagentes, streaming de herramientas y llamadas de modelo en Claude.
- **Red y Servidor:** `ws` (servidor WebSocket local), `citty` (CLI runner), `picocolors`.
- **Filesystem Watcher:** `chokidar` (monitorea cambios reactivos en `sdd/` y archivos del proyecto).
- **Validación de Protocolo:** `@sdd-studio/protocol` y `zod`; `ajv` para `sdd/tools.json` (externa en `build.js`).
- **CLI del kit:** `@e-burgos/sdd-harness` (`workspace:*`, versión fijada). Se invoca siempre como proceso (`harness config catalog|validate --json`, `harness init --config … --here -y`), nunca se importa (`no-cli-import.spec.ts`).
- **Testing:** `vitest` (incluye motor `fake-engine.ts` para pruebas offline sin consumir tokens reales y grabación de fixtures con `scripts/record-sdk-fixtures.mjs`).

## 3. Arquitectura y Componentes Internos

### 3.1 Motor de Agentes (`src/engine/`)
- `claude-sdk-engine.ts`: Conecta con el SDK de Anthropic (`query`). Lee el título de sesión (`readSessionTitle`, `pickSessionTitle`: `customTitle`, si no `summary` distinto de `firstPrompt`, tope `SESSION_TITLE_MAX`), `canUseTool` devuelve `decision.updatedInput ?? toolInput` (respuestas de `AskUserQuestion`) y tras cada `result` lee `getContextUsage` (tope 2 s, mejor esfuerzo) hacia `onContextUsage`. Mapea los modelos simbólicos (`haiku`, `sonnet`, `opus`, `fable`) a sus IDs canónicos exactos (ej. `claude-sonnet-5-5`). Inyecta hooks en el ciclo de vida del agente:
  - `SubagentStart` y `SubagentStop`: Notifica el fan-out de subagentes.
  - `PreToolUse`: Intercepta cada llamada a herramientas. Aquí se evalúa el SPEC GATE (`judgeTool`) y abre `beforeTool` para `TRACKED_TOOLS`; `PostToolUse`/`PostToolUseFailure` cierran la ventana (`afterTool`); `canUseTool` llama `rebaseTool` al permitir y `cancelTool` al denegar.
  - `PostToolBatch` (solo hilo principal): punto de corte donde se entregan los mensajes pendientes.
  - Prompt streaming: `prompt: AsyncIterable<SDKUserMessage>` vía `input-channel.ts` (`pushAndFlush`). `DeliveryMode = 'stream'` por defecto (evidencia: `spec-e-burgos-001…/cycle-01/artifacts/spike-posttoolbatch.md`); `hook-context` queda como alternativa interna. Al `result` entrega los pendientes como siguiente turno de la misma query; el recibo de `interrupt()` (`still_queued`) dispara `revertPending`.
  - `EngineCallbacks` incluye `collectPending(at)` y `revertPending(ids)`; `EngineTurnInput.prompts: OutgoingMessage[]` (no `text`).
- `prompt-content.ts`: `toSdkUserMessage` (uuid = id del pendiente), `toHookContext` (fallback) y `buildTurnPrompt` async: resuelve adjuntos del almacén (texto vacío con adjuntos → bloque `Attachments: …`) y antepone el preámbulo de refs (`Delegate this task to the subagent "…"`, `Use the skill "…"`, `Follow the instructions in ….prompt.md.`).
- `sdk-mapper.ts` & `tool-summary.ts`: Transforma los deltas de mensajes y tool calls del SDK a eventos estructurados del protocolo (`ThreadEvent`), extrayendo resúmenes y diffs unificados. `summarizeToolDetailed` con `BASH_SUMMARY_MAX = 600` (rutas `sdd/` completas); `summaryTruncated: true` solo cuando hubo recorte.
- `fake-engine.ts`: Implementación mock de `AgentEngine` para tests y Playwright sin red; puntos de corte y marcadores (`#slow`, `#steps:N`, `#bash-git`, `#bad-attachment`, `#write-doc`, `#bash-doc`, `#title:<texto>`, `#ask`, `#ctx:N`, …) y ecos ` [attachments: …]` / ` [refs: …]`.
- `stable-prefix.ts`: `STABLE_PREFIX_SOURCES` (context_prompt, constitution, lessons, en ese orden), `composeStablePrefix`, `createStablePrefixLoader`; límite 256 KiB, CRLF normalizado, archivos faltantes omitidos con un aviso por archivo. `EngineTurnInput.systemPrefix?` lo recibe `ClaudeAgentSdkEngine` como `systemPrompt: { preset: 'claude_code', append, excludeDynamicSections: true, snapshot: true }` (prompt caching; el efecto real no se midió).
- `AgentEngine.provider` (`KnownProvider`) es obligatorio; `FakeEngine` registra `receivedSystemPrefixes`.
- Motor único real: Claude (`claude-sdk-engine.ts`). Cada hilo nace con `engineSessionId: null` y `provider` del motor (`createThread`); la sesión nace en el primer turno, `start` solo la retoma dentro del mismo hilo y `sessionOwnedByAnotherThread` rechaza un id ya usado por otro hilo.

### 3.2 Enforcement del SPEC GATE (`src/gate/`)
- `judge.ts`: Núcleo de validación de ediciones de código (`judgeEdit`); exporta `OPEN_FIX`.
  - Herramientas monitoreadas: `EDIT_TOOLS` (`Edit`, `Write`, `MultiEdit`, `NotebookEdit`).
  - Carpetas exentas de gate: `sdd`, `.claude`, `.github`, `.gemini`, `.agents`, `.agent`, `.vscode`, `.idea`.
  - Regla: Toda edición fuera de carpetas exentas es RECHAZADA (`deny`) a menos que exista un ciclo con `status: "in-progress"` o un fix abierto con `status: "pending" | "in-progress"`. Si el permiso está en modo warn, se deriva a la UI como solicitud de aprobación con aviso visible.

### 3.3 Gestión de Sesiones y Presencia (`src/sessions/`)
- `session-manager.ts`: Coordina las conversaciones (`threads`), el historial persistido (`store.ts`), las aprobaciones (`approval.respond`) y las notificaciones del bot (`channel.botHistory`). `thread.send` sobre un hilo ocupado devuelve `{ delivery: 'pending' }` (no `conflict`): los pendientes se persisten, se entregan en el punto de corte o como siguiente turno, se editan/quitan hasta su entrega y vuelven a pendientes si el interrupt no llegó a entregarlos. `send(threadId, MessageInput)` acepta `attachments`/`refs` opcionales; `Live.acceptTail` serializa la aceptación por hilo (FIFO); las refs se filtran y deduplican contra el snapshot (una ref inexistente viaja como texto plano).
- `store.ts`: `pending[]`, `link` (`StoredLink.targets` con `dismissed?`; `migrateStoredLink` idempotente), `sessionTitle`, `contextUsage` (validado al cargar) y `provider` persistidos por hilo; un `threads.json` ilegible se renombra a `threads.json.corrupt-<epoch>` (nunca se pisa con `[]`) y un error de lectura distinto de `ENOENT` hace fallar `init()`; `tools.changed` nunca se deduplica; con migración de `threads.json` legado (`source: 'legacy'`, `provider` por defecto `claude`, sesión inválida a `null`); descarta eventos de bot consecutivos idénticos antes de escribir el `.jsonl`; `toThreadInfo` expone `engineSessionId` y `provider`. `onSessionId` usa `publishThread` (difunde `thread.updated` y persiste); `SessionManagerDeps.stablePrefix?`.
- `attachment-store.ts`: `createAttachmentStore(root)` → `.sdd-studio/attachments/<sha256>.<ext>`; `put` valida magic bytes contra el mime, deduplica por hash y escribe atómico (tmp + rename); `read` valida realpath dentro de `.sdd-studio`, `O_NOFOLLOW`, tamaño ≤ `MAX_FRAME_BYTES` y re-hash; todo fallo → `AttachmentError('not-found', 'attachment not available')` genérico. Aviso si el almacén supera 1 GiB.
- `always-rule.ts`: "Always" por alcance (herramienta, tool MCP exacta o prefijo Bash), en memoria y por hilo (se pierde al reiniciar). `bashPrefixOf` toma programa + hasta 2 subcomandos y rechaza wrappers, asignaciones de entorno y comandos compuestos. El SPEC GATE se evalúa antes que cualquier regla: `deny` bloquea siempre y una tarjeta con `warn` nunca guarda regla.
- `thread-link.ts`: álgebra pura de asociaciones múltiples (`assignLink`, `addManual`, `removeRef`, `detectRef(s)`, `legacyTargetOf`, `linkTargetExists` incluye spec). Quitar una asociación la deja descartada persistente; la detección nunca la reagrega ni pisa una manual. `thread.setLink` queda como compatibilidad sobre `targets` (`thread.updateLinks`).
- `document-tracker.ts`: `DocumentChangeTracker` emite `document.touched` exacto para Write/Edit/MultiEdit/NotebookEdit y, para Bash, por instantánea de metadatos de `sdd/` antes/después (`SNAPSHOT_MAX_ENTRIES` 20 000, `SNAPSHOT_BUDGET_MS` 250, `MAX_TOUCHED_PER_TOOL` 50); atribución por hilo/spec y omisión si es ambigua.
- Preguntas del proveedor: `AskUserQuestion` se desvía a `requestQuestion` (`question.requested`/`question.resolved`, `question.answer`); declinar o interrumpir cancela y `recover()` cancela las abiertas. `history(threadId, sinceSeq, includeDocumentTouched, includeQuestions)` oculta ambos tipos por defecto (webs anteriores). Título de sesión refrescado en `onSessionId` y cada `turn.end` (tope 3 s) con backfill de 20 hilos tras `recover()`.
- `presence.ts`: Seguimiento en memoria de qué agentes y usuarios están activos en cada canal (una pregunta abierta cuenta como agente esperando).

### 3.4 Espacio de Trabajo e Introspección (`src/workspace/`)
- `snapshot.ts`: Lee el sistema SDD local (`global.json`, `specs/index.json`, ciclos, `fixes.json`, `tools.json`, `pricing.json`) y construye el `WorkspaceSnapshot`. `workspace.snapshot` hace `await watcher.refresh()` antes de responder (FIX-e-burgos-001-001).
- `watcher.ts`: Watcher con chokidar que debounceriza escrituras en disco y emite `workspace.changed`; re-escaneo periódico para converger cuando FSEvents pierde eventos; segundo watch sobre `.claude` solo si existe al arrancar, filtrado por `isClaudeCatalogPath` (agents/skills, profundidad 3, nunca worktrees).
- `file-index.ts`: `createFileIndex(root)` — `git ls-files --cached --others --exclude-standard` con fallback a walk acotado (profundidad 12, 50 000 entradas); excluye secretos (`.env*` salvo example/sample/template, `.pem`, `.key`, `id_rsa*`, `.npmrc`, `.netrc`…), `node_modules`, `.git`, `.sdd-studio`, `.nx`, `.next`, `dist`, `coverage`, `.claude/worktrees/`; re-verifica cada resultado con realpath. Ranking por tiers (prefijo de basename, substring de basename, substring de ruta); no devuelve subsecuencias débiles en búsquedas cortas. Caché TTL 15 s; `listGit` inyectable.
- `catalog.ts`: `loadCatalog` — agentes de `.claude/agents` y `sdd/agents`, skills de `.claude/skills` y `sdd/skills`, prompts de `sdd/prompts`; dedupe por realpath canónico (symlinks `.claude` → `sdd/`), tope 200 por tipo, descripciones a 300 caracteres.
- `paths.ts`: Sanitización estricta de rutas de archivos para evitar directory traversal fuera de la raíz del repo.
- `kit-index.ts` (`kit.index`, evento `kit.changed`), `kit-tools.ts` (`kit.tools.set` con `expectedRevision` sha256-16, validación ajv contra el schema del kit, escritura atómica, test de paridad con los scripts del kit; conserva claves como `tucu_ui`; emite `tools.changed`) y `rtk-gain.ts` (`kit.rtkGain`).
- `profile.ts`: `writeProfile` (`profile.set`, escritura atómica de `sdd/global.json`).

### 3.4.1 Host, runtime y launcher (`src/main.ts`, `src/project/`)
- `BridgeHost` posee auth, login, servidor, registro de generaciones y bases permitidas; `ProjectRuntime` (`project/runtime.ts`) posee sesiones, store, watchers y el `CommandRunner` del proyecto abierto. Sin `sdd/` el puente arranca en **modo launcher** (`host.runtime === null`) en vez de abortar.
- `workspace.open` cambia de proyecto: cierra el runtime anterior (WS close `4010`, `WS_CLOSE_WORKSPACE_SWITCHED`), emite `workspace.switched` y antes verifica que `realpath` del destino siga siendo la carpeta generada y quede dentro de una base permitida. `isBusy` cuenta sesiones y comandos del kit en curso; `close()` hace `runner.terminateAll()` (SIGKILL a los hijos activos).
- `--allow-target <a,b>`: rutas absolutas separadas por coma (el home siempre está permitido); se rechaza una raíz del filesystem y se avisa por consola de las que no existen.

### 3.4.2 Wizard «Nuevo proyecto» (`src/wizard/`)
- `cli-locator` (CLI fijada vía `import.meta.resolve`), `cli-env` (env de la CLI sin credenciales ni variables de pnpm/npm/nx heredadas, `NX_DAEMON=false`), `config-cli` (`catalog`, `validate` con cola que fusiona pedidos para la vista previa y `validateExact` sin fusión para generar; un exit 2 con `ConfigCliFailure` JSON se reporta como rechazo), `preflight` (node, pnpm, git y registro; con proxy configurado el sondeo del registro queda `unknown`), `dirs` (explorador), `fs-paths`, `target` (chequeo de destino con huella), `reveal`, `init-output` (clasificador de etapas), `generation` (etapas, buffer de salida con cortes de línea acotados por `GENERATION_CHUNK_MAX`, cancelación por árbol de procesos, `cli-missing` si falta el binario, `discard` cuando la config difiere) y `service` (despacho de comandos `wizard.*`).

### 3.5 Servidor y Seguridad (`src/server/`)
- `ws-server.ts`: Servidor WebSocket en `127.0.0.1` con autenticación estricta en el handshake (`handshake.ts`), `features` en el welcome y `maxPayload` = `MAX_FRAME_BYTES`.
- `router.ts`: despacho de comandos. `Welcome.features` anuncia `BRIDGE_FEATURES` de `@sdd-studio/protocol` (entre otras `attachments`, `file-search`, `catalog`, `conversation-sessions`, `auth-subscription`, `kit-index`, `kit-tools`, `rtk-gain`, `project-wizard` y `workspace-switch`), todas implementadas. `PROTOCOL_VERSION` sigue en 2: las webs anteriores siguen funcionando.
- `security.ts`: Genera tokens criptográficamente seguros para la URL de pairing (`/w#bridge=ws://127.0.0.1:...&token=...`).
- `static.ts`: Sirve la interfaz web estática si se pasa la bandera `--local-ui`.

### 3.6 Autenticación (`src/auth/`, `auth-mode.ts`)
- `claude-login.ts`: `ClaudeLogin` lanza `claude auth login --claudeai`, `status --json` y `logout` (spawn sin shell, captura de URL, estado pending, errores redactados). El navegador lo abre el CLI; el puente no abre URLs. Requiere el binario `claude` en PATH para la solapa Suscripción.
- `auth-mode.ts`: `AuthState` guarda la preferencia de modo; `withoutCredentialEnv`, `cliEnv()`; en suscripción `env()` no lleva `ANTHROPIC_API_KEY` ni `ANTHROPIC_AUTH_TOKEN`; con key explícita se descarta el token heredado.

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
4. **E2E real del SDK:** `post-tool-batch.e2e.spec.ts` se salta sin credenciales; correrlo al actualizar `@anthropic-ai/claude-agent-sdk` (pinneado 0.3.292). Una actualización exige re-verificar `pickSessionTitle`, los campos de `PostToolUseHookInput`, `AskUserQuestion` vía `updatedInput.answers` y `getContextUsage`.
5. **FSEvents no garantiza entrega bajo carga (macOS):** toda vista derivada del fs debe poder re-escanearse a pedido (patrón de `workspace.snapshot`). El test de `.claude/skills` del watcher corre con `retry: 2`.
6. **Validación para generar nunca fusionada:** lo que se genera se valida con `validateExact` sobre la config exacta; la cola que fusiona pedidos es solo para la vista previa.
7. **Contrato CLI↔protocolo:** los topes de largo y cantidad (`CONFIG_LIMITS`, `MAX_CONFIG_BYTES` en bytes UTF-8) los publica la CLI en `catalog.limits` y el protocolo los acepta; `config-cli.contract.spec.ts` corre la CLI real. Subir la versión de la CLI exige regrabar los fixtures de `src/wizard/__fixtures__/init-output/`.
8. **Orden de release:** CLI, web, puente (la CLI fijada tiene que estar publicada antes que el puente).

## 6. Qué sigue

- Segundo proveedor: reemplazar `deps.engine` por selección según `thread.provider`.
- Spike de cache real (`cache_read_input_tokens > 0` en la segunda sesión; `append` con `options.agent`).
- Monitorear la performance del índice de archivos en workspaces de más de 50k archivos.
- Bash en segundo plano (`run_in_background`) solo se observa mientras dura su tool; escrituras fuera de `sdd/` durante un Bash no se detectan; un `touch` sin cambio cuenta como `modified`. Si recorrer `sdd/` dos veces por Bash molesta, reusar la instantánea como índice vivo alimentado por el watcher.
- `getContextUsage` se pide tras cada resultado; si se vuelve costoso, pedirlo solo al cruzar el umbral.
- Exponer la hora exacta de aprobaciones y preguntas para Actividad; exponer el interruptor de tucu-ui en el módulo Kit (requiere correr `sdd-tucu.mjs`).
- Wizard: `SIGKILL` al puente deja huérfano el grupo de procesos en POSIX (R-3); `pnpm install` escribe en el store global y corre postinstall de terceros (R-6); pendientes de Windows del review de spec-e-burgos-013 (seguimiento).
