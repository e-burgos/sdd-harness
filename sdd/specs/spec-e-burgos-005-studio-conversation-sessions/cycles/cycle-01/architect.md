# Architect — Cycle 1: studio-conversation-sessions

> **Input:** sdd/specs/spec-e-burgos-005-studio-conversation-sessions/cycles/cycle-01/functional.md
> **Output:** sdd/specs/spec-e-burgos-005-studio-conversation-sessions/cycles/cycle-01/architect.md
> **Generado por:** sdd-architect (claude/sonnet, effort high)

---

## Alcance del diseño

Este ciclo no toca base de datos ni expone endpoints REST: el contrato es el protocolo WebSocket de `libs/studio-protocol` (zod) y el estado local `.sdd-studio/threads.json` del puente. Por eso **no se escribe nada en `sdd/schema.json` ni en `sdd/api.json`** (sus registros modelan tablas y endpoints HTTP; los comandos WS viven en `libs/studio-protocol/src/commands.ts`). Sí se registran los componentes web nuevos en `sdd/components.json` (app-key `apps/studio`, COMP-016..020, `defined`). Stack respetado: TypeScript estricto + zod (protocolo), Node ESM + `@anthropic-ai/claude-agent-sdk@0.3.292` pinneado (puente), Next 16 + React 19 + zustand + `lucide-react` (web).

## Delta posterior a la apertura del ciclo

Revisado con `git show --stat` de b91ca55 (FIX-e-burgos-003) y 18ad5de (spec-e-burgos-006, completed). Código leído en el estado actual de `feat/studio-session-ux`.

| Commit | Qué tocó | Efecto en este ciclo |
| ------ | -------- | -------------------- |
| 18ad5de (006) | `libs/studio-protocol`: `domain.ts` (AuthPreference, AuthAccount), `commands.ts` (`auth.status/login/logout`), `limits.ts` (`BRIDGE_FEATURES` + `auth-subscription`), `handshake.spec.ts` | Sin choque semántico. **`handshake.spec.ts` hardcodea la lista `BRIDGE_FEATURES`: al agregar `conversation-sessions` hay que actualizar ese test.** Convención vigente (fragmento 006): todo campo nuevo del protocolo entra opcional y la web detecta bridges viejos por `features`. |
| 18ad5de (006) | `apps/studio-bridge`: `auth-mode.ts`, `auth/claude-login.ts`, `main.ts` (1 línea), `router.ts` | `main.ts` conserva `new ClaudeAgentSdkEngine(undefined, () => auth.env())`: **el constructor del motor no cambia en este diseño**. `sessions/` y `engine/` no fueron tocados. |
| 18ad5de (006) | `apps/studio`: `BridgeProvider`, `Sidebar` (slot `AuthPanel`), `Timeline`, `ApiKeyField`, i18n `en.ts`/`es.ts` | `Sidebar.tsx` y los i18n son archivos compartidos: leer la versión actual antes de editar; las claves nuevas se agregan sin reordenar. |
| b91ca55 (FIX-003) | Lucide en todo `mission-control/` y `workspace/`, `GateIcon.tsx` nuevo, `gates.ts`, `package.json` (+`lucide-react`, −`@phosphor-icons/react`) | Todos los archivos de Mission Control que se reescriben ya usan Lucide: **todo componente nuevo importa de `lucide-react`**. `constitution.md` de studio todavía dice Phosphor (la consolidación la corrige el orquestador; el fragmento de FIX-003 ya lo declara). Tests `agentmap.spec`, `inspectordrawer.spec`, `agentavatar.spec` fueron editados por FIX-003: partir de su versión actual. |

## Decisiones técnicas

### D-01. Compatibilidad: campos opcionales, sin bump de `PROTOCOL_VERSION` (CA-031)

`PROTOCOL_VERSION` queda en 2. El handshake valida igualdad exacta (`client.ts` marca `protocol-mismatch`); un bump a 3 haría fallar la conexión de cualquier web o puente desplegado por separado, justo lo que CA-031 prohíbe. Los campos nuevos de `ThreadInfo` son opcionales (`.optional()`), zod por defecto ignora claves desconocidas, así que:

| Combinación | Resultado |
| ----------- | --------- |
| web nueva + puente viejo | `ThreadInfo.parse` acepta (campos ausentes). La web muestra «proveedor no informado» y «sesión no informada» (tercer estado, distinto de «Sin sesión todavía»). `Welcome.features` no incluye `conversation-sessions`. |
| web vieja + puente nuevo | zod descarta `engineSessionId`/`provider` sin error. Sin degradación. |
| ambos nuevos | El puente emite siempre ambos campos (garantizado por `toThreadInfo`). |

