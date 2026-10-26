# Architect — Cycle 1: studio-session-metadata

> **Input:** sdd/specs/spec-e-burgos-007-studio-session-metadata/cycles/cycle-01/functional.md
> **Output:** sdd/specs/spec-e-burgos-007-studio-session-metadata/cycles/cycle-01/architect.md
> **Generado por:** sdd-architect (claude/sonnet, effort high; sustituye a opus por falta de cupo hasta 2026-11-01, autorizado por el dev)

---

## Alcance del diseño

Sin base de datos ni endpoints REST: el contrato es el protocolo WebSocket de `libs/studio-protocol` (zod) y el estado local `.sdd-studio/threads.json` + `threads/<id>.jsonl` del puente. Igual que en spec-005, **no se escribe en `sdd/schema.json` ni en `sdd/api.json`** (modelan tablas y endpoints HTTP; ambos están vacíos para este repo). Sí se registran componentes web en `sdd/components.json` (app-key `apps/studio`): COMP-021 y COMP-022 nuevos, COMP-005/017/018 actualizados. Stack respetado: TypeScript estricto + zod 4 (protocolo), Node ESM + `@anthropic-ai/claude-agent-sdk@0.3.292` pinneado (puente), Next 16 + React 19 + zustand + `lucide-react` (web). Código sin comentarios.

Código leído en el estado actual de `feat/studio-session-ux`; los FIX-e-burgos-005-001..011 ya están en el árbol (los archivos de la web a editar deben leerse en su versión actual).

## Hallazgos del código que condicionan el diseño

| # | Hallazgo | Consecuencia |
| - | -------- | ------------ |
| H-1 | `decodeServerMessage` falla si un `thread.event` trae un `type` desconocido; `BridgeClient.handle` descarta en silencio el frame (`if (!decoded.ok) return`). | Un evento nuevo en vivo es inocuo para una web vieja. |
| H-2 | `bootstrap.ts` hace `z.array(z.object({ seq, event: ThreadEvent })).parse(...)` sobre el resultado de `thread.history`. Un solo `document.touched` en el historial **lanza** en una web vieja y el hilo queda sin sincronizar. | El historial es el único punto de ruptura real de CA-023: hay que filtrar `document.touched` del historial para webs viejas (D-03). |
| H-3 | `ThreadEvent` ya viaja en `thread.event { threadId, seq, event }`; el `seq` es monótono por hilo, se asigna en `ThreadStore.append` y `applyThreadEvent` descarta `seq <= lastSeq`. | `document.touched` **no necesita `seq` propio** (el brief lo listaba): el del sobre cubre orden, replay y CE-13. |
| H-4 | `ClientCommand` es `z.discriminatedUnion('cmd')`. Un comando desconocido para un puente viejo responde `result` con `id: 'unknown'`; el `request` de la web nunca se resuelve y vence a los 15 s. | Todo comando nuevo se usa solo si `client.supports(feature)`; si no, la web degrada a los comandos viejos (D-04). |
| H-5 | Todos los `z.object` del protocolo son no estrictos (ignoran claves desconocidas). `Hello` y `ThreadLink` incluidos. | Campos opcionales nuevos no rompen webs ni puentes viejos. Un campo con valor malformado sí hace fallar el frame completo: los campos nuevos de `ThreadInfo` llevan `.catch` (CE-14). |
| H-6 | `SDKSessionInfo.summary` documenta «custom title, auto-generated summary, or first prompt»; en la implementación real `summary = customTitle(aiTitle incluido) \|\| lastPrompt \|\| summaryHint \|\| firstPrompt`. `getSessionInfo` es **async**, lee solo el archivo de esa sesión y devuelve `undefined` si no existe, es sidechain o no tiene resumen. | `summary` puede ser el primer o el último prompt: RN-03 exige filtrarlo (D-01). |
| H-7 | El SDK expone hooks `PreToolUse`, `PostToolUse`, `PostToolUseFailure` (con `tool_use_id`, `agent_id`, `is_interrupt`) y `FileChanged`. Hoy el motor registra `PreToolUse`, `PostToolBatch`, `SubagentStart/Stop`. | Los límites de ejecución de cada tool ya son observables sin envolver comandos (D-05). |
| H-8 | `StoredThread.link` guarda `{ target, source }`; `setLink` lo reemplaza entero. `init()` hace `JSON.parse` y, si falla, parte de `[]` y `persist()` sobrescribe el archivo. | CE-05 hoy se viola (un `threads.json` corrupto se pierde entero): se corrige en la migración (D-07). |
| H-9 | `ThreadLinkTarget` solo tiene `cycle`, `fix`, `none`; no existe una asociación a spec sin ciclo, que US-2 sí nombra. | Un tipo nuevo `ThreadLinkEntry` con `spec`; `link.target` conserva su unión vieja (una web vieja fallaría al parsear un `kind` desconocido). |

## Decisiones técnicas

### D-01. `sessionTitle` (US-1, RF-01)

**Contrato** (`domain.ts`): `ThreadInfo.sessionTitle: z.string().max(300).nullable().optional().catch(null)`. Opcional: `undefined` = puente viejo (la web ya usa este patrón con `engineSessionId`/`provider` para el aviso «bridge desactualizado»); `null` = puente nuevo sin título (muestra «sin título disponible», CA-003); string = título. El puente nuevo emite **siempre** el campo (`toThreadInfo` lo normaliza a `null`).

