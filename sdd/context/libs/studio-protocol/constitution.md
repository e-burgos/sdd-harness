# Constitución — libs/studio-protocol

> Versión 1.7 | Última actualización: consolida los fragmentos de spec-e-burgos-026, 027, 029, 030, 031 y 032 cycle-01 (herramientas de Claude, ejecución del kit, contexto de sesión, gate) | Fecha: 2026-11-20

## 1. Propósito y Alcance

- **Tipo:** lib (librería compartida interna del monorepo)
- **Paquete:** `@sdd-studio/protocol`
- **Rol en el sistema:** Define el contrato formal y tipado de extremo a extremo entre el puente local (`@e-burgos/sdd-studio`) y la interfaz web (`sdd-studio-web`). Garantiza la compatibilidad de mensajes, eventos, comandos y snapshots que fluyen por WebSocket local (127.0.0.1).
- **Consumidores:** `apps/studio` (frontend) y `apps/studio-bridge` (backend/daemon).

## 2. Stack Tecnológico

- **Runtime:** TypeScript estricto (ESM). No requiere paso de compilación previo para desarrollo: exporta directamente `src/index.ts`.
- **Esquemas y Validación en Runtime:** `zod` (^4.0.0). Todos los mensajes recibidos o enviados se validan contra esquemas Zod con parsing estricto.
- **Testing:** `vitest`. Pruebas exhaustivas al lado de cada módulo (`*.spec.ts`).

## 3. Estructura y Módulos del Contrato

- `version.ts`: Constante `PROTOCOL_VERSION = 2`. El handshake valida coincidencia exacta. El bump a 2 cubre los contratos de toda spec-e-burgos-001; cycle-02 los implementó del lado puente/web sin nuevo bump.
- `limits.ts`: `MAX_FRAME_BYTES` (1 MiB), `FRAME_BUDGET_BYTES`, `MAX_ATTACHMENTS`, `IMAGE_MAX_SIDE`, `MAX_PROMPT_REFS`, `FILE_SEARCH_MAX`, `MAX_PENDING_PER_THREAD` (10), `MAX_LINK_TARGETS` (32), `MAX_CONFIG_BYTES` (64 KiB), `GENERATION_CHUNK_MAX`, `GENERATION_BUFFER_BYTES` (4 MiB), `MAX_DIR_ENTRIES`, `WS_CLOSE_WORKSPACE_SWITCHED` (4010) y `BRIDGE_FEATURES` (entre otras `conversation-sessions`, `auth-subscription`, `session-title`, `link-targets`, `document-touched`, `questions`, `context-usage`, `profile-set`, `kit-index`, `kit-tools`, `rtk-gain`, `project-wizard`, `workspace-switch` y `github`; máximo 32).
- `attachments.ts`: mimes de imagen/PDF/texto y `TEXT_ATTACHMENT_EXTENSIONS`.
- `domain.ts`: Tipos base y entidades de dominio:
  - `ChannelId`: `general`, `fixes`, `spec:<id>` o `dm:<agentId>`.
  - `AgentId`: Roles SDD (`orchestrator`, `functional`, `planner`, `architect`, `implementor-back`, `implementor-front`, `reviewer`, `steward`).
  - `ModelChoice`: Tiers simbólicos (`kit`, `haiku`, `sonnet`, `opus`, `fable`, o proveedor explícito).
  - `Effort`: `low`, `medium`, `high`, `xhigh`, `max`.
  - `PermissionModeChoice`: `ask` (aprobación en UI para cada herramienta sensible), `acceptEdits` (edición permitida si pasa el SPEC GATE), `plan` (modo solo lectura).
  - `Presence`, `SessionStatus`, `ThreadOptions`, `Author`.
  - `ThreadLink` / `ThreadLinkTarget` (`cycle` | `fix` | `none`, `source` auto/manual/legacy), `ThreadInfo.link` y `ThreadInfo.pendingCount`. `LinkOrigin` (`detected | manual`), `ThreadLinkRef` (spec, ciclo o fix), `ThreadLinkEntry` (ref + `origin`) y `ThreadLink.targets` opcional con `.catch(undefined)`; `link.target` conserva su unión vieja como compatibilidad y el puente la deriva de `targets`.
  - `ThreadInfo.sessionTitle` (`string | null`, opcional, `.catch(null)`, máx. 300) y `ThreadInfo.contextUsage` (`nullable().optional().catch(null)`).
  - Preguntas y perfil: `Question`, `QuestionOption`, `QuestionAnswer`, `MAX_QUESTIONS`, `MAX_QUESTION_OPTIONS`, `ContextUsage`, `DevProfile`, `FlowChoice`.
  - `ThreadInfo.engineSessionId` (`EngineSessionId` nullable, 1..128) y `ThreadInfo.provider` (`ProviderId`, string con regex extensible; `KNOWN_PROVIDERS` = `claude`, `DEFAULT_PROVIDER`, `isKnownProvider`): ambos opcionales, sin bump de versión.
  - `AuthPreference`, `AuthAccountState`, `AuthAccount` (state, email, method, plan, loginUrl, error).
  - `AlwaysOffer` / `AlwaysRule` (`tool` | `mcp` | `bash-prefix`, `none` con motivo) y `SendResult` (`started` | `pending`).