Se agrega la feature `conversation-sessions` a `BRIDGE_FEATURES` (convención de 006) para que la web y los e2e detecten un puente que informa sesión y proveedor, sin otro bump.

### D-02. `provider` es un id extensible, no un enum cerrado

`CE-02` exige que la web no se rompa ante un proveedor desconocido. Un `z.enum(['claude'])` haría fallar el `parse` de toda la lista de hilos en una web vieja cuando un puente futuro emita `gemini`. Se usa un string validado por regex más una lista de conocidos:

```ts
export const KNOWN_PROVIDERS = ['claude'] as const;
export type KnownProvider = (typeof KNOWN_PROVIDERS)[number];
export const DEFAULT_PROVIDER: KnownProvider = 'claude';
export const ProviderId = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);
export type ProviderId = z.infer<typeof ProviderId>;
export const isKnownProvider = (value: string): value is KnownProvider =>
  (KNOWN_PROVIDERS as readonly string[]).includes(value);
export const EngineSessionId = z.string().min(1).max(128);
export type EngineSessionId = z.infer<typeof EngineSessionId>;
```

Agregar un proveedor (CA-010) = agregar un valor a `KNOWN_PROVIDERS` + un motor; la forma de `ThreadInfo` no cambia. El puente tipa sus motores con `KnownProvider`; la web trata `ProviderId` como texto y solo conoce etiquetas para los conocidos.

### D-03. `ThreadInfo` y persistencia (`StoredThread`)

Protocolo (`domain.ts`), delta sobre `ThreadInfo`:

```ts
export const ThreadInfo = z.object({
  id: z.string().min(1),
  channelId: ChannelId,
  title: z.string(),
  agent: AgentId,
  options: ThreadOptions,
  status: SessionStatus,
  createdAt: z.string(),
  lastActivity: z.string(),
  link: ThreadLink,
  pendingCount: z.number().int().min(0).max(MAX_PENDING_PER_THREAD),
  engineSessionId: EngineSessionId.nullable().optional(),
  provider: ProviderId.optional(),
});
```

Semántica para la web: `string` = sesión real; `null` = el puente informa que aún no hay sesión; `undefined` = el puente no informa (versión vieja).

Puente (`sessions/store.ts`): los campos pasan a ser requeridos en lo almacenado y `toThreadInfo` deja de descartarlos:

```ts
export interface StoredThread extends Omit<ThreadInfo, 'pendingCount' | 'engineSessionId' | 'provider'> {
  engineSessionId: string | null;
  provider: ProviderId;
  pending: PendingMessage[];
}

export const toThreadInfo = ({ pending, ...info }: StoredThread): ThreadInfo => ({
  ...info,
  pendingCount: Math.min(pending.length, MAX_PENDING_PER_THREAD),
});
```

Migración de `threads.json` viejos (CA-007), en `ThreadStore.init()` junto a la migración de `link`:

```ts
t.engineSessionId = typeof t.engineSessionId === 'string' && t.engineSessionId.length > 0 ? t.engineSessionId : null;
t.provider = ProviderId.safeParse(t.provider).success ? t.provider : DEFAULT_PROVIDER;
```

`init()` ya llama a `persist()` al final, así que el archivo queda reescrito con `provider`. Idempotente. El id de sesión no es un secreto (no es credencial; el puente solo escucha en 127.0.0.1), por lo que exponerlo no viola la regla de aislamiento de credenciales.

### D-04. Una conversación = una sesión: garantías en el puente (RF-01)

El flujo ya crea el hilo con `engineSessionId: null` y retoma solo `thread.engineSessionId`. Tres cambios para volverlo verificable:

1. **`thread.create` siempre lleva el primer mensaje** (`hasContent` en `commands.ts`): el hilo nace y lanza su turno en la misma llamada; no existe hilo vacío en el puente. `createThread` sigue siendo el único punto de creación (Composer, feed y «Nueva conversación» pasan por `thread.create`), por lo que CA-001 y CA-005 se auditan en un solo lugar (ver D-10).
2. **Propiedad exclusiva del id (RN-02, CA-002/CA-004):** `onSessionId` rechaza un id que ya pertenece a otro hilo.

```ts
onSessionId: (id) => {
  if (thread.engineSessionId === id) return;
  if (this.sessionOwnedByAnotherThread(thread.id, id)) {
    reportError(new Error(`session ${id} already belongs to another thread`));
    return;
  }
  thread.engineSessionId = id;
  this.publishThread(thread);
},
```