**Lectura** (puente). `AgentEngine` gana un método opcional `readSessionTitle?(sessionId: string, cwd: string): Promise<string | null>` (la web y `SessionManager` siguen sin ver tipos del SDK). `ClaudeAgentSdkEngine` lo implementa con `getSessionInfo(sessionId, { dir: cwd })`; el 4.º parámetro del constructor `sessionInfoFn = getSessionInfo` lo hace inyectable (`main.ts` no cambia: los demás parámetros son posicionales y ya existen).

```ts
export const SESSION_TITLE_MAX = 300;

export function pickSessionTitle(info: Pick<SDKSessionInfo, 'customTitle' | 'summary' | 'firstPrompt'> | undefined): string | null {
  const custom = cleanTitle(info?.customTitle);
  if (custom) return custom;
  const summary = cleanTitle(info?.summary);
  const first = cleanTitle(info?.firstPrompt);
  return summary && summary !== first ? summary : null;
}
```

`cleanTitle` colapsa espacios, hace `trim`, trata vacío como ausente (RN-04) y recorta a `SESSION_TITLE_MAX` con `…`. Regla: `customTitle`, si no `summary`, **salvo que `summary` coincida con `firstPrompt`** (RN-03: nunca el primer mensaje).

**Cuándo** (`SessionManager`):

1. En `onSessionId` (tras `system/init`): el archivo de sesión suele no existir todavía → resultado `undefined` → `null`, sin error (CE-01).
2. En cada `turn.end` emitido por el motor (cubre `/rename` y el resumen automático, que aparecen después del primer turno). No en `finish()`: una query con mensajes encolados puede durar muchos `result`.
3. Backfill al arrancar el puente: para hilos con `engineSessionId` y `sessionTitle` ausente, una pasada secuencial con tope de 20 hilos, después de `recover()`.

**Costo y robustez.** Una lectura de un archivo por turno; fire-and-forget con `Promise.race` contra 3 s (CE-02), un solo vuelo por hilo (`Live.titleInFlight`), errores a `reportError`, último valor conocido intacto si falla. Se publica (`publishThread` → `thread.updated`) solo si el valor cambió (RN-02, CA-004). Persistido en `StoredThread.sessionTitle` (migración: ausente → `null`).

**Riesgo R-2.** Si `summary` resultara ser con frecuencia el último prompt (H-6), el criterio degrada a «solo `customTitle`» cambiando una línea de `pickSessionTitle`. La task de implementación incluye un spike de 10 min con una sesión real (`artifacts/spike-session-info.md`) que mide `customTitle/summary/firstPrompt` y fija el criterio definitivo antes de cerrar el test.

**Alternativas descartadas.** Leer el `.jsonl` de la sesión a mano (acopla al formato interno del SDK); `listSessions` (lee todas las sesiones del proyecto); consultar en cada `thread.list` (costo por pedido en lugar de por turno).

### D-02. `link.targets[]` (US-2, RF-02, RF-03)

**Forma** (`domain.ts`):

```ts
export const LinkOrigin = z.enum(['detected', 'manual']);
const SpecRef = z.object({ kind: z.literal('spec'), specId: SpecIdValue });
const CycleRef = z.object({ kind: z.literal('cycle'), specId: SpecIdValue, cycle: CycleIdValue });
const FixRef = z.object({ kind: z.literal('fix'), fixId: FixIdValue });
export const ThreadLinkRef = z.discriminatedUnion('kind', [SpecRef, CycleRef, FixRef]);
export const ThreadLinkEntry = z.discriminatedUnion('kind', [
  SpecRef.extend({ origin: LinkOrigin }),
  CycleRef.extend({ origin: LinkOrigin }),
  FixRef.extend({ origin: LinkOrigin }),
]);
export const MAX_LINK_TARGETS = 32;

export const ThreadLink = z.object({
  target: ThreadLinkTarget,
  source: z.enum(['auto', 'manual', 'legacy']),
  targets: z.array(ThreadLinkEntry).max(MAX_LINK_TARGETS).optional().catch(undefined),
});
```

Se reutiliza la forma vigente de `ThreadLinkTarget` (`specId`+`cycle`, `fixId`) en lugar del `{kind, id, cycle?}` del boceto del brief: es la que ya parsean el puente, la web y los tests, y evita un segundo vocabulario de ids. El campo del brief se llama `origin` y no `source` para no chocar con `link.source` (que sigue siendo el origen de la asociación **única** legacy).

**Coexistencia y fuente de verdad.** `targets` es la fuente de verdad cuando existe (RN-12); `link.target`/`link.source` se **derivan** siempre en el puente (nunca los escribe otro): `target` = último elemento **activo** que no sea `spec` (una web vieja no entiende `spec`), `none` si no hay; `source` = `manual` si ese elemento es manual, `auto` si es detectado, sin cambio si `target` queda en `none`. El orden del arreglo es el de alta (un alta manual sobre una existente la mueve al final y la vuelve la «más reciente»), así no hacen falta timestamps.

**Descartadas (`dismissed`).** El brief proponía `dismissed?` en el contrato. Se decide que las descartadas **son estado interno del puente** y no viajan: `ThreadInfo.link.targets` contiene solo asociaciones activas (más corto en cada `thread.updated`, y la web no necesita saber qué no mostrar). En disco, `StoredThread.link.targets` es `Array<ThreadLinkEntry & { dismissed?: true }>`; `toThreadInfo` filtra las `dismissed`.