- `commands.ts`: Comandos enviados desde la web al puente local (`ClientCommand` - discriminated union por `cmd`):
  - `workspace.snapshot`: Pide estado completo del repo.
  - `thread.create` (con `link` opcional), `thread.send` (acepta `MessageBody`), `thread.interrupt`, `thread.setOptions`, `thread.list`, `thread.history`.
  - `thread.pending.edit|remove|flush`, `thread.setLink`.
  - `workspace.searchFiles`, `attachment.get` (implementados por el puente; anunciados en `Welcome.features`).
  - `approval.respond`: Aprobación o rechazo (`allow` | `deny`) de un tool call con alcance `once` o `thread`.
  - `command.run`: Ejecución segura de comandos del kit (`gate`, `validate`, `rebuild-tasks-index`, `rebuild-catalog`).
  - `auth.set`: Configuración en memoria de API key de Anthropic (nunca persistida en disco); acepta `mode` opcional (`subscription` | `api-key`).
  - `auth.status`, `auth.login`, `auth.logout`: login de la suscripción de Claude lanzado por el puente.
  - `thread.updateLinks` (`add`/`remove` de `ThreadLinkRef`, máx. 8 cada uno, por defecto `[]`), `question.answer { questionId, answers, decline }`, `profile.set { profile }`; `thread.history` con opt-ins `includeDocumentTouched` e `includeQuestions` (por defecto `false`).
  - Kit: `kit.index`, `kit.tools.set` (con `expectedRevision`), `kit.rtkGain`; `channel.botHistory` con `includeKitEvents`.
  - Integraciones del kit (feature `kit-integrations`): `kit.integration.status { integration }` → `KitIntegrationStatus` y `kit.integration.set { integration, enabled }` → `KitIntegrationSetResult` (`ok`, `exitCode`, `output` ≤ 8 KiB, `status`).
  - GitHub (feature `github`): `github.status { generationId? }` → `GithubStatus` y `github.connect { generationId?, name?, owner?, visibility, protect }` → `GithubConnectResult`.
  - Wizard: `wizard.catalog`, `wizard.preflight`, `wizard.validate`, `wizard.listDirs`, `wizard.checkTarget`, `wizard.generate`, `wizard.generation.get`, `wizard.generation.cancel`, `wizard.reveal` y `workspace.open`.