```ts
private sessionOwnedByAnotherThread(threadId: string, sessionId: string): boolean {
  return this.deps.store.list().some((other) => other.id !== threadId && other.engineSessionId === sessionId);
}
```

3. **La web debe enterarse del id:** hoy `onSessionId` solo hace `persist(thread)`; se cambia a `publishThread(thread)` (que además hace `tracker.onThread` + broadcast `thread.updated`). Sin esto la web mostraría «Sin sesión todavía» hasta el próximo cambio de estado. CE-01: si el SDK falla antes de `init`, `engineSessionId` queda `null` y el turno siguiente arranca sin `resume`.

`provider` se fija en `createThread` con `this.deps.engine.provider` y es inmutable (`setOptions` no lo toca).

### D-05. Motor con proveedor (`AgentEngine`)

```ts
export interface EngineTurnInput {
  threadId: string;
  prompts: OutgoingMessage[];
  options: ThreadOptions;
  resumeSessionId: string | null;
  cwd: string;
  systemPrefix?: string;
}

export interface AgentEngine {
  readonly name: string;
  readonly provider: KnownProvider;
  startTurn(input: EngineTurnInput, callbacks: EngineCallbacks): EngineTurn;
}
```

`ClaudeAgentSdkEngine.provider = 'claude'`; `FakeEngine.provider = 'claude'` (simula Claude; mantiene los e2e). `SessionManager` sigue recibiendo un único `engine`; el punto de extensión para varios proveedores queda en el campo `provider` del hilo (un futuro `engineFor(thread.provider)` reemplaza `deps.engine`; no se implementa ahora, no hay segundo motor). `systemPrefix` es texto agnóstico del proveedor: cada motor decide cómo inyectarlo (Claude: `systemPrompt.append`; un motor Gemini usaría `systemInstruction`).

### D-06. Prefijo de sistema estable (HU-03)

**Dónde se arma:** módulo nuevo `apps/studio-bridge/src/engine/stable-prefix.ts` (lectura síncrona + composición pura). `SessionManager` lo invoca en `start()` y lo pasa en `EngineTurnInput.systemPrefix`; el motor no lee archivos. `SessionManagerDeps` suma `stablePrefix?: () => string` (default `createStablePrefixLoader(root)`), inyectable en tests.

```ts
export const STABLE_PREFIX_SOURCES = [
  'sdd/context/context_prompt.md',
  'sdd/context/constitution.md',
  'sdd/memory/lessons.md',
] as const;

export interface PrefixSection {
  source: string;
  content: string;
}

export const composeStablePrefix = (sections: PrefixSection[]): string =>
  sections
    .filter((section) => section.content.length > 0)
    .map((section) => `<project-context source="${section.source}">\n${section.content}\n</project-context>`)
    .join('\n\n');

export function createStablePrefixLoader(root: string, warn: (message: string) => void = defaultWarn): () => string {
  const warned = new Set<string>();
  return () =>
    composeStablePrefix(
      STABLE_PREFIX_SOURCES.flatMap((source) => {
        const content = readSource(root, source);
        if (content !== null) return [{ source, content }];
        if (!warned.has(source)) {
          warned.add(source);
          warn(`stable prefix: ${source} is missing or unreadable, skipped`);
        }
        return [];
      }),
    );
}
```

`readSource` lee UTF-8, normaliza `\r\n` → `\n`, aplica `trim()`, devuelve `null` si falla o supera 256 KiB. Reglas de determinismo (CA-011..CA-016): orden = el de la tupla (RN-07); la etiqueta usa la ruta relativa constante (nunca ruta absoluta, fecha, id de sesión ni título de hilo); un archivo faltante se omite y el resto sigue en orden; sin resumen ni compactación (CA-015). El aviso (CE-04) sale una vez por archivo y por proceso para no inundar cada turno.

**Cómo se inyecta (verificado en `sdk.d.ts` de `@anthropic-ai/claude-agent-sdk@0.3.292`, `Options.systemPrompt`, líneas 2304-2414):** el SDK acepta `{ type: 'preset', preset: 'claude_code', append?, excludeDynamicSections?, snapshot? }`. En `buildQueryOptions`:

```ts
if (input.systemPrefix) {
  options.systemPrompt = {
    type: 'preset',
    preset: 'claude_code',
    append: input.systemPrefix,
    excludeDynamicSections: true,
    snapshot: true,
  };
}
```

Justificación de cada flag:

- `preset: 'claude_code'` + `append`: conserva el prompt de Claude Code (herramientas, hooks, `settingSources: ['project']`, `agent`) y agrega el prefijo al final. Un `systemPrompt` string/`string[]` lo reemplazaría y rompería el enjambre.
- `excludeDynamicSections: true`: según la doc del SDK, saca cwd, ruta de memoria y git status del system prompt y los reinyecta como primer mensaje de usuario. Sin esto el system prompt contiene datos que cambian con cada commit y el prefijo no sería idéntico entre sesiones, anulando el caching. Costo documentado: ese contexto es «marginalmente menos autoritativo» y el primer mensaje es algo más grande.
- `snapshot: true`: el prompt se graba al inicio de la conversación y se reusa tal cual en cada `resume`; cambiar los archivos de contexto afecta a la sesión **siguiente** (CA-013), no a la que está en curso, y se estabiliza el prefijo de caché. Donde el SDK/cuenta no lo soporta (Bedrock/Vertex, rollout), la doc dice que se acepta sin efecto.
- Se pasa el prefijo en cada turno (también con `resume`): con `snapshot` activo se ignora y sin él la sesión conserva el prefijo en lugar de perderlo.

**Límites de esta decisión (para el implementador):** el efecto real del cache lo mide la API, no un test unitario. Los tests unitarios cubren: prefijo byte a byte idéntico entre dos cargas (CA-012), cambia si cambia cualquiera de los tres archivos (CA-013), archivo faltante (CA-014), ausencia de datos variables (CA-016) y que `buildQueryOptions` pone el prefijo en `systemPrompt.append`. Dejar en `artifacts/` una evidencia manual (spike, con credenciales): dos sesiones consecutivas con `cache_read_input_tokens > 0` en la segunda, y comprobar que con `options.agent` (hilo con agente distinto del orquestador) el `append` sigue aplicándose; si el SDK lo ignorara en ese caso, anotarlo como hallazgo (no cambia el diseño: el prefijo seguiría siendo estable para el agente por defecto).

### D-07. Derivación de specs/fixes y diálogos: en la web, función pura (HU-04)

Los eventos de un hilo solo se materializan en la web (`ThreadState.items`, vía `thread.history` + stream) y el puente no tiene un índice por conversación. Derivar en el puente exigiría un comando y un evento nuevos y estado derivado persistido: más contrato para algo que es una proyección de datos que la web ya tiene. Se elige el mínimo contrato: **cero cambios de protocolo para esto**; un módulo puro `apps/studio/src/lib/conversation.ts` sin React ni store, testeable con fixtures. Si un hilo gigante lo exigiera, un puente podría precalcular después con la misma firma.

Contrato del módulo:

```ts
export interface ConversationDialogue {
  id: string;
  seq: number;
  kind: 'user' | 'message' | 'tool' | 'approval' | 'subagent';
  from: string;
  to: string | null;
  text: string;
  tool?: string;
  gateId?: GateId;
  isLive: boolean;
}

export interface RelatedSpec {
  specId: string;
  cycle: string | null;
  source: 'event' | 'link';
  known: boolean;
}

export interface RelatedFix {
  fixId: string;
  specId: string | null;
  source: 'event' | 'link';
  known: boolean;
}

export interface ConversationParticipant {
  agentId: string;
  events: number;
}

export interface ConversationView {
  threadId: string;
  participants: ConversationParticipant[];
  dialogues: ConversationDialogue[];
  specs: RelatedSpec[];
  fixes: RelatedFix[];
  engineSessionId: string | null | undefined;
  provider: string | undefined;
  isEmpty: boolean;
}

export function listConversations(threads: Record<string, ThreadState>): ThreadInfo[];
export function resolveSelectedThreadId(picked: string | null, threads: Record<string, ThreadState>): string | null;
export function deriveConversation(thread: ThreadState, snapshot: WorkspaceSnapshot | null): ConversationView;
export function referencesInText(text: string): { specs: { specId: string; cycle: string | null }[]; fixes: string[] };
export function inferGateFromText(text?: string): GateId | undefined;
```

Reglas de derivación (RN-11, RN-12, CA-019/CA-020):