**Reglas puras** (`sessions/thread-link.ts`, sin I/O):

| Operación | Efecto |
| --------- | ------ |
| `addManual(entries, ref)` | Quita cualquier entrada (activa o descartada) igual a `ref` y agrega `{...ref, origin: 'manual'}` al final (RN-08, RN-10). |
| `removeRef(entries, ref)` | Si existe activa: pasa a `{...ref, origin: 'detected', dismissed: true}` (descarte persistente, RN-09, también para manuales). Si ya está descartada o no existe: sin cambios, sin error (CE-06). |
| `detectRef(entries, ref, snapshot)` | No hace nada si existe una entrada igual, activa **o descartada**; no hace nada si es `spec` y ya hay un ciclo/fix de esa spec activo (RN-11); si es `cycle`/`fix`, descarta una `spec` **detectada** de la misma spec (colapso, RN-11); agrega `{...ref, origin: 'detected'}` (RN-07). Respeta `MAX_LINK_TARGETS`: al tope la detección se omite, las manuales nunca. |
| `legacyTargetOf(entries)` | Deriva `link.target` y `link.source` como arriba. |
| `linkTargetExists(snapshot, target)` | Se extiende a `ThreadLinkRef` (`spec` → existe en `snapshot.specs`). |

Tope persistido: 64 entradas incluidas las descartadas (se purgan las descartadas más antiguas primero).

**Quién detecta y cómo persiste: el puente**, no la web. Es la única parte que sobrevive a reinicios, la que ve los cambios con ruta exacta y la que sirve a todas las pestañas (CE-07). La detección se dispara por (a) creación del hilo (`assignLink` auto → entrada `detected`), y (b) cada `document.touched` emitido: `detectRefs(snapshot, path)` mapea `sdd/specs/<specId>/…` → `spec`, `…/cycles/cycle-XX/…` → `cycle`, `…/fixes/fix-*.md` y `sdd/fixes/fix-*.md` → `fix`, y **solo se acepta lo que `linkTargetExists` confirma** (nunca ids fantasma). Las menciones textuales siguen siendo solo de la web (no se persisten). Si el snapshot aún no conoce la spec recién creada (debounce del watcher), la ruta se guarda en `Live.unresolvedPaths` y se reintenta una vez en el siguiente `turn.end` tras `refreshSnapshot()`.

**Comandos** (`commands.ts`), feature `link-targets`:

```ts
z.object({
  ...cmd('thread.updateLinks'),
  threadId: Id,
  add: z.array(ThreadLinkRef).max(8).default([]),
  remove: z.array(ThreadLinkRef).max(8).default([]),
})
```

Resultado: `ThreadInfo`. Aplica `remove` y luego `add`, atómico: si algún `add` no existe → `SessionError('not-found')` y la lista no cambia (CE-04). Idempotente (CE-06). Cada cambio hace `publishThread` → `thread.updated` a todas las pestañas con el mismo estado persistido (CE-07). `thread.create.link` y `thread.setLink` se conservan sin cambio de forma.

**Web vieja con puente nuevo (CA-025).** `thread.setLink` pasa a ser semántica de compatibilidad sobre `targets`: `cycle`/`fix` → `addManual` (queda como `link.target`, **las demás no se tocan**); `none` → `removeRef` de la asociación que hoy es `link.target` (las demás permanecen y la siguiente más reciente pasa a ser `link.target`). La web vieja ve siempre una sola asociación coherente y nunca destruye las otras.

**Web nueva con puente viejo (CA-022).** `info.link.targets` ausente → la web deriva `[{...link.target, origin: source === 'manual' ? 'manual' : 'detected'}]` si `target.kind !== 'none'` (función pura `linkEntriesOf(info)` en `lib/link-targets.ts`); sin `link-targets` en `Welcome.features` usa `thread.setLink`.

**Migración de `threads.json` (RF-03).** En `ThreadStore.init()`, por hilo y en memoria, antes del `persist()` que ya existe: si `link.targets` no es un arreglo → `[]` si `target.kind === 'none'`, o `[{...target, origin: source === 'manual' ? 'manual' : 'detected'}]`; si lo es, se filtran las entradas que no pasan `ThreadLinkEntry` ni la forma de descartada (CE-05 por entrada). `sessionTitle` ausente → `null`. Idempotente (RN-16), ningún campo previo se pierde (RN-17); un target que apunta a algo inexistente se migra igual (CE-08) y la web lo muestra «no disponible» (CA-011).

**Archivo corrupto (CE-05, corrige H-8).** Si `JSON.parse(threads.json)` falla o el valor no es un arreglo, el archivo se **renombra a `threads.json.corrupt-<epoch>`** antes de seguir y se informa por `onError`/consola; hoy se sobrescribía con `[]`. Cada hilo del arreglo con `id` string no vacío se conserva aunque otros fallen.

**Nav tree y vistas relacionadas (CA-006).** `buildNavTree` empuja el hilo bajo **cada** entrada activa: `cycle` → nodo del ciclo, `fix` → nodo del fix, `spec` → nodo «Sin ciclo» de la spec; solo sin entradas cae a la ubicación por canal de hoy. `ThreadLinkPicker` pasa a lista de chips con origen (detectada/manual), estado «no disponible» (CA-011) y quitar, más un selector para agregar (spec, ciclo o fix aún no asociados).

