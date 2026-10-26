# Planner — Cycle 1: studio-conversation-sessions

> **Input:** functional.md, architect.md, brief.yaml
> **Output:** planner.md y tasks.json (mismos ids TASK-NNN)
> **Generado por:** sdd-planner

## Sprint Plan — Ciclo 1 — studio-conversation-sessions

**Duracion estimada:** 2 semanas
**Story points totales:** 50
**Horas totales:** 71

Orden por subproyecto: protocolo, puente, web. Una task = una sesion de implementador. Los paquetes: `@sdd-studio/protocol` (libs/studio-protocol), `@e-burgos/sdd-studio` (apps/studio-bridge), `sdd-studio-web` (apps/studio).

## Camino critico

TASK-001 -> TASK-004 / TASK-002 -> TASK-003 -> TASK-005 (puente); TASK-001 -> TASK-006 -> TASK-007 -> TASK-008 -> TASK-010 -> TASK-012 -> TASK-014 -> TASK-015 (web). La web solo depende del tipo de ThreadInfo (TASK-001), no del puente en ejecucion.

## Tasks

### TASK-001: Protocolo: ProviderId, EngineSessionId y campos opcionales en ThreadInfo

**Historias:** HU-02, HU-06
**Subproyecto:** libs/studio-protocol
**Criterios CA cubiertos:** CA-006, CA-007, CA-010, CA-031
**Descripcion:** Agregar KNOWN_PROVIDERS, KnownProvider, DEFAULT_PROVIDER, ProviderId, isKnownProvider y EngineSessionId; campos opcionales engineSessionId (nullable) y provider en ThreadInfo; sumar "conversation-sessions" al final de BRIDGE_FEATURES. PROTOCOL_VERSION queda en 2. Specs: forma legada sin campos, null, id, provider extensible, provider invalido rechazado, lista de features.
**Estimacion:** 4h · **Story points:** 3
**Dependencias:** ninguna
**Archivos:**

- `libs/studio-protocol/src/domain.ts`
- `libs/studio-protocol/src/limits.ts`
- `libs/studio-protocol/src/domain.spec.ts`
- `libs/studio-protocol/src/handshake.spec.ts`

**Verificacion:** `pnpm --filter @sdd-studio/protocol test && pnpm --filter @sdd-studio/protocol typecheck`

**Criterio de done:**

- [ ] Los CA listados se cumplen y tienen test o evidencia
- [ ] `pnpm --filter @sdd-studio/protocol test && pnpm --filter @sdd-studio/protocol typecheck` en verde
- [ ] Sin comentarios en el codigo agregado

### TASK-002: Puente: stable-prefix y tipos de engine (systemPrefix, provider)

**Historias:** HU-03
**Subproyecto:** apps/studio-bridge
**Criterios CA cubiertos:** CA-011, CA-012, CA-013, CA-014, CA-015, CA-016
**Descripcion:** EngineTurnInput.systemPrefix? y AgentEngine.provider en types.ts. Crear stable-prefix.ts (D-06): lee context_prompt.md, constitution.md y lessons.md en ese orden, UTF-8, \r\n a \n, trim, limite 256 KiB, etiqueta con ruta relativa constante, archivo faltante se omite con un aviso por archivo y proceso, sin datos variables ni resumen. Spec: idempotencia byte a byte, cambio en cada archivo, faltante, ausencia de datos variables.
**Estimacion:** 5h · **Story points:** 3
**Dependencias:** TASK-001
**Archivos:**

- `apps/studio-bridge/src/engine/types.ts`
- `apps/studio-bridge/src/engine/stable-prefix.ts`
- `apps/studio-bridge/src/engine/stable-prefix.spec.ts`

**Verificacion:** `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck`

**Criterio de done:**

- [ ] Los CA listados se cumplen y tienen test o evidencia
- [ ] `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck` en verde
- [ ] Sin comentarios en el codigo agregado

### TASK-003: Puente: engines inyectan prefijo y declaran provider