- **Fuentes escaneadas** (solo texto que nombra recursos, no cuerpos): `user.text`, `message.text`, `tool.summary` (para `Read/Write/Edit` es el `file_path`; para `Bash` el comando), `approval.summary` y `approval.input`. No se escanean `diff` ni `result`: un diff o salida que menciona otra spec relacionaría la conversación por ruido.
- **Spec:** `/sdd\/specs\/(spec-[A-Za-z0-9._-]{1,123})(?:\/cycles\/(cycle-\d{2}))?/g`, id recortado de `.`/`-` finales y validado con `SpecIdValue`. El prefijo `spec-` evita falsos positivos como `sdd/specs/index.json`.
- **Fix:** `/\bFIX-[A-Za-z0-9][A-Za-z0-9._-]{0,95}/g` y la forma de ruta `/fixes/fix-<id>.md` (se normaliza a `FIX-<id>`); recortado de signos finales y validado con `FixIdValue`.
- Deduplicación por clave en minúsculas; si existe en el snapshot (`snapshot.specs[].id`, `snapshot.fixes[].id`, comparación case-insensitive) se usa la grafía canónica y `known: true`; si no, `known: false` (CE-07: se muestra sin enlace al visor). Para fixes conocidos `specId` sale de `FixSummary.specId`.
- `thread.info.link.target` agrega la spec/fix con `source: 'link'` (el destino con que se creó), pero no es la única fuente; si también aparece en eventos queda `source: 'event'`.
- **Participantes:** `author.agent` de `message/tool/approval`, `agentType` de `subagent`, y `info.agent` solo si hay eventos (RN-11). El id se conserva tal cual (no se normaliza a `sdd-orchestrator`: el código viejo inventaba ese reemplazo).
- **Diálogos:** una entrada por item `user|message|tool|approval|subagent`, orden por `seq`, **sin timestamps** (los items no los traen; el código viejo interpolaba tiempos inventados). `to` es honesto: `user` → agente del hilo; `message`/`approval` → `'user'`; `tool` → `null`; `subagent` → `agentType`. Los textos sintéticos de presencia («Procesando tarea activa…») se eliminan; la presencia real (filtrada por `threadId`) solo colorea nodos.
- `isEmpty` = sin diálogos (CA-021). `inferGateFromText` se muda aquí desde `swarm-dialogue.ts` sin cambios (es una heurística de texto, no un dato inventado).
- `resolveSelectedThreadId`: devuelve `picked` si existe en `threads` con `info`; si no, el hilo con `lastActivity` más reciente (`Date.parse`, inválida = 0; desempate `createdAt` desc, luego `id`); `null` si no hay hilos (CA-018, CA-022). No hay spec ni conversación fija.

### D-08. Estado de Mission Control centrado en la conversación

- **Dónde vive:** un hook `useConversationSelection()` (`src/lib/use-conversation-selection.ts`, COMP-019) con `useState` local para la elección explícita (`pickedThreadId`). La conversación efectiva es `resolveSelectedThreadId(picked, threads)`: sin elección sigue a la más reciente, con elección la mantiene. No se agrega slice al store: Mission Control se desmonta al cambiar de vista y el default (más reciente) es el comportamiento pedido.
- **Qué devuelve:** `{ conversations, selectedThreadId, pick, view }` con `view = useMemo(() => deriveConversation(thread, snapshot), [thread.items, thread.info, snapshot])`. Un `useEffect` llama `openThread(client, store, id)` si el hilo elegido no está `synced`; reemplaza al bucle actual que abre los 3 hilos más recientes y al matching por spec/fix.
- **Mapa:** los 9 nodos son topología fija (posiciones y aristas), no dato. Se pasa `participating` por nodo según `view.participants`; los nodos sin participación se atenúan y no muestran halo (decisión a confirmar con el reviewer: ocultarlos dejaría aristas colgando). La presencia se filtra por `threadId === selectedThreadId`. La burbuja y la consola de comunicaciones leen `view.dialogues`; sin diálogos muestran «Sin actividad todavía» (CA-021). Sin conversaciones: estado vacío con el botón «Nueva conversación» (CA-022).
- **Inspector:** recibe `conversation: ConversationView | null` en lugar de spec/fix. Muestra proveedor y sesión reales (`ConversationSessionInfo`), la lista de specs/fixes relacionados (`RelatedDocuments`) y, por cada uno con `known: true`, los documentos de `getAgentGeneratedDocuments(agentId, { specId, cycleId, fixId })` abiertos en `DocumentViewerModal` (CA-023, CA-029). `cycleId` sale del evento o del último ciclo de esa spec en `snapshot.cycles`; sin dato no se inventa uno (el default interno de `agent-documents.ts` no se toca). Un fix repo-level (`specId: null`) queda listado sin enlace al visor en este ciclo.
- **`ConversationSessionInfo`** (CA-008, CA-027): `engineSessionId` string → id; `null` → «Sin sesión todavía»; `undefined` → «sesión no informada». `provider` conocido → etiqueta; desconocido → el valor recibido (CE-02); `undefined` → «proveedor no informado» (CE-03). Textos por i18n (`es.ts`/`en.ts`, claves `mc.*`).
- **`LiveAgentChatFeed`:** pasa a mostrar los diálogos de la conversación seleccionada filtrados por agente (se retiran `mode`, `demoDialogues` y la lectura de hilos DM sueltos). El envío rápido hace `thread.send` a la conversación seleccionada y, si no hay ninguna, `thread.create` (DM del agente) y selecciona el hilo creado (`pick(id)`).