### D-03. Compatibilidad de versiones: sin bump de `PROTOCOL_VERSION` (CA-005, RF-07)

`PROTOCOL_VERSION` queda en **2**. El handshake exige igualdad exacta; un bump a 3 dejaría a cualquier par desplegado por separado en `protocol-mismatch` (RN-36 lo permitiría con mensaje no silencioso, pero CA-022/CA-023 piden que el par mixto **funcione**). Todo lo nuevo es opcional o aditivo:

| Elemento | Web vieja + puente nuevo | Web nueva + puente viejo |
| -------- | ------------------------ | ------------------------ |
| `ThreadInfo.sessionTitle`, `link.targets` | Se ignoran (H-5). | Ausentes: la web degrada con aviso (CA-022/024). |
| Evento `document.touched` en vivo | Frame descartado en silencio (H-1). | No llega; heurística actual. |
| `document.touched` en `thread.history` | **Filtrado** por el puente: la web vieja no manda `includeDocumentTouched` (default `false`), así que `History.parse` no lanza (H-2). | `includeDocumentTouched` es una clave desconocida para el puente viejo y se ignora (H-5). |
| `thread.updateLinks` | Nunca lo envía. | Se usa solo si `client.supports('link-targets')`; si no, `thread.setLink` (H-4). |
| `tool.start.summaryTruncated` | Se ignora. | Ausente: la web infiere recorte por el `…` final. |

`thread.history` gana `includeDocumentTouched: z.boolean().default(false)`. La web nueva lo envía siempre en `true`. Se evaluó filtrar también el broadcast en vivo por capacidades de cada conexión (`Hello.features`): se descartó porque exige estado por conexión en `ws-server.ts` y `router.ts` para evitar un frame que la web vieja ya ignora sin error (H-1).

**`BRIDGE_FEATURES`** (`limits.ts`) agrega, al final y en este orden: `'session-title'`, `'link-targets'`, `'document-touched'` (11 de 32 posibles; cada una ≤ 40 caracteres). `handshake.spec.ts` hardcodea la lista: actualizarla.

**Campos tolerantes (CE-14).** `sessionTitle` lleva `.catch(null)` y `link.targets` `.catch(undefined)`: un valor malformado de un puente futuro degrada ese campo y no tira el frame `thread.updated` completo.

### D-04. `document.touched` (US-3, RF-04)

**Contrato** (`events.ts`), miembro nuevo de `ThreadEvent`:

```ts
z.object({
  type: z.literal('document.touched'),
  path: z.string().min(1).max(1024),
  op: z.enum(['created', 'modified', 'deleted']),
  author: Author,
})
```

`path`: relativo a la raíz del workspace, separador `/` (también en Windows: CI corre ubuntu+windows), sin `./`; una ruta fuera de la raíz (solo posible con Write/Edit, RN-22) viaja absoluta. `op`: `created|modified|deleted` (confirmado). `author`: igual que `tool.start` (`agent` + `parentToolUseId`). Sin `seq` propio (H-3).

**Persistencia y replay.** Se emite con `SessionManager.emit`, así que pasa por `ThreadStore.append` (línea del `threads/<id>.jsonl`), se difunde como `thread.event` y vuelve en `thread.history`. No hay almacenamiento aparte. Duplicados tras reconexión o historial recortado: `applyThreadEvent` ya ignora `seq <= lastSeq` (CE-13).

**Puntos de enganche en el motor** (nuevos, opcionales en `EngineCallbacks` para no obligar a `FakeEngine`):

```ts
interface ToolRunContext {
  toolName: string;
  input: Record<string, unknown>;
  toolUseId: string;
  author: Author;
}
beforeTool?(ctx: ToolRunContext): Promise<void>;
afterTool?(ctx: ToolRunContext, outcome: 'ok' | 'failed' | 'interrupted'): Promise<void>;
rebaseTool?(toolUseId: string): void;
cancelTool?(toolUseId: string): void;
```

`buildQueryOptions` agrega a `PreToolUse` (después del veredicto del gate, solo si es `allow`/`warn`) un `await h.beforeTool(...)` para `Bash`, `Write`, `Edit`, `MultiEdit`, `NotebookEdit`, y registra `PostToolUse` (`ok`) y `PostToolUseFailure` (`failed`, o `interrupted` si `is_interrupt`) que llaman `h.afterTool`. En `canUseTool`: tras un `allow` se llama `cb.rebaseTool(toolUseId)` (re-toma la instantánea: la espera de aprobación no cuenta como ejecución, RN-23) y tras un `deny` `cb.cancelTool(toolUseId)` (cierra la ventana sin registros).

**Write/Edit/MultiEdit/NotebookEdit — exacto, sin diff de archivos.** `beforeTool` guarda `existedBefore` (un `existsSync` por Write). `afterTool(ok)` emite un `document.touched` con la ruta de `file_path`/`notebook_path` normalizada: `Write` → `created` si no existía, si no `modified`; `Edit`/`MultiEdit`/`NotebookEdit` → `modified`. Falla del tool → no se emite (el archivo no cambió o no hay certeza). Se emite aunque la ruta esté fuera de `sdd/` (RN-22) y se anota en un anillo `recentExactTouches` (últimos 200, con timestamp) para no atribuirlo a un Bash concurrente.

### D-05. Detección de cambios por Bash (RN-18, RN-23, RN-24, CE-09..CE-11)