- `events.ts`: Eventos emitidos desde el puente hacia la web:
  - `ThreadEvent` (mensajes, `message.delta`, tool call start/end con diff y resumen, `subagent.start|stop`, `approval.requested` con warnings del SPEC GATE y `always`, `approval.resolved` con `remembered`, `pending.added|edited|removed|reverted`, `user.message` con `pendingId` y `delivery` `cut-point` | `next-turn`).
  - `ThreadEvent` también incluye `document.touched` (`path` 1..1024, `op` `created | modified | deleted`, `author`; sin `seq` propio), `question.requested { questionId, author, questions }`, `question.resolved { questionId, outcome: answered|declined|cancelled, answers? }` y `tool.start.summaryTruncated` opcional.
  - `ServerEvent` (`kit.changed`, `generation.status`, `generation.output` con `seq`, `workspace.switched`, `thread.event`, `channel.event`, `bot.activity`, `workspace.changed`, `presence.changed`).
- `handshake.ts`: `hello` (token del hash de la URL y versión) y `welcome` (ruta del workspace —nula con el puente en modo launcher—, proyecto, versión del kit, `AuthMode` y `features` opcional con `BRIDGE_FEATURES`, para detectar capacidades sin otro bump). Errores: `handshake.error`.
- `snapshot.ts`: Esquema `WorkspaceSnapshot` que modela en memoria el estado completo del kit: módulos en `global.json`, `specs` (`SpecSummary`), `cycles` (`CycleSummary` con tareas y estado), `fixes` (`FixSummary` con `createdAt`/`closedAt`), agentes (con `source`/`path`), `skills[]`, herramientas (`tools.json`, opcional; bot event `tools.changed`), pricing y `sessions` (opcional): ataduras `SessionBinding` (`sessionId`, `unit` ciclo o fix, `harness`, `source`, `worktree`, `boundAt`, `updatedAt`) con tope `MAX_SESSION_BINDINGS` (64) y `.catch(undefined)` para tolerar puentes o kits viejos; `leases` (opcional, `.catch(undefined)`): reservas de archivo `FileLeaseSummary` (`path`, `sessionId`, `unit` nullable, `harness`, `worktree`, `acquiredAt`, `updatedAt`, `requestedBy` ≤ 16) con tope `MAX_FILE_LEASES` (256); y `github` (opcional): `SnapshotGithub` con el remoto y `CycleGithub[]` (rama, PR y checks por ciclo en curso), tope `MAX_GITHUB_CYCLES` (64). Ninguno de los tres cambió `PROTOCOL_VERSION`.
- `kit.ts`: esquemas del índice del kit, `tools.json` y `rtk-gain`, más las integraciones: `KIT_INTEGRATIONS`, `KitIntegrationId` (`tucu-ui` | `video-maker`), `KIT_INTEGRATION_HARNESSES`, `KitIntegrationStatus` (con `.catch` tolerantes), `KitIntegrationSetResult` y `MAX_INTEGRATION_OUTPUT_BYTES`; el evento `integration.changed` (bot event) vive en `events.ts` y su límite en `limits.ts`.
- `github.ts`: `GithubStatus`, `GithubConnectRequest`, `GithubConnectResult`, `CycleGithub`, `SnapshotGithub` y `MAX_GITHUB_CYCLES` (la CLI del kit hace el trabajo con el `gh` del dev; el contrato solo transporta el resultado).
- `wizard.ts`: schemas del wizard «Nuevo proyecto» (`ConfigDraft`, `ConfigCatalog` con `limits` y `nx { majors, default, versions }` opcionales (los catálogos de CLIs viejas siguen validando), `ConfigValidation`, `ConfigCliFailure`, `Preflight`, `DirListing`, `TargetCheck`/`TargetState`, `GenerationState`/`Stage`/`Status`, `GenerateResult`, `GenerationSnapshot`, `WorkspaceOpenResult`). Reflejan el contrato `config catalog`/`validate` de la CLI: un cambio de ese contrato se versiona aquí y en el puente a la vez; el tope de `ConfigDraft` se mide en bytes UTF-8.
- `claude-tools.ts`: `ClaudeToolsConfig` (fuentes user/local, `disabledPlugins` por id `name@marketplace`, `disabledMcpServers` por nombre exacto del init, `browser {enabled, browserUrl}`), `DEFAULT_CLAUDE_TOOLS_CONFIG` (`browser.enabled = true`), `ClaudeToolsRevision` (= `ToolsRevision`), `ClaudeToolsScope` (`global` | `project`), `ClaudeMcpStatus` (estado desconocido ⇒ `unknown`), `ClaudeBrowserStatus` (`connected` | `chrome-closed` | `unknown` | `off`; `permission-pending`/`debugging-disabled` quedan por compatibilidad), `ClaudeInventory` (plugins, MCP con estado, `counts.project`/`counts.all`) y resultados de `get`/`set`/`refresh`; `scope?` y `hasProjectOverride?` en `ClaudeToolsGetResult`/`ClaudeToolsSetResult` son tolerantes.
  - Comandos: `claude.tools.get`, `claude.tools.set {config, expectedRevision, scope?}`, `claude.tools.useGlobal {expectedRevision}`, `claude.inventory.refresh`, `claude.browser.check`/`openSettings`, `claude.mcp.login {name}` (outcomes ok | not-oauth | header-auth | unknown-server | failed | timeout | terminal, enum tolerante) y `claude.mcp.reconnect {name}`. Bot kinds `claude-tools.changed` y `claude-browser.changed`; features `claude-tools`, `claude-tools-scope` y `claude-connect`.