### D-09. «Nueva conversación» (CA-003)

Como `thread.create` exige un primer mensaje (D-04.1), no existe «hilo vacío» en el puente. «Nueva conversación» es una acción de la web que **deja seleccionado un borrador vacío**: `Workspace` pasa a `view = { channelId, threadId: null }` (composer vacío, sin hilo abierto) y el hilo real nace con el primer envío por `thread.create` → `createThread` → sesión nula → sesión propia en el primer turno. Esto satisface CA-001/CA-003 en espíritu (selección inmediata, cero reutilización de sesión) sin ampliar el protocolo con un hilo sin mensaje; **la alternativa literal (relajar `hasContent` y crear hilos idle sin título) se descarta por costo y por crear hilos fantasma al abandonar el borrador. Confirmar esta lectura de CA-003 con el reviewer.**

- Componente `NewConversationButton` (COMP-018, `src/components/NewConversationButton.tsx`, icono Lucide `MessageSquarePlus`) con prop `onNewConversation`.
- Colocación: encabezado del `SidebarView` (workspace) y cinta de selector + estados vacíos de Mission Control.
- Cableado: `Workspace` acepta `newConversationSignal?: number`; un `useEffect` hace `setView((v) => ({ channelId: v.channelId, threadId: null }))` cuando cambia. `Connected` (`WorkspaceApp.tsx`) incrementa la señal y cambia a la vista `workspace` cuando se pulsa desde Mission Control. No toca el borrador existente (`draftKey = new:<channel>`).

### D-10. Auditoría de las dos entradas de creación (CA-005)

Resultado del análisis de código (el implementador lo deja documentado en `artifacts/audit-thread-creation.md` con los tests que lo prueban):

| Entrada | Comando | Resultado |
| ------- | ------- | --------- |
| `Composer.tsx` (sin `threadId`) | `thread.create` | Cumple: `createThread` fija `engineSessionId: null`. |
| `LiveAgentChatFeed.tsx` | `thread.create` (DM) cuando no hay hilo; **`thread.send` al hilo DM más reciente cuando existe** | Creación cumple. El envío a un hilo existente retoma la sesión de **ese mismo hilo** (válido por RN-02), pero el feed no ofrecía crear una conversación nueva. Corregido en D-08: el feed envía a la conversación seleccionada y «Nueva conversación» es la vía explícita para abrir otra. |

Test de contrato (puente, `session-manager.spec.ts`, con `FakeEngine`): crear dos hilos por `createThread` → tras el primer turno sus `engineSessionId` son distintos entre sí; un turno posterior del hilo A pasa `resumeSessionId` de A, nunca el de B; un `onSessionId` con el id de B sobre A es rechazado.

### D-11. Eliminación de lo ficticio (HU-05) — qué se borra y qué se reescribe

| Archivo (apps/studio/src) | Acción |
| ------------------------- | ------ |
| `components/mission-control/swarm-dialogue.ts` | **Se borra.** Desaparecen `SPEC_00X_SCRIPT`, `FIX_*_SCRIPT`, `SWARM_SCRIPTS_BY_SPEC`, `SDD_SWARM_SCRIPT`, `extractRuntimeDialogues`, `detectHarnessProvider`, `HarnessProvider`. `inferGateFromText` se muda a `lib/conversation.ts`. |
| `components/mission-control/AgentMapCanvas.tsx` | Se reescribe el estado: fuera `selectedSpecId` (default fijo `spec-e-burgos-004-…`), `selectedFixId`, `mode` demo/live y su toggle, el efecto de matching por spec/fix y el bucle de «top 3 hilos». Entra `useConversationSelection`. Se conservan zoom/pan, gates, drawers. |
| `components/mission-control/AgentInspectorDrawer.tsx` | Se reescribe: fuera `specsList`/`fixesList` de respaldo (specs/fixes inventados), selectores y `fixFilter`, `specScope`, `currentSessionId` (`session-*`, `session-live-default`), textos «Google Gemini»/«GitHub Copilot». Entran `ConversationSessionInfo` y `RelatedDocuments`. |
| `components/mission-control/LiveAgentChatFeed.tsx` | Se reescribe según D-08. |
| `components/mission-control/LiveSwarmComms.tsx`, `ChatDialogueCard.tsx` | Tipos pasan a `ConversationDialogue`; se retira el toggle demo y `HarnessProvider`; la etiqueta de proveedor sale del valor real (`provider.toUpperCase()` para desconocidos; sin proveedor, sin badge). |
| `components/mission-control/LiveTelemetryHUD.tsx` | **Se elimina `INITIAL_TELEMETRY`** (6.6M tokens, filas Gemini, consumo por agente inventado). El estado pasa a `TelemetryData \| null`; si `grandTokens === 0` o no hay ciclos, estado vacío «Sin telemetría todavía». `formatModelName` deja de hardcodear «Claude 3.5 Sonnet»/«Gemini»: nombre = id real del modelo y proveedor = prefijo de `provider_model` (`claude/…`). `DEFAULT_RATES` (tabla de precios) se conserva. |
| `lib/agent-documents.ts`, `DocumentViewerModal.tsx` | **Se conservan** (RN-14, CA-029); solo cambia quién les pasa el contexto. |
| `components/WorkspaceApp.tsx`, `components/workspace/Workspace.tsx`, `Sidebar.tsx` | Cableado de «Nueva conversación» (D-09). |