**Mecanismo elegido: instantánea de `sdd/` antes y después de cada tool `Bash`, comparada por metadatos** (`DocumentChangeTracker`, módulo nuevo `sessions/document-tracker.ts`).

| Alternativa | Veredicto |
| ----------- | --------- |
| Watcher (`chokidar`, `fs.watch`) correlacionado por ventana temporal | Descartada: dos agentes en ventanas solapadas hacen inatribuible el evento, y los eventos llegan con retraso y deduplicados por el debounce del watcher existente (200 ms) — se cerraría la ventana antes de verlos. |
| Hook `FileChanged` del SDK | Descartada: solo observa rutas que el host declara (`watchPaths`), no trae `tool_use_id` ni `agent_id`. |
| `git status --porcelain sdd/` antes/después | Descartada: no ve archivos ignorados, un archivo ya modificado que se vuelve a modificar no cambia de estado, lanza un proceso por tool y exige repo git. |
| Envolver el comando en `updatedInput` | Descartada: altera el comando que el dev aprobó. |
| **Instantánea de metadatos antes/después** | **Elegida**: sin dependencias, determinista, atribución por tool exacta, funciona en Windows. |

**Instantánea.** Recorrido de `<root>/sdd/` (sin seguir symlinks, salto de `node_modules` y directorios que empiezan con `.`) con `lstat(..., { bigint: true })`; clave por archivo: `mtimeNs:size` (+ `ino` cuando es distinto de 0; Windows no lo informa). Resultado `Map<rutaRelativa, firma>` o `null` si se excede el presupuesto.

- **Presupuesto (CE-10):** `SNAPSHOT_MAX_ENTRIES = 20_000` y `SNAPSHOT_BUDGET_MS = 250`. Si cualquiera de las dos instantáneas lo excede, se omite la detección de ese tool (el comando sigue su curso), se registra una vez por hilo con `reportError` y no se inventa ningún documento (CE-09). Costo esperado en este repo (~250 archivos en `sdd/`): decenas de milisegundos por Bash, dos veces; se añade a la latencia del `PreToolUse` del Bash.
- **Diferencia:** ruta nueva → `created`; ausente → `deleted`; firma distinta → `modified`. Solo archivos. Límite conocido: un `touch` sin cambio de contenido cuenta como `modified` (no se hashea el contenido anterior). Un comando que no toca `sdd/` no produce nada (CA-016).
- **Tope por tool:** `MAX_TOUCHED_PER_TOOL = 50` eventos ordenados por ruta; el resto se registra en consola.

**Ventana y atribución.** Registro global del puente `open: Map<toolUseId, Window { threadId, channelId, author, overlaps: Set<string> }>`. Al abrir una ventana, ella y todas las abiertas se marcan como solapadas entre sí. Al cerrarla (`afterTool`):

| Situación | Autor |
| --------- | ----- |
| Sin solapamientos | El del tool (`mapper.authorForAgentId(hookInput.agent_id)`): certero. |
| Solo solapamientos del mismo hilo (subagentes en paralelo) | `{ agent: thread.agent, parentToolUseId: null }`: atribución al hilo sin autor específico (RN-24). |
| Solapamiento con ventanas de **otro hilo** | Un archivo se atribuye solo si la ruta cae bajo `sdd/specs/<specId>/` del canal `spec:<specId>` de **exactamente una** de las ventanas involucradas; si no, se omite y se registra. Nunca a un agente al azar. |

Además se excluyen del Δ las rutas presentes en `recentExactTouches` dentro de la ventana (las reportó Write/Edit). Los cambios que ocurren mientras no hay ninguna ventana abierta no se atribuyen a nadie (RN-23). Como `SessionManager.blocked()` ya serializa los turnos con escritura dentro de un mismo scope, el caso de otro hilo solo aparece entre canales distintos.

**Cierres anómalos (CE-11).** `afterTool` con `failed`/`interrupted` igual calcula y registra lo cambiado hasta ahí. Si un turno termina (`finish`) con ventanas abiertas (tool que nunca emitió `PostToolUse`), `closeThreadWindows(threadId)` hace el diff final y las cierra. Un Bash en segundo plano (`run_in_background`) solo se observa mientras dura su tool; lo que escriba después queda fuera (límite documentado).

### D-06. Resumen de comandos Bash (RF-05, CA-021)

`tool-summary.ts` agrega `summarizeToolDetailed(name, input): { summary: string; truncated: boolean }`; `summarizeTool` queda como envoltorio que devuelve `.summary` (los llamadores actuales no cambian). Solo `Bash` sube el límite: `BASH_SUMMARY_MAX = 600` (antes 160; `Glob`/`Grep`/`Agent` siguen en 160). 600 caracteres ≈ 2,4 KB UTF-8 máximo: lejos de `FRAME_BUDGET_BYTES` (1 MiB − 8 KiB) y de `INPUT_CAP` (16 384). Criterio (`summarizeBash`):

1. Comando ≤ 600 con el prefijo `$ ` → íntegro, `truncated: false`.
2. Si no: cabeza de hasta ~360 caracteres cortada en el último espacio (no parte tokens), luego ` … ` y las rutas `sdd/…`/`/…/sdd/…` referenciadas en el resto del comando que no estén ya en la cabeza, cada una **completa** y deduplicada, mientras entren en el límite; `truncated: true`. Si ninguna ruta entra, termina en `…` (marcador que `stripTruncation` de `conversation-bash-paths.ts` ya entiende).
3. Multilínea: los saltos de línea se colapsan a un espacio antes de recortar; el resumen nunca contiene saltos de línea (CE-12).

