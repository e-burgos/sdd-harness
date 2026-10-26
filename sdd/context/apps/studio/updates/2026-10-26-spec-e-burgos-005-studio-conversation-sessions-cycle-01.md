# spec-e-burgos-005-studio-conversation-sessions cycle-01 — 2026-10-26

## Estado
Mission Control gira alrededor de una conversación (hilo) elegida con `ConversationSelector`; por defecto la de `lastActivity` más reciente. Agentes, diálogos y specs/fixes relacionados se derivan de los eventos de ese hilo. La web muestra el id de sesión y el proveedor reales (`ConversationSessionInfo`), "Sin sesión todavía" si aún no hay. Botón "Nueva conversación" (sidebar y Mission Control) deja un borrador vacío seleccionado; el hilo nace con el primer `thread.create`. Se eliminaron guiones ficticios, selectores de spec/fix, filtro de fixes, telemetría de relleno y proveedores fijos; la telemetría vacía dice "Sin telemetría todavía". Resuelve: lo que el base describa como guiones/`swarm-dialogue.ts` o selectores de spec/fix en el inspector.

## Estructura
- `lib/conversation.ts` (puro): `listConversations`, `resolveSelectedThreadId`, `deriveConversation`, `referencesInText`, `inferGateFromText` (movida desde `swarm-dialogue.ts`, borrado), `providerLabel`.
- `lib/use-conversation-selection.ts`: hook de selección; sincroniza el hilo elegido con `openThread`.
- `components/mission-control/`: `ConversationSelector`, `ConversationSessionInfo`, `RelatedDocuments` (nuevos); `AgentMapCanvas`, `AgentInspectorDrawer`, `LiveAgentChatFeed`, `LiveSwarmComms`, `ChatDialogueCard`, `LiveTelemetryHUD` reescritos sobre `ConversationView`/`ConversationDialogue`. Los nodos sin participación se atenúan, no se ocultan.
- `components/NewConversationButton.tsx`; `Workspace` acepta `newConversationSignal`.
- `lib/store/state.ts`: `sameInfo` compara `engineSessionId` y `provider`.
- `lib/no-fabricated-data.spec.ts`: test de búsqueda en fuente (patrones `session-`, guiones, 6611605, Gemini/Copilot fijos, spec por defecto fija).
- i18n: claves `mc.*` en es/en.

## Dependencias
Sin dependencias nuevas.

## Qué sigue
- La tarjeta RTK de `LiveTelemetryHUD` y los textos fijos "STREAMING TELEMETRY ACTIVE" y "N listos" del mapa no reflejan estado real (hallazgos pendientes del reviewer).
- Spike de cache real con credenciales sin correr.