**Historias:** HU-02, HU-03
**Subproyecto:** apps/studio-bridge
**Criterios CA cubiertos:** CA-006, CA-011, CA-012
**Descripcion:** ClaudeSdkEngine.provider = "claude"; buildQueryOptions pone systemPrompt {type:"preset",preset:"claude_code",append:systemPrefix,excludeDynamicSections:true,snapshot:true} solo si hay systemPrefix, tambien con resume. FakeEngine.provider = "claude" y registra el systemPrefix recibido. Specs de buildQueryOptions con y sin prefijo.
**Estimacion:** 4h · **Story points:** 3
**Dependencias:** TASK-002
**Archivos:**

- `apps/studio-bridge/src/engine/claude-sdk-engine.ts`
- `apps/studio-bridge/src/engine/claude-sdk-engine.spec.ts`
- `apps/studio-bridge/src/engine/fake-engine.ts`
- `apps/studio-bridge/src/engine/fake-engine.spec.ts`

**Verificacion:** `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck`

**Criterio de done:**

- [ ] Los CA listados se cumplen y tienen test o evidencia
- [ ] `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck` en verde
- [ ] Sin comentarios en el codigo agregado

### TASK-004: Puente: store con provider/engineSessionId visibles y migracion de threads.json

**Historias:** HU-02, HU-06
**Subproyecto:** apps/studio-bridge
**Criterios CA cubiertos:** CA-006, CA-007, CA-031
**Descripcion:** Tipo StoredThread con provider; toThreadInfo deja de descartar engineSessionId y emite provider; init() migra hilos viejos a provider "claude" conservando engineSessionId. Invertir el test que exigia ocultar la sesion (CA-006) y agregar caso de threads.json viejo (CA-007).
**Estimacion:** 4h · **Story points:** 3
**Dependencias:** TASK-001
**Archivos:**

- `apps/studio-bridge/src/sessions/store.ts`
- `apps/studio-bridge/src/sessions/store.spec.ts`

**Verificacion:** `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck`

**Criterio de done:**

- [ ] Los CA listados se cumplen y tienen test o evidencia
- [ ] `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck` en verde
- [ ] Sin comentarios en el codigo agregado

### TASK-005: Puente: session-manager con propiedad exclusiva de sesion, systemPrefix y publishThread

**Historias:** HU-01, HU-03, HU-02
**Subproyecto:** apps/studio-bridge
**Criterios CA cubiertos:** CA-001, CA-002, CA-004, CA-006, CA-011, CA-012
**Descripcion:** createThread fija provider del engine y engineSessionId null; dep opcional stablePrefix y systemPrefix en start(); onSessionId rechaza ids que pertenecen a otro hilo (sessionOwnedByAnotherThread, reportError) y usa publishThread (tracker.onThread + thread.updated). Tests con FakeEngine: dos hilos con ids distintos tras el primer turno, el turno posterior de A usa resumeSessionId de A, onSessionId con el id de B sobre A es rechazado, fallo antes de init deja null y el siguiente turno no hace resume, thread.updated lleva el id.
**Estimacion:** 6h · **Story points:** 5
**Dependencias:** TASK-003, TASK-004
**Archivos:**

- `apps/studio-bridge/src/sessions/session-manager.ts`
- `apps/studio-bridge/src/sessions/session-manager.spec.ts`

**Verificacion:** `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck`

**Criterio de done:**

- [ ] Los CA listados se cumplen y tienen test o evidencia
- [ ] `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck` en verde
- [ ] Sin comentarios en el codigo agregado

### TASK-006: Web: modulo puro conversation.ts (derivacion, seleccion, referencias)

**Historias:** HU-04, HU-05
**Subproyecto:** apps/studio
**Criterios CA cubiertos:** CA-018, CA-019, CA-020, CA-021, CA-022
**Descripcion:** Implementar D-07: listConversations, resolveSelectedThreadId, deriveConversation, referencesInText, inferGateFromText (movida desde swarm-dialogue.ts sin cambios). Reglas: fuentes escaneadas, regex de spec y fix, validacion con SpecIdValue/FixIdValue, canonizacion con snapshot (known), link como source "link", participantes, dialogos sin timestamps, isEmpty. Spec con dos conversaciones de eventos distintos, hilo vacio, sin hilos, desempates de recencia.
**Estimacion:** 7h · **Story points:** 5
**Dependencias:** TASK-001
**Archivos:**