`tool.start` gana `summaryTruncated: z.boolean().optional()` (solo se emite cuando es `true`); la web muestra el indicador (CA-021). El resumen **no** decide documentos tocados (RN-27): eso lo da `document.touched`; el resumen más largo mejora la heurística de hilos viejos y la lectura humana.

### D-07. Precedencia en la web: `document.touched` vs heurística (RF-06)

- `ThreadState` gana `touched: TouchedDocument[]` (`{ seq, path, op, author }`), poblado en `applyThreadEvent` con `case 'document.touched'`. **No** entra en `items` (no afecta `Timeline`, diálogos ni participantes). `emptyThread()` lo inicializa en `[]`; los 3 literales de `ThreadState` en specs se actualizan.
- `deriveConversation`: `thread.touched.length > 0` → `documents` = `structuredDocuments(thread.touched, snapshot)`; si no → `relatedDocuments(thread, snapshot)` (heurística FIX-e-burgos-005-006 intacta, CA-019). **Nunca se concatenan** (RN-28, RN-31). Una sola función de salida por rama, sin dedupe cruzado porque nunca coexisten (CA-020).
- `structuredDocuments`: recorre en orden de `seq`, pasa cada ruta por `documentAt` (mismo filtro a documentos de specs conocidas), conserva un solo registro por ruta con el orden del **último** toque (`delete`+`set`, igual que hoy, CA-017), `agents` = unión de autores, `op` = última operación, `gateActivity.documentSeqs[path]` = `seq` del último toque. Autor mostrado = el del registro (RN-32).
- `ConversationDocument` agrega `op?: 'created' | 'modified' | 'deleted'` (ausente en la rama heurística); `ConversationView` agrega `documentSource: 'structured' | 'heuristic'`, `sessionTitle`.
- Capacidades (CA-024): `lib/use-bridge-features.ts` (COMP-022) expone `supports('session-title' | 'link-targets' | 'document-touched')` desde `client.supports`; `CapabilityNotice` (COMP-021) muestra, sin bloquear, qué falta cuando el puente es viejo (título, asociaciones múltiples, documentos de consola) en lugar de datos vacíos.

**Decisiones abiertas para el dev (no bloquean la implementación; se implementa la regla literal del Funcional):**

- **R-1 (hilos de época mixta).** Un hilo anterior al ciclo que sigue activo con el puente nuevo tendrá, a partir de su primer toque estructurado, `touched.length > 0`: la lista deja de usar la heurística y los documentos previos a la actualización dejan de verse. RN-28 lo exige así. Alternativa si el dev la prefiere: un campo opcional `ThreadInfo.documentTouchedFromSeq` fijado por el puente en el primer turno bajo la versión nueva; la web usaría heurística para `seq` menores y estructurado para mayores (particiona, no mezcla). Cuesta un campo y un `if`; hay que reabrir RN-28/CA-018 del Funcional.
- **R-3 (tool denegado).** Un `Write` bloqueado por el SPEC GATE deja un `tool.start` sin `document.touched`; en un hilo sin ningún toque estructurado la heurística (que ignora el estado del tool) lo seguiría listando. Es el comportamiento actual (CA-019 pide listas idénticas a las de hoy); no se cambia.

### D-08. Estado de `StoredThread` y `SessionManager`

```ts
export type StoredLinkEntry = ThreadLinkEntry & { dismissed?: true };
export interface StoredLink {
  target: ThreadLinkTarget;
  source: 'auto' | 'manual' | 'legacy';
  targets: StoredLinkEntry[];
}
export interface StoredThread extends Omit<ThreadInfo, 'pendingCount' | 'engineSessionId' | 'provider' | 'link' | 'sessionTitle'> {
  engineSessionId: string | null;
  provider: ProviderId;
  link: StoredLink;
  sessionTitle: string | null;
  pending: PendingMessage[];
}
```

`toThreadInfo` proyecta `link: { target, source, targets: activas }` y `sessionTitle`. El constructor de `SessionManager` recibe el `DocumentChangeTracker` por `deps.tracker?` (por defecto uno real sobre `deps.root`; los tests inyectan uno con directorio temporal). Orden de operaciones por evento `afterTool`: calcular Δ → `emit(document.touched)` por archivo (secuencia garantizada por `ThreadStore.append`) → `detectLinks(thread, paths)` → `publishThread` si cambió. `Live` agrega `titleInFlight`, `unresolvedPaths`. `FakeEngine` gana marcadores `#write-doc` y `#bash-doc` que invocan `beforeTool/afterTool` y escriben un archivo real en el workspace de fixtures, para cubrir e2e sin tokens.

## Enmienda 2026-10-26 (coordinador)

Resuelve R-1 (hilos de época mixta) con autorización de avance del dev: se adopta el **corte por seq**. En un hilo, los eventos con `seq` menor al del primer `document.touched` usan la heurística FIX-e-burgos-005-006; los posteriores usan solo `document.touched`. Nunca se mezclan fuentes para un mismo rango, sin duplicados y sin pérdida. Reemplaza la regla literal de D-07 («`touched.length > 0` → solo estructurado»).