Tests: se eliminan los que exigían guiones/ids/proveedores ficticios (`inspectordrawer.spec.tsx`: «Google Gemini», «GitHub Copilot», `session-*`; `telemetry.spec.tsx`: cifras de relleno; casos de modo demo en `agentmap.spec.tsx`) y se reescriben para exigir datos reales o estado vacío (CA-028). CA-009/CA-024/CA-026 se verifican con un test de búsqueda sobre el código fuente de `apps/studio/src` (patrones `session-` fuera de `*.spec.*`, `SWARM_SCRIPTS_BY_SPEC`, `6611605`, `Gemini Flash`).

## Cambios en schema (sdd/schema.json)

Sin cambios: no hay tablas. El único estado persistente afectado es `.sdd-studio/threads.json` (ignorado por git), migrado en caliente (D-03).

## Contratos de API (sdd/api.json)

Sin cambios: no hay endpoints REST. El contrato del ciclo es el delta del protocolo WS descrito en D-01/D-02/D-03/D-05; los comandos (`thread.create`, `thread.send`, `thread.list`) no cambian su forma, solo la respuesta y el evento `thread.updated` suman los campos opcionales.

## Componentes (sdd/components.json, app-key `apps/studio`)

Registrados como `defined` (COMP-016..020): `ConversationSelector` (cinta de selección + «Nueva conversación», `src/components/mission-control/ConversationSelector.tsx`), `ConversationSessionInfo` (`.../ConversationSessionInfo.tsx`), `RelatedDocuments` (`.../RelatedDocuments.tsx`), `NewConversationButton` (`src/components/NewConversationButton.tsx`), `useConversationSelection` (`src/lib/use-conversation-selection.ts`). Los componentes de Mission Control retirados/reescritos no estaban registrados en `components.json` (ver brief: ninguno de mission-control), por lo que no hay entradas que deprecar; `swarm-dialogue.ts` es un módulo, no un componente.

## Dependencias externas

- Ninguna dependencia nueva. `@anthropic-ai/claude-agent-sdk` sigue pinneado en 0.3.292; los flags `excludeDynamicSections` y `snapshot` ya existen en esa versión.
- `lucide-react` (FIX-003) para iconos nuevos.

## Riesgos y verificaciones pendientes

1. **Efecto real del cache** (D-06): solo medible con credenciales; spike manual a `artifacts/` (no bloquea CA).
2. **`options.agent` + `systemPrompt`:** el SDK no documenta la interacción; verificarla en el spike. Si el `append` se ignorara con `agent`, el prefijo igual vale para el agente por defecto.
3. **Ocultar vs atenuar nodos** (D-08) y **lectura de CA-003** (D-09): confirmar en la revisión.
4. **Historias largas:** `deriveConversation` es O(items); se memoiza por `thread.items`. Sin límites nuevos.
5. **`constitution.md` de studio dice Phosphor** (desactualizado desde FIX-003): lo corrige la consolidación del orquestador, no este ciclo.

## Trazabilidad CA → decisión