- Ejecución del kit, contexto y gate: `TaskSummary` + `usage?`/`batch?`/`dependsOn?`; `CycleSummary` + `batches?`/`verifyResults?`; snapshot + `verifyConfig?`/`verifyLease?`; `kit.verify.run {app, level, spec?, cycle?, unit?}` → `{runId}` (salida por `command.output/exit`; feature `kit-execution`). `ThreadInfo.contextSource?` (pack con spec/ciclo/rol/unidad/bytes, o base), sección `harness` del índice del kit con roles `harness-core|harness-rule|harness-project` y `trigger?`/`description?`/`bytes?`, `kit.pack.stats` → `KitPackStats` (feature `session-context`). `kit.gate.check {spec, cycle?}` → `KitGateResult {spec, gate, passed, checks, next?, flow?, cycle?}` (feature `kit-gate`) y `KitToolsState.exempt?` (globs de `claude_mod.exempt`).
- `codec.ts`: Encoders y decoders seguros (`decodeClientMessage`, `decodeServerMessage`, `encodeMessage`).

## 4. Comandos de Trabajo

- **Tests unitarios:** `pnpm --filter @sdd-studio/protocol test`
- **Verificación de tipos:** `pnpm --filter @sdd-studio/protocol typecheck` (`tsc --noEmit -p tsconfig.json`)

## 5. Reglas Inviolables y Versionado

1. **Invariante de sincronización:** Cualquier cambio en este paquete impacta simultáneamente a `apps/studio` y `apps/studio-bridge`. Modificaciones en comandos o eventos deben ser retrocompatibles o requerir incremento de `PROTOCOL_VERSION` en `version.ts`.
2. **Sin dependencias pesadas:** Debe mantenerse ultra liviano (solo `zod`). No debe depender de Node.js nativo (fs, path, child_process) para permitir su ejecución sin problemas en entornos navegador (Next.js / browser).
3. **Flujo SDD:** Cambios estructurales en `libs/studio-protocol` deben correr bajo un ciclo SDD completo (`flow: full`), ya que es un contrato consumido por dos subproyectos distintos.
4. **Eventos persistidos en el historial:** todo evento nuevo que viaje dentro de `thread.history` necesita su opt-in (patrón `includeDocumentTouched`/`includeQuestions`, por defecto `false`) y una prueba de que sin él no sale; una web anterior no puede parsear un resultado de comando con un evento desconocido. Decidirlo al diseñar el contrato, no al cerrar el ciclo.

## 6. Qué sigue

- Todo comando nuevo se usa solo si `client.supports(feature)`: un puente viejo lo ignora y la petición vence a los 15 s.
- Todo campo nuevo del protocolo entra opcional; la web detecta bridges viejos por `features`. Volver obligatorio un campo requiere bump de `PROTOCOL_VERSION` (hoy 2).
- Pendientes: campos de hora en aprobaciones y preguntas.