- `apps/studio/src/lib/conversation.ts`
- `apps/studio/src/lib/conversation.spec.ts`

**Verificacion:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`

**Criterio de done:**

- [ ] Los CA listados se cumplen y tienen test o evidencia
- [ ] `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck` en verde
- [ ] Sin comentarios en el codigo agregado

### TASK-007: Web: i18n mc.* y componentes ConversationSessionInfo y RelatedDocuments

**Historias:** HU-02, HU-04, HU-05
**Subproyecto:** apps/studio
**Criterios CA cubiertos:** CA-008, CA-020, CA-023, CA-027
**Descripcion:** Claves mc.newConversation, noActivity, noConversations, noSession, sessionUnknown, providerUnknown, noTelemetry, related.* en es y en. ConversationSessionInfo (D-08: id, "Sin sesion todavia", "sesion no informada", proveedor conocido/desconocido/no informado). RelatedDocuments: lista specs/fixes, known con enlace a DocumentViewerModal via getAgentGeneratedDocuments, fix repo-level sin enlace. Usar Lucide.
**Estimacion:** 5h · **Story points:** 3
**Dependencias:** TASK-006
**Archivos:**

- `apps/studio/src/lib/i18n/es.ts`
- `apps/studio/src/lib/i18n/en.ts`
- `apps/studio/src/components/mission-control/ConversationSessionInfo.tsx`
- `apps/studio/src/components/mission-control/ConversationSessionInfo.spec.tsx`
- `apps/studio/src/components/mission-control/RelatedDocuments.tsx`
- `apps/studio/src/components/mission-control/RelatedDocuments.spec.tsx`

**Verificacion:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`

**Criterio de done:**

- [ ] Los CA listados se cumplen y tienen test o evidencia
- [ ] `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck` en verde
- [ ] Sin comentarios en el codigo agregado

### TASK-008: Web: NewConversationButton, ConversationSelector y hook useConversationSelection

**Historias:** HU-01, HU-04
**Subproyecto:** apps/studio
**Criterios CA cubiertos:** CA-003, CA-017, CA-018, CA-022
**Descripcion:** NewConversationButton (icono MessageSquarePlus, prop onNewConversation). ConversationSelector: cinta que lista conversaciones y el boton. Hook useConversationSelection devuelve {conversations, selectedThreadId, pick, view}, memoiza deriveConversation y llama openThread si el hilo elegido no esta synced. Tests del selector (lista, seleccion, estado vacio con boton).
**Estimacion:** 5h · **Story points:** 3
**Dependencias:** TASK-006, TASK-007
**Archivos:**

- `apps/studio/src/components/NewConversationButton.tsx`
- `apps/studio/src/components/mission-control/ConversationSelector.tsx`
- `apps/studio/src/components/mission-control/ConversationSelector.spec.tsx`
- `apps/studio/src/lib/use-conversation-selection.ts`

**Verificacion:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`

**Criterio de done:**

- [ ] Los CA listados se cumplen y tienen test o evidencia
- [ ] `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck` en verde
- [ ] Sin comentarios en el codigo agregado

### TASK-009: Web: cableado de Nueva conversacion en Sidebar, Workspace y WorkspaceApp

**Historias:** HU-01
**Subproyecto:** apps/studio
**Criterios CA cubiertos:** CA-001, CA-003
**Descripcion:** Boton en encabezado de SidebarView; Workspace acepta newConversationSignal y deja view {channelId, threadId:null} al cambiar; Connected incrementa la senal y pasa a la vista workspace desde Mission Control. No toca el borrador. Ajustar specs del encabezado y agregar test de la senal.
**Estimacion:** 4h · **Story points:** 3
**Dependencias:** TASK-008
**Archivos:**

- `apps/studio/src/components/WorkspaceApp.tsx`
- `apps/studio/src/components/workspace/Workspace.tsx`
- `apps/studio/src/components/workspace/Sidebar.tsx`
- `apps/studio/src/components/workspace/workspace.spec.tsx`
- `apps/studio/src/components/workspace/sidebar.spec.tsx`

**Verificacion:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`