| CA | Decisión / prueba principal |
| -- | --------------------------- |
| 001-005 | D-04, D-09, D-10 (test de `session-manager`, `store`, auditoría) |
| 006-010 | D-01, D-02, D-03 (`domain.spec`, `store.spec` invertido, migración) |
| 011-016 | D-06 (`stable-prefix.spec`, `claude-sdk-engine.spec`) |
| 017-023 | D-07, D-08 (`conversation.spec` con dos conversaciones; `agentmap.spec`) |
| 024-029 | D-11 (test de búsqueda en fuente, `inspectordrawer.spec`, `telemetry.spec`) |
| 030-031 | D-01 (`handshake.spec`, parse de payload legado, `pnpm test`/`typecheck` ×3) |

## Archivos a tocar por subproyecto (orden: protocolo → puente → web)

### 1. `libs/studio-protocol`

- `src/domain.ts` — `KNOWN_PROVIDERS`, `KnownProvider`, `DEFAULT_PROVIDER`, `ProviderId`, `isKnownProvider`, `EngineSessionId`; campos opcionales en `ThreadInfo`.
- `src/limits.ts` — `'conversation-sessions'` al final de `BRIDGE_FEATURES`.
- `src/domain.spec.ts` — `ThreadInfo` acepta forma legada sin campos, con `engineSessionId: null`, con id y con `provider: 'gemini'` (extensible); rechaza `provider` inválido.
- `src/handshake.spec.ts` — lista de `BRIDGE_FEATURES` actualizada.
- `src/version.ts` — **sin cambios** (`PROTOCOL_VERSION = 2`).

### 2. `apps/studio-bridge`

- `src/engine/types.ts` — `EngineTurnInput.systemPrefix?`, `AgentEngine.provider`.
- `src/engine/stable-prefix.ts` + `stable-prefix.spec.ts` — nuevos (D-06).
- `src/engine/claude-sdk-engine.ts` + `claude-sdk-engine.spec.ts` — `provider = 'claude'`, `systemPrompt` en `buildQueryOptions`.
- `src/engine/fake-engine.ts` + `fake-engine.spec.ts` — `provider = 'claude'`.
- `src/sessions/store.ts` + `store.spec.ts` — tipo `StoredThread`, `toThreadInfo` sin descarte, migración en `init()`; el test «hides … the engine session» se invierte (CA-006) y se agrega el caso de `threads.json` viejo (CA-007).
- `src/sessions/session-manager.ts` + `session-manager.spec.ts` — `provider` en `createThread`, `systemPrefix` en `start()`, dep `stablePrefix?`, guard de propiedad y `publishThread` en `onSessionId` (D-04).
- `src/main.ts`, `src/server/router.ts` — sin cambios (features se derivan de `BRIDGE_FEATURES`).

### 3. `apps/studio`

- `src/lib/conversation.ts` + `conversation.spec.ts` — nuevos (D-07).
- `src/lib/use-conversation-selection.ts` — nuevo.
- `src/lib/i18n/es.ts`, `en.ts` — claves `mc.newConversation`, `mc.noActivity`, `mc.noConversations`, `mc.noSession`, `mc.sessionUnknown`, `mc.providerUnknown`, `mc.noTelemetry`, `mc.related.*`.
- `src/components/NewConversationButton.tsx` — nuevo.
- `src/components/mission-control/ConversationSelector.tsx`, `ConversationSessionInfo.tsx`, `RelatedDocuments.tsx` — nuevos, con specs.
- `src/components/mission-control/AgentMapCanvas.tsx`, `AgentInspectorDrawer.tsx`, `LiveAgentChatFeed.tsx`, `LiveSwarmComms.tsx`, `ChatDialogueCard.tsx`, `LiveTelemetryHUD.tsx` — reescritura/limpieza (D-11) y sus specs: `agentmap.spec.tsx`, `inspectordrawer.spec.tsx`, `chatdialoguecard.spec.tsx`, `telemetry.spec.tsx`.
- `src/components/mission-control/swarm-dialogue.ts` — **borrar**.
- `src/components/WorkspaceApp.tsx`, `src/components/workspace/Workspace.tsx`, `src/components/workspace/Sidebar.tsx` — cableado de «Nueva conversación» (+ `workspace.spec.tsx`/`sidebar.spec.tsx` si asertan el encabezado).
- `src/components/workspace/Composer.tsx` — sin cambios de código (auditado, D-10); su test existente prueba `thread.create`.
- `lib/agent-documents.ts`, `DocumentViewerModal.tsx` — sin cambios.

### Cierre (no es implementación)

Fragmentos aditivos `updates/2026-…-spec-e-burgos-005-studio-conversation-sessions-cycle-01.md` en los tres subproyectos, fila de cada uno en `sdd/context/constitution.md`, entradas COMP-016..020 a `implemented` y evidencia de la auditoría D-10 en `artifacts/`.