- **Cálculo del corte (web, sin campo de protocolo nuevo):** `cutoffSeq = min(seq)` de `thread.touched`; el hilo sin toques no tiene corte y usa solo la heurística (CA-019). `ThreadInfo.documentTouchedFromSeq` queda **descartado**.
- **Derivación:** `deriveConversation` arma `documents` = heurística acotada a los items con `seq < cutoffSeq` (parámetro opcional `beforeSeq` de `relatedDocuments`) y `structuredDocuments` sobre todo `touched`; un mismo `path` presente en ambos tramos se fusiona en un solo registro (`agents` unión, `op` y orden del último toque estructurado). `documentSource` pasa a `'structured' | 'heuristic' | 'mixed'`.
- **Robustez:** si el historial viene recortado y el primer `document.touched` visible no es el real, el corte solo se desplaza hacia un `seq` mayor y la heurística cubre ese tramo: no hay pérdida; sin duplicados por la fusión por ruta. Tests en `conversation.spec.ts`: corte, fusión por ruta, hilo sin toques, hilo solo estructurado.

## Cambios en schema (sdd/schema.json)

Ninguno: el cambio es de protocolo y de archivos locales del puente (`threads.json`, `threads/<id>.jsonl`), sin tablas.

## Contratos de API (sdd/api.json)

Ninguno: el contrato vive en `libs/studio-protocol` (zod). Delta de contrato resumido:

| Elemento | Archivo | Tipo | Compatibilidad |
| -------- | ------- | ---- | -------------- |
| `ThreadInfo.sessionTitle?: string \| null` | `domain.ts` | campo opcional con `.catch(null)` | aditivo |
| `ThreadLink.targets?: ThreadLinkEntry[]`, `ThreadLinkEntry`, `ThreadLinkRef`, `LinkOrigin`, `MAX_LINK_TARGETS` | `domain.ts`, `limits.ts` | campo opcional + tipos | aditivo |
| `document.touched` en `ThreadEvent` | `events.ts` | miembro nuevo de la unión | filtrado del historial para webs viejas |
| `tool.start.summaryTruncated?` | `events.ts` | campo opcional | aditivo |
| `thread.updateLinks` | `commands.ts` | comando nuevo | solo con `link-targets` |
| `thread.history.includeDocumentTouched` | `commands.ts` | campo con `default(false)` | aditivo |
| `BRIDGE_FEATURES` + `session-title`, `link-targets`, `document-touched` | `limits.ts` | lista | aditivo |
| `PROTOCOL_VERSION` | `version.ts` | **sin cambio (2)** | — |

## Componentes (sdd/components.json, app-key `apps/studio`)

Nuevos (`defined`): **COMP-021 `CapabilityNotice`** (aviso no bloqueante de capacidades faltantes del puente), **COMP-022 `useBridgeFeatures`** (hook sobre `client.supports`). Actualizados (`updated`): **COMP-005 `ThreadLinkPicker`** (lista de asociaciones con origen, agregar/quitar, «no disponible»; modo single-select legacy sin `link-targets`), **COMP-017 `ConversationSessionInfo`** (título de sesión con tres estados: título / «sin título disponible» / aviso de puente desactualizado), **COMP-018 `RelatedDocuments`** (operación y fuente del documento).

## Dependencias externas

`@anthropic-ai/claude-agent-sdk@0.3.292` (ya pinneado): `getSessionInfo`, hooks `PostToolUse`/`PostToolUseFailure`. Sin dependencias nuevas. Una actualización del SDK exige re-verificar `pickSessionTitle` (H-6) y los campos de `PostToolUseHookInput`.

## Riesgos y verificaciones pendientes

| # | Riesgo | Mitigación |
| - | ------ | ---------- |
| R-1 | Hilos de época mixta pierden documentos previos (ver D-07). | Decisión abierta al dev; alternativa de bajo costo documentada. |
| R-2 | `summary` puede ser un prompt (H-6). | Filtro contra `firstPrompt` + spike con sesión real; degradación a solo `customTitle`. |
| R-3 | Write denegado visible en hilos sin toque estructurado. | Comportamiento actual; sin cambio. |
| R-4 | Latencia de dos recorridos de `sdd/` por Bash en repos grandes. | Presupuesto 250 ms / 20 000 entradas con omisión registrada (CE-10); optimización futura: reusar la instantánea como índice vivo alimentado por el watcher. |
| R-5 | Atribución entre hilos de canales distintos con ventanas solapadas puede omitir un documento legítimo. | Desempate por directorio de spec; si no resuelve, se omite en lugar de atribuir mal (RN-24). |
| R-6 | Los FIX-e-burgos-005-001..011 tocaron `conversation.ts`, `ConversationSessionInfo`, `timeline.ts`. | Leer la versión actual; las tasks no reabren esos fixes. |
| R-7 | `PostToolUse` podría no dispararse para tools abortados por `interrupt`. | `closeThreadWindows` al terminar el turno; test con ventana abierta. |

## Trazabilidad CA → decisión

| CA | Decisión |
| -- | -------- |
| CA-001..005 | D-01, D-03 |
| CA-006..012 | D-02 |
| CA-013..017 | D-04, D-05 |
| CA-018..020 | D-07 |
| CA-021 | D-06 |
| CA-022..025 | D-03, D-02 (setLink legacy), D-07 (CapabilityNotice) |
| CA-026 | Tests por archivo (abajo) |

## Archivos a tocar por subproyecto (orden: protocolo → puente → web)

### 1. `libs/studio-protocol`