**Criterio de done:**

- [ ] Los CA listados se cumplen y tienen test o evidencia
- [ ] `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck` en verde
- [ ] Sin comentarios en el codigo agregado

### TASK-010: Web: LiveSwarmComms, ChatDialogueCard y LiveAgentChatFeed sobre ConversationDialogue

**Historias:** HU-04, HU-05, HU-01
**Subproyecto:** apps/studio
**Criterios CA cubiertos:** CA-019, CA-021, CA-022, CA-024, CA-027
**Descripcion:** Tipos pasan a ConversationDialogue; fuera toggle demo, mode, demoDialogues, HarnessProvider y hilos DM sueltos; badge de proveedor desde el valor real (sin proveedor, sin badge); "Sin actividad todavia" sin dialogos. El feed muestra los dialogos de la conversacion seleccionada filtrados por agente; envio rapido = thread.send a la seleccionada, o thread.create (DM) y pick(id) si no hay. Reescribir chatdialoguecard.spec.tsx.
**Estimacion:** 6h · **Story points:** 5
**Dependencias:** TASK-006, TASK-008
**Archivos:**

- `apps/studio/src/components/mission-control/LiveSwarmComms.tsx`
- `apps/studio/src/components/mission-control/ChatDialogueCard.tsx`
- `apps/studio/src/components/mission-control/LiveAgentChatFeed.tsx`
- `apps/studio/src/components/mission-control/chatdialoguecard.spec.tsx`

**Verificacion:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`

**Criterio de done:**

- [ ] Los CA listados se cumplen y tienen test o evidencia
- [ ] `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck` en verde
- [ ] Sin comentarios en el codigo agregado

### TASK-011: Web: reescritura de AgentInspectorDrawer sin datos ficticios

**Historias:** HU-04, HU-05
**Subproyecto:** apps/studio
**Criterios CA cubiertos:** CA-008, CA-023, CA-025, CA-027, CA-028, CA-029
**Descripcion:** Recibe conversation: ConversationView|null. Eliminar specsList/fixesList de respaldo, selectores, fixFilter, specScope, currentSessionId y textos Google Gemini/GitHub Copilot. Integrar ConversationSessionInfo y RelatedDocuments. Reescribir el spec para exigir datos reales o estado vacio; mantener visor de documentos.
**Estimacion:** 5h · **Story points:** 3
**Dependencias:** TASK-007
**Archivos:**

- `apps/studio/src/components/mission-control/AgentInspectorDrawer.tsx`
- `apps/studio/src/components/mission-control/inspectordrawer.spec.tsx`

**Verificacion:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`

**Criterio de done:**

- [ ] Los CA listados se cumplen y tienen test o evidencia
- [ ] `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck` en verde
- [ ] Sin comentarios en el codigo agregado

### TASK-012: Web: AgentMapCanvas centrado en la conversacion y borrado de swarm-dialogue.ts

**Historias:** HU-04, HU-05
**Subproyecto:** apps/studio
**Criterios CA cubiertos:** CA-017, CA-018, CA-019, CA-021, CA-022, CA-023, CA-024, CA-025, CA-029
**Descripcion:** Quitar selectedSpecId (default fijo a spec-004), selectedFixId, mode demo/live y toggle, matching por spec/fix y bucle top 3 hilos; usar useConversationSelection y ConversationSelector. Nodos con participating (atenuados sin participacion), presencia filtrada por threadId, estado vacio sin conversaciones con boton. Borrar swarm-dialogue.ts y corregir imports. Mantener zoom/pan, gates y drawers; quitar casos demo del spec y cubrir cambio entre dos conversaciones.
**Estimacion:** 7h · **Story points:** 5
**Dependencias:** TASK-008, TASK-010, TASK-011
**Archivos:**

- `apps/studio/src/components/mission-control/AgentMapCanvas.tsx`
- `apps/studio/src/components/mission-control/agentmap.spec.tsx`
- `apps/studio/src/components/mission-control/swarm-dialogue.ts`

**Verificacion:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`

**Criterio de done:**

- [ ] Los CA listados se cumplen y tienen test o evidencia
- [ ] `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck` en verde
- [ ] Sin comentarios en el codigo agregado

### TASK-013: Web: LiveTelemetryHUD sin telemetria inventada

**Historias:** HU-05
**Subproyecto:** apps/studio
**Criterios CA cubiertos:** CA-026, CA-028
**Descripcion:** Eliminar INITIAL_TELEMETRY; estado TelemetryData|null; con grandTokens 0 o sin ciclos mostrar "Sin telemetria todavia"; formatModelName usa el id real y el proveedor sale del prefijo de provider_model; conservar DEFAULT_RATES. Reescribir telemetry.spec.tsx.
**Estimacion:** 3h · **Story points:** 2
**Dependencias:** TASK-007
**Archivos:**

- `apps/studio/src/components/mission-control/LiveTelemetryHUD.tsx`
- `apps/studio/src/components/mission-control/telemetry.spec.tsx`

**Verificacion:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`

**Criterio de done:**

- [ ] Los CA listados se cumplen y tienen test o evidencia
- [ ] `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck` en verde
- [ ] Sin comentarios en el codigo agregado

### TASK-014: Test de busqueda en fuente y auditoria de creacion de hilos

**Historias:** HU-01, HU-02, HU-05
**Subproyecto:** apps/studio
**Criterios CA cubiertos:** CA-005, CA-009, CA-024, CA-026
**Descripcion:** Spec que recorre apps/studio/src (fuera de *.spec.*) y falla ante session- literal, SWARM_SCRIPTS_BY_SPEC, 6611605, Gemini Flash. Documentar en artifacts/audit-thread-creation.md el resultado D-10 (Composer y LiveAgentChatFeed) citando los tests que lo prueban.
**Estimacion:** 3h · **Story points:** 2
**Dependencias:** TASK-005, TASK-012, TASK-013
**Archivos:**

- `apps/studio/src/lib/no-fabricated-data.spec.ts`
- `sdd/specs/spec-e-burgos-005-studio-conversation-sessions/cycles/cycle-01/artifacts/audit-thread-creation.md`

**Verificacion:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`

**Criterio de done:**

- [ ] Los CA listados se cumplen y tienen test o evidencia
- [ ] `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck` en verde
- [ ] Sin comentarios en el codigo agregado

### TASK-015: Limpieza y verificacion integral del ciclo

**Historias:** HU-06
**Subproyecto:** apps/studio
**Criterios CA cubiertos:** CA-029, CA-030, CA-031
**Descripcion:** Verificar imports huerfanos, codigo sin comentarios, sin dependencias nuevas y que la web antigua/puente antiguo no fallan (payload legado). Correr build, typecheck y test completos y corregir lo que falle. Opcional: spike manual de cache en artifacts/ si hay credenciales.
**Estimacion:** 3h · **Story points:** 2
**Dependencias:** TASK-014
**Archivos:**

- `libs/studio-protocol`
- `apps/studio-bridge`
- `apps/studio`

**Verificacion:** `pnpm build && pnpm typecheck && pnpm test`

**Criterio de done:**

- [ ] Los CA listados se cumplen y tienen test o evidencia
- [ ] `pnpm build && pnpm typecheck && pnpm test` en verde
- [ ] Sin comentarios en el codigo agregado

## Cierre (fuera de las tasks)

Fragmentos aditivos en updates/ de los tres subproyectos, fila de cada uno en sdd/context/constitution.md, COMP-016..020 a implemented y registro de usage por task: los hace el reviewer/orquestador.