- `src/domain.ts`: `LinkOrigin`, `ThreadLinkRef`, `ThreadLinkEntry`, `ThreadLink.targets`, `ThreadInfo.sessionTitle`.
- `src/events.ts`: `document.touched`; `tool.start.summaryTruncated`.
- `src/commands.ts`: `thread.updateLinks`; `thread.history.includeDocumentTouched`.
- `src/limits.ts`: `MAX_LINK_TARGETS`, `BRIDGE_FEATURES` + 3 features.
- `src/version.ts`: sin cambios.
- Tests: `domain.spec.ts` (entradas, `.catch`, retrocompatibilidad con `ThreadInfo` v2 sin campos nuevos), `events.spec.ts` (`document.touched`, `summaryTruncated`), `commands.spec.ts` (`thread.updateLinks`, `includeDocumentTouched` default), `handshake.spec.ts` (lista de features, `PROTOCOL_VERSION === 2`).

### 2. `apps/studio-bridge`

- `src/engine/types.ts`: `readSessionTitle?`, `ToolRunContext`, `beforeTool?/afterTool?/rebaseTool?/cancelTool?`.
- `src/engine/claude-sdk-engine.ts`: `sessionInfoFn`, `readSessionTitle`, `pickSessionTitle`, hooks `PostToolUse`/`PostToolUseFailure`, `beforeTool` en `PreToolUse`, `rebaseTool`/`cancelTool` en `canUseTool`.
- `src/engine/tool-summary.ts`: `summarizeToolDetailed`, `summarizeBash`, `BASH_SUMMARY_MAX`.
- `src/engine/sdk-mapper.ts`: `summaryTruncated` en `tool.start`.
- `src/engine/fake-engine.ts`: marcadores `#write-doc`, `#bash-doc`, `readSessionTitle` simulado.
- `src/sessions/document-tracker.ts` (nuevo): instantánea, diferencia, ventanas y atribución.
- `src/sessions/thread-link.ts`: álgebra de `targets`, `detectRefs`, `legacyTargetOf`, `linkTargetExists` ampliado.
- `src/sessions/store.ts`: `StoredLink`, `StoredThread`, `toThreadInfo`, migración y manejo de `threads.json` corrupto, backfill de `sessionTitle`.
- `src/sessions/session-manager.ts`: refresco de título (`onSessionId`, `turn.end`, backfill), `updateLinks`, `setLink` legacy, emisión de `document.touched`, `detectLinks`, `history(..., includeDocumentTouched)`, cierre de ventanas en `finish`.
- `src/server/router.ts`: `thread.updateLinks`, `thread.history` con la opción.
- Tests: `document-tracker.spec.ts` (directorio temporal: crea/modifica/borra, sin cambios, presupuesto excedido, solapamiento mismo hilo y entre hilos, exclusión de toques exactos), `thread-link.spec.ts`, `store.spec.ts` (migración idempotente, archivo corrupto, descartadas no viajan), `session-manager.spec.ts` (título con `fake`, detección vía `document.touched`, `setLink` legacy no destruye, historial filtrado), `claude-sdk-engine.spec.ts` (`pickSessionTitle`, hooks nuevos), `tool-summary.spec.ts` (recorte con rutas, indicador), `router.spec.ts`; spike `artifacts/spike-session-info.md`.

### 3. `apps/studio`

- `src/lib/store/timeline.ts`: `touched` en `ThreadState`, `emptyThread`, `case 'document.touched'`; `src/lib/store/state.ts`: `sameInfo` compara `sessionTitle`; `src/lib/bootstrap.ts`: `thread.history` con `includeDocumentTouched: true`.
- `src/lib/link-targets.ts` (nuevo): `linkEntriesOf`, `isLinkEntryAvailable`, helpers de etiqueta; `src/lib/store/nav-tree.ts`: hilo bajo cada entrada.
- `src/lib/conversation.ts`: `structuredDocuments`, precedencia, `op`, `documentSource`, `sessionTitle`; `src/lib/conversation-bash-paths.ts` sin cambios de lógica (solo tests con el nuevo límite).
- `src/lib/use-bridge-features.ts` (nuevo, COMP-022); `src/components/mission-control/CapabilityNotice.tsx` (nuevo, COMP-021).
- `src/components/workspace/ThreadLinkPicker.tsx` (COMP-005), `src/components/mission-control/ConversationSessionInfo.tsx` (COMP-017), `src/components/mission-control/RelatedDocuments.tsx` (COMP-018), `src/components/workspace/ConversationPanelSections.tsx` y `RightPanel.tsx` (aviso de capacidades), `src/components/workspace/Timeline.tsx` (indicador `summaryTruncated`), `src/lib/i18n/en.ts` y `es.ts` (claves nuevas sin reordenar).
- Tests: `timeline.spec.ts`, `state.spec.ts`, `bootstrap.spec.ts`, `conversation.spec.ts` (precedencia, no mezcla, dedupe, época heurística), `nav-tree.spec.ts`, `link-targets.spec.ts`, `threadlink.spec.tsx`, `ConversationSessionInfo.spec.tsx`, `RelatedDocuments.spec.tsx`, `handshake-features.spec.tsx`, `no-fabricated-data.spec.ts`; e2e Playwright con `--engine fake` para `#bash-doc`.

### Cierre (no es implementación)

Fragmentos aditivos en `updates/` de los tres subproyectos, filas de `sdd/context/constitution.md`, `sdd:validate` y `sdd:rebuild-tasks-index` — responsabilidad de quien cierra el ciclo.
