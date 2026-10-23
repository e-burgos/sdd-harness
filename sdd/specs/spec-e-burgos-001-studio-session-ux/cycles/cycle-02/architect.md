# Architect — Cycle 2: studio-session-ux

> **Input:** `cycles/cycle-02/brief.yaml`, `cycles/cycle-01/architect.md` (decisiones [C2]), código real post cycle-01
> **Output:** sdd/specs/spec-e-burgos-001-studio-session-ux/cycles/cycle-02/architect.md
> **Generado por:** sdd-architect · 2026-10-23
> **Subproyectos:** `libs/studio-protocol` · `apps/studio-bridge` · `apps/studio`
> **Alcance:** HU-1 (adjuntos), HU-2 (`@archivo`), HU-3 (`@agente`, `/skill|prompt`), CA-016.4, CA-016.5.

Este documento **no rediseña**: confirma las decisiones [C2] de `cycle-01/architect.md` (D-03, D-04,
D-05, D-08, D-09, D-10, D-19, D-20) contra el código que dejó cycle-01 y documenta solo los deltas.
Lo que no se menciona acá rige tal cual está en cycle-01.

---

## 0. Resumen

| Tema | Resultado |
| --- | --- |
| Protocolo | **Sin cambios.** Todo lo que cycle-02 necesita ya está publicado en `PROTOCOL_VERSION = 2` (§2). Sin bump, sin bloqueo. |
| `sdd/api.json` · `sdd/schema.json` | Sin cambios (sin REST ni DB, §0.3 de cycle-01). |
| `sdd/components.json` | COMP-007/008/009/012/013 siguen `defined`; se corrigen paths a la convención real (§9). |
| Desvíos de cycle-01 | 9, listados en §1. Ninguno toca el protocolo. |

---

## 1. Desvíos respecto de `cycle-01/architect.md` (a la luz del código real)

| # | Cycle-01 decía | Código real / decisión cycle-02 | Motivo |
| --- | --- | --- | --- |
| X-1 | `toSdkUserMessage` arma bloques de adjuntos (sync). | `PromptBlock` pasa a unión `text` · `attachment { ref }` y los bytes se leen **en el engine, de forma asíncrona**, vía `EngineCallbacks.readAttachment` (§3.3). | `collectPending` es síncrono (D-20) y los pendientes guardan solo `AttachmentRef`; leer en el engine no rompe la decisión síncrona y sobrevive a un reinicio del puente sin cachear binarios en memoria. |
| X-2 | El `/<id>` de skill se quita del texto **en la web**. | La web manda el texto tal cual se tipeó + `refs.skills`; **el puente** quita el `/<id>` inicial del texto que llega al modelo (`TurnPrompt.text`), no del `user.message`. | Un `/skill` solo dejaría `text = ''` sin adjuntos y falla el `refine(hasContent)`; además el timeline muestra lo que el dev escribió y el CLI nunca ve un `/` inicial que podría interpretar como comando propio. Sin cambio de protocolo. |
| X-3 | `toSdkUserMessage` siempre agrega el bloque de texto del dev. | Bloque final: texto del dev si no está vacío; si lo está y hay adjuntos, `Attachments: <n1>, <n2>`; si no hay ninguno de los dos, se omite. | La API rechaza bloques `text` vacíos. |
| X-4 | Slice `drafts`: `{ text, attachments: [] }`. | Hoy es `Record<string, string>` (`lib/store/state.ts:18`, `draftKey`, `setDraft`). Pasa a `Record<string, ComposerDraft>` (§6.4). | El slice de cycle-01 quedó solo con texto. Estado de UI, no persistido. |
| X-5 | Hooks en `hooks/useX.ts`, componentes en `components/workspace/composer/`. | Convención real: hooks en `src/lib/use-*.ts` (`use-collapsed-state.ts`, `use-stick-to-bottom.ts`), componentes planos en `src/components/workspace/`. | Consistencia con cycle-01; paths corregidos en `components.json`. |
| X-6 | `unsupported: attachments` también para refs. | El router C1 responde `unsupported: catalog` para refs (`server/router.ts:17`). | Solo documental: en cycle-02 se elimina `rejectUnsupportedBody` entero. |
| X-7 | `Live.accepting` reserva el hilo antes del primer `await`. | Cola de aceptación FIFO por hilo (`Live.acceptTail`, §3.5). | Garantiza orden de llegada entre un envío con adjuntos (lento) y uno de solo texto (rápido) en el mismo hilo. |
| X-8 | Dedupe del catálogo por realpath, sin regla de qué entrada sobrevive. | Mismo realpath → una entrada **canónica**: `path` = realpath relativo al root y `source` según dónde vive el archivo real (§5.2). | En este repo `.claude/agents → ../sdd/agents`: sin esta regla todos los agentes pasarían de `sdd/agents/…` (cycle-01) a `.claude/agents/…`, rompiendo `workspace.readFile`, que solo lee `sdd/`. |
| X-9 | Prompt id sin definir. | `id` del prompt = basename sin `.prompt.md`; colisión con una skill → gana la skill. | Coherente con `PROMPT_COMMANDS` de `slash.ts`, que ya mapea por ruta. |

---

## 2. Contratos del protocolo — confirmación (sin cambios, sin bump)

Revisado contra `libs/studio-protocol/src` al abrir el ciclo. Todo existe y está testeado con zod:

| Necesidad cycle-02 | Contrato existente |
| --- | --- |
| Subida inline | `AttachmentUpload` (`attachments.ts`): `image` con `width/height ≤ IMAGE_MAX_SIDE`, `pdf`, `text`; `Base64.max(MAX_FRAME_BYTES)` |
| Referencia persistida | `AttachmentRef` en `user.message` y `pending.added` (`events.ts`), `.optional()` |
| Recarga | `attachment.get { sha256, mime }` → `AttachmentContent { sha256, mime, data: base64 }` (texto: base64 de los bytes UTF-8) |
| Búsqueda | `workspace.searchFiles { query ≤ 200, limit 1..FILE_SEARCH_MAX (50), default 30 }` → `FileSearchResult` |
| Catálogo | `AgentSummary.source/path`, `SkillSummary { id: CatalogId, kind: skill\|prompt, description ≤ 300 }`, `WorkspaceSnapshot.skills` |
| Refs | `PromptRefs { agents: AgentId[] ≤ 5, skills: CatalogId[] ≤ 5 }` en `MessageBody` |
| Capacidades | `Welcome.features: string[]` opcional; `BRIDGE_FEATURES` ya incluye `attachments`, `file-search`, `catalog` |
| Límites | `MAX_FRAME_BYTES`, `FRAME_BUDGET_BYTES`, `MAX_ATTACHMENTS`, `IMAGE_MAX_SIDE`, `MAX_PROMPT_REFS`, `FILE_SEARCH_MAX`, `TEXT_ATTACHMENT_EXTENSIONS`, `EXT_BY_MIME` |

Restricciones que el código impone y el implementador debe respetar:

- `AgentId` = `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$` (sin puntos). Un agente descubierto cuyo id no matchee
  **se omite del catálogo** (no se podría referenciar ni abrir DM). `SkillSummary.id` debe matchear `CatalogId`.
- `thread.pending.edit` sigue siendo solo texto: los adjuntos de un pendiente no se editan, solo se
  quita el pendiente entero.

Si durante F4/F5 apareciera la necesidad de un campo nuevo: **opcional y aditivo**, con spec zod de
compatibilidad (JSONL viejos validan). Cualquier cambio requerido u incompatible es **bloqueo** y vuelve
al orquestador; no se resuelve con un bump dentro de este ciclo.

---

## 3. Puente — adjuntos (`apps/studio-bridge`, F4)

### 3.1 `sessions/attachment-store.ts` (nuevo)

```ts
export interface AttachmentStore {
  init(): Promise<void>;
  put(upload: AttachmentUpload): Promise<AttachmentRef>;
  read(sha256: Sha256, mime: AttachmentMime): Promise<Uint8Array>;
}
```

- **Layout:** `.sdd-studio/attachments/<sha256>.<EXT_BY_MIME[mime]>`, bytes exactos, inmutable, dedupe
  por hash. Lo cubre el `.sdd-studio/.gitignore` (`*`) existente.
- **`init()`**: `mkdir -p`; luego, sin bloquear el arranque, suma tamaños y loguea un aviso si supera
  1 GiB (D-19). Nunca borra.
- **`put()`**:
  1. Bytes: `image`/`pdf` → decodificar base64; `text` → UTF-8 del string.
  2. Revalidar contenido contra `mime` (D-03): PNG `89 50 4E 47 0D 0A 1A 0A`, JPEG `FF D8 FF`, GIF
     `GIF87a|GIF89a`, WEBP `RIFF....WEBP`, PDF `%PDF-` en el offset 0; texto: sin bytes `00`.
     Discrepancia → `SessionError('bad-request', 'attachment "<name>" does not match <mime>')`.
  3. `bytes.length ≤ MAX_FRAME_BYTES` (si no, `bad-request`).
  4. `sha256` de los bytes; si el destino existe como archivo regular del mismo tamaño → no reescribe.
  5. Escritura atómica: `<sha>.<ext>.<uuid>.tmp` con flag `wx` → `rename` al destino. Error de disco →
     `SessionError('internal', 'attachment could not be saved')`.
  6. Devuelve `AttachmentRef { sha256, kind, mime, name, size: bytes.length, width?, height? }`
     (dimensiones = las declaradas por el cliente, solo para mostrar; el puente no decodifica imágenes).
- `name` es solo para mostrar: nunca participa de una ruta ni de un log con datos.
- Jamás se loguean `data`/`text`; los mensajes de error llevan solo el nombre visible.

### 3.2 `attachment.get` — seguridad de rutas (R-C2-2)

La ruta sale **solo** de `sha256` (ya validado por zod `^[a-f0-9]{64}$`) + `EXT_BY_MIME[mime]` (enum
cerrado). Ningún otro dato del input toca el filesystem.

1. `dirReal = realpath(.sdd-studio/attachments)`; debe estar dentro de `realpath(root)/.sdd-studio`.
2. `file = join(dirReal, sha + '.' + ext)`; `realpath(file) === file` (rechaza symlinks plantados).
3. `open(file, O_RDONLY | O_NOFOLLOW | O_NONBLOCK)`; `fstat` sobre el mismo fd: archivo regular y
   `size ≤ MAX_FRAME_BYTES` (patrón de `workspace.readFile` en `router.ts`, sin TOCTOU).
4. Leer y recalcular sha256; distinto → tratar como faltante.
5. Cualquier falla → `not-found` con mensaje genérico (`attachment not available`), sin rutas.

Tests obligatorios en la misma task: sha con mayúsculas o `../` (zod), symlink `<sha>.png → /etc/hosts`,
directorio con nombre de sha, archivo > `MAX_FRAME_BYTES`, contenido alterado (hash distinto), mime
cambiado (otra extensión → `not-found`).

### 3.3 Frontera del engine (`engine/types.ts`) — X-1

```ts
export type PromptBlock = { kind: 'text'; text: string } | { kind: 'attachment'; ref: AttachmentRef };

export interface EngineCallbacks {
  readAttachment(ref: AttachmentRef): Promise<Uint8Array | null>;
  collectPending(at: 'cut-point' | 'turn-end', opts?: { textOnly?: boolean }): OutgoingMessage[];
}
```

(Solo los miembros que cambian; el resto de `EngineCallbacks` queda igual.) `readAttachment` lo provee
`SessionManager` sobre `AttachmentStore.read` y devuelve `null` ante cualquier error.

### 3.4 `engine/prompt-content.ts` — mapeo a bloques del SDK y preámbulo

```ts
export function buildTurnPrompt(message: AcceptedMessage, catalog: CatalogView): TurnPrompt;
export function toSdkUserMessage(message: OutgoingMessage, read: EngineCallbacks['readAttachment']): Promise<SDKUserMessage>;
export function toHookContext(messages: OutgoingMessage[]): string;
```

`AcceptedMessage = { text, attachments: AttachmentRef[], refs: PromptRefs }`; `CatalogView` = agentes y
skills del snapshot vigente.

**`buildTurnPrompt`** (puro, síncrono; lo usan `deliverNew`/`deliverAll` en lugar de `plainPrompt`):

- `preamble`, en orden y una línea por ref que **siga existiendo** en el catálogo al entregar:
  agentes → `Delegate this task to the subagent "<id>" using the Agent tool.`; skills `kind: skill` →
  `Use the skill "<id>" (<path>) for this task.`; `kind: prompt` → `Follow the instructions in <path>.`
- `blocks`: un `attachment` por ref, en el orden del Composer.
- `text`: el texto del dev; si empieza con `/<id>` y `<id> ∈ refs.skills`, se quita ese token y el
  espacio siguiente (X-2).

**`toSdkUserMessage`** (async): `content` = preámbulo → adjuntos → texto final (X-3).

| Adjunto | Bloque SDK |
| --- | --- |
| `image/*` | `{ type: 'image', source: { type: 'base64', media_type: mime, data } }` |
| `application/pdf` | `{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data }, title: name }` |
| `text/*` | `{ type: 'text', text: 'Attached file ' + JSON.stringify(name) + ':\n' + contenido }` |
| `read` devolvió `null` | `{ type: 'text', text: '[attachment unavailable: ' + JSON.stringify(name) + ']' }` |

`client_composed` **no se usa** (D-10, confirmado). `uuid = id` como en cycle-01.

### 3.5 Uso en `ClaudeAgentSdkEngine` y `SessionManager`

Engine (`claude-sdk-engine.ts`):

- Prompts iniciales: se resuelven (`Promise.all` de `toSdkUserMessage`) al comienzo del IIFE `done` y
  recién entonces `channel.push`. El SDK espera el iterable vacío sin problema.
- `deliverAtCutPoint` (ya async): resolver → `pushAndFlush`.
- `deliverOrClose` pasa a async y se hace `await` dentro del `for await` (pausa de milisegundos: lectura
  local de ≤ 5 archivos ≤ 1 MiB). Si hay mensajes, resolver → `push`; la decisión de `end()` sigue
  dependiendo de `next.length`, tomada antes del `await`.
- **Carrera interrupt ↔ resolución:** si `interrupted` pasó a `true` mientras se resolvían bytes de
  mensajes ya tomados, el engine llama `cb.revertPending(ids)` con esos ids y no los empuja (RNF-7).
- `deliveryMode = 'stream'` sigue siendo el default (spike de cycle-01). En `'hook-context'`
  `additionalContext` solo lleva texto: el corte llama `collectPending('cut-point', { textOnly: true })`
  y los pendientes con adjuntos esperan a `turn-end`.

SessionManager (`session-manager.ts`):

```ts
createThread(args: { channelId: string; options: ThreadOptions; link?: ThreadLinkTarget } & MessageInput): Promise<ThreadInfo>;
send(threadId: string, message: MessageInput): Promise<SendResult>;
```

`MessageInput = { text: string; attachments: AttachmentUpload[]; refs: PromptRefs }`.

- **Cola de aceptación por hilo (X-7):** `Live.acceptTail: Promise<void>`. Cada `send` se encadena:
  `await put()` de sus adjuntos (en paralelo entre sí) → decisión **síncrona** de cycle-01 (iniciar
  turno / agregar pendiente). Falla de un `put` → el envío completo falla (`bad-request`/`internal`),
  nada se emite y la cola sigue con el siguiente.
- **`createThread`:** materializa los adjuntos **antes** de crear el hilo; si falla, el hilo no existe
  (CE-8). Título: primera línea del texto; si está vacío, nombre del primer adjunto.
- **Refs:** al aceptar se filtran contra el snapshot (ids inexistentes se descartan en silencio,
  CA-005.7), se deduplican y se guardan filtradas en `PendingMessage.refs` y `user.message.refs`
  (solo si no quedan vacías).
- `user.message` / `pending.added` llevan `attachments: AttachmentRef[]` cuando hay; `PendingMessage`
  ya tiene `attachments?` y `refs?` en `store.ts`.
- `editPending`: texto vacío permitido si el pendiente tiene adjuntos; si no, `bad-request` como hoy.

### 3.6 `server/router.ts` · `ws-server.ts` · `main.ts`

- `welcome().features = [...BRIDGE_FEATURES]` (importado del protocolo; reemplaza `SUPPORTED_FEATURES`).
- Se elimina `rejectUnsupportedBody`; `thread.create`/`thread.send` pasan `{ text, attachments, refs }`.
- `workspace.searchFiles` → `fileIndex.search(query, limit)`; `attachment.get` → §3.2.
- `ws-server.ts`: sin cambios (`maxPayload = MAX_FRAME_BYTES` ya está).
- `main.ts`: crea `AttachmentStore` (+ `init()`) y `FileIndex`, los inyecta en `SessionManager` y
  `createHandlers`.

---

## 4. Puente — búsqueda de archivos (`workspace/file-index.ts`, nuevo)

```ts
export interface FileIndex {
  search(query: string, limit: number): Promise<FileSearchResult>;
}
export function createFileIndex(root: string, opts?: { ttlMs?: number; now?: () => number }): FileIndex;
```

D-08 se confirma completo. Precisiones de implementación y seguridad (R-C2-2):

- **Fuente git:** `execFile('git', ['-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'])`,
  sin shell, `timeout 5000`, `maxBuffer` acotado, corte en 100 000 entradas. Respeta `.gitignore`.
- **Fallback walk** (sin git o git falla): BFS con `lstat`, **nunca sigue symlinks de directorio**,
  profundidad ≤ 12, ≤ 50 000 entradas. No interpreta `.gitignore` (limitación documentada: solo aplica
  fuera de un repo git). `source: 'walk'`.
- **Cache:** 15 s; pedidos concurrentes comparten la promesa en curso; el índice se reconstruye perezoso.
- **Normalización por entrada:** descartar si contiene `\0` o `\`, es absoluta, tiene segmento `..`, `.`
  o vacío, o supera 1024 caracteres. Solo rutas relativas POSIX.
- **Exclusiones por segmento:** `.git`, `node_modules`, `.sdd-studio`, `.nx`, `.next`, `dist`, `coverage`,
  y el prefijo `.claude/worktrees/`.
- **Secretos por basename:** `^\.env(\..+)?$` salvo `.env.example|.env.sample|.env.template`, `*.pem`,
  `*.key`, `*.p12`, `*.pfx`, `*.keystore`, `id_rsa*`, `id_ed25519*`, `.npmrc`, `.netrc`.
- **No lee contenido** ni hace `stat` de todo el índice.
- **Ranking** (case-insensitive): prefijo de basename > substring de basename > substring de ruta >
  subsecuencia; empate → ruta más corta, luego orden lexicográfico. `query` vacía (tras `trim`) →
  `files: []`.
- **Symlinks en el resultado:** solo sobre la página candidata (≤ `limit`), `realpath` de cada entrada:
  si sale del root se descarta y entra la siguiente. Costo acotado a ≤ 50 `realpath` por consulta.
- `truncated = true` si había más coincidencias que `limit`. Índice no disponible → `internal`.

Tests obligatorios en la misma task: `.env`, `.env.local`, `.env.example` (sí aparece), `id_rsa.pub`,
`node_modules/x`, `.claude/worktrees/…`, symlink a `/etc` en walk, symlink trackeado que apunta fuera
del root, nombre con `..`, ranking y `truncated`, cache (2 búsquedas dentro de 15 s = 1 `git`).

---

## 5. Puente — catálogo de agentes, skills y prompts

### 5.1 `workspace/catalog.ts` (nuevo; reemplaza `loadAgents` de `snapshot.ts`)

```ts
export function loadCatalog(root: string): Promise<{ ok: boolean; agents: AgentSummary[]; skills: SkillSummary[] }>;
```

`parseFrontmatter` se mueve desde `snapshot.ts`. `loadWorkspaceSnapshot` usa `loadCatalog` y llena
`agents` y `skills`; un error distinto de `ENOENT` → `ok: false` → `stale: ['agents']` (comportamiento
actual de `mergeSnapshot`, que conserva el área previa).

| Orden | Fuente | Kind | `id` | `source` |
| --- | --- | --- | --- | --- |
| 1 | `.claude/agents/*.md` | agente | `name` del frontmatter ?? basename sin `.md` ni `.agent` | `claude` |
| 2 | `sdd/agents/*.agent.md` | agente | `name` ?? basename sin `.agent.md` | `sdd` |
| 3 | `.claude/skills/*/SKILL.md` | skill | `name` ?? nombre del directorio | `claude` |
| 4 | `sdd/skills/*/SKILL.md` | skill | `name` ?? nombre del directorio | `sdd` |
| 5 | `sdd/prompts/*.prompt.md` | prompt | basename sin `.prompt.md` (X-9) | `sdd` |

### 5.2 Reglas

- **Contención:** cada directorio fuente se resuelve con `realpath`; si sale del root, la fuente se
  ignora entera. Cada archivo también debe resolver dentro del root.
- **Dedupe por realpath (X-8):** dos rutas al mismo archivo real producen una sola entrada, con
  `path` = realpath relativo al root (POSIX) y `source = 'sdd'` si vive bajo `sdd/`, `'claude'` si no.
  En este repo los agentes siguen saliendo como `sdd/agents/<x>.agent.md`, igual que en cycle-01.
- **Precedencia por id** (archivos distintos con el mismo id): gana el de menor orden en la tabla. Agentes
  y skills/prompts son espacios de id separados; entre skill y prompt con el mismo id gana la skill.
- **Validación:** agente con id que no matchea `AgentId` → se omite; skill/prompt con id que no matchea
  `CatalogId` → se omite.
- **Caps:** 200 por tipo (agentes, skills, prompts), orden por id; `description` recortada a 300
  caracteres en los tres; solo se leen los primeros 8 KiB de cada archivo (alcanza para el frontmatter).
- `.claude/commands/` **no** es fuente en este ciclo (no está en la spec); queda anotado para después.

### 5.3 Watcher (`workspace/watcher.ts`)

- `sdd/agents`, `sdd/skills` y `sdd/prompts` ya los cubre el `chokidar.watch(sdd/)` existente (no están en
  `IGNORED_DIRS`): sin cambios.
- Segundo `chokidar.watch(<root>/.claude, { ignoreInitial: true, depth: 3, ignored })`, donde `ignored`
  deja pasar solo `.claude`, `.claude/agents/**` y `.claude/skills/**` (chokidar 4 no acepta globs: es
  una función de ruta). **Nunca `.claude` entero** (`.claude/worktrees/` tiene copias del repo, R-C2-5).
  Comparte `schedule()` con el watcher de `sdd/`; los eventos duplicados por symlink los absorbe el
  debounce. Si `.claude` no existe al iniciar no se crea watcher: el catálogo `.claude` se refresca con el
  próximo cambio en `sdd/` o al reiniciar. `close()` cierra ambos.

### 5.4 Snapshot

`AREA_FIELDS.agents = ['agents', 'skills']` ya está; `skills: []` pasa a `catalog.skills`. El refresco
llega a la web por `workspace.changed` como hoy.

---

## 6. Web (`apps/studio`, F5)

### 6.1 Activación por capacidades

`BridgeClient.supports(feature)` ya existe (`lib/bridge/client.ts:91`). La web lee `features` del
`Welcome` y muestra cada capacidad **solo si el puente la anuncia** (R-C2-4):

| Feature | Qué habilita | Ausente (puente de cycle-01 o anterior) |
| --- | --- | --- |
| `attachments` | Botón adjuntar, pegar archivos, soltar sobre el Composer, `AttachmentTray`, `attachment.get` | Sin UI de adjuntos; se envía `attachments: []` |
| `file-search` | Grupo Archivos del menú `@` | Grupo oculto |
| `catalog` | Grupo Agentes del menú `@`, grupo Skills y prompts del menú `/`, envío de `refs` | Grupos ocultos; se envía `refs` vacío |

Test de handshake con `features` ausente: ninguna de las tres UIs aparece y ningún comando sale con
adjuntos o refs.

### 6.2 Adjuntos: clasificación, re-encode y presupuesto

Módulo puro `src/lib/attachments/` (sin React): `classify`, `encodeImage`, `fitFrameBudget`,
`commandFrameBytes`. Los consume `useAttachmentDraft` (COMP-012).

**Clasificación** (al agregar):

| Tipo | Criterio | Resultado |
| --- | --- | --- |
| Imagen | `file.type ∈ ImageMime` **y** magic bytes coincidentes | `kind: image` |
| PDF | magic `%PDF-` | `kind: pdf` |
| Texto | extensión ∈ `TEXT_ATTACHMENT_EXTENSIONS` + `TextDecoder('utf-8', { fatal: true })` + sin `\0` | `text/markdown` si `md\|mdx\|markdown`, si no `text/plain` |
| Otro | — | error por archivo "tipo no soportado"; no entra a la bandeja |

Imagen pegada sin nombre útil → `pasted-<HHmmss>.<ext>`. Texto pegado (no archivo) sigue yendo al textarea.

**Re-encode siempre (CA-016.4, D-04 confirmado):** al agregar, toda imagen no GIF se re-encodea a lado
mayor ≤ 1568 con `createImageBitmap` + `OffscreenCanvas` (fallback `<canvas>`): JPEG → `image/jpeg` q 0.85;
PNG/WebP → `image/webp` q 0.9, fallback `image/png` si el navegador no codifica WebP (detectado por el
`type` del blob resultante). GIF ≤ 1568 → tal cual; mayor → primer cuadro estático con la regla de PNG.
**Si el re-encode falla, el archivo se rechaza con error; nunca se envía el original.** Se conserva el
`Blob` original en el borrador para que la escalera re-encodee desde él y no desde una salida ya
comprimida.

**Pre-chequeos al agregar** (errores inmediatos, antes de intentar enviar): PDF con bytes crudos >
`floor((FRAME_BUDGET_BYTES - 16_384) / 4) * 3` (≈ 774 KiB, base64 infla 4/3); texto con bytes UTF-8 >
`FRAME_BUDGET_BYTES - 16_384`; más de `MAX_ATTACHMENTS` → el excedente se rechaza con aviso "máximo 5".
Constantes derivadas del protocolo, en el módulo web; no son contrato.

**Presupuesto del frame (R-C2-1):**

- `commandFrameBytes(cmd)` = bytes UTF-8 de `JSON.stringify({ kind: 'command', id, ...cmd })` con `id`
  de relleno de 24 caracteres: misma forma que mide la guarda de `client.ts`. El comando se mide
  **completo** (texto, refs, opciones y todos los adjuntos), nunca sobre bytes crudos.
- Si `≤ FRAME_BUDGET_BYTES` → enviar.
- Si no, escalera **solo sobre imágenes re-encodeables** (no GIF tal cual): peldaños
  `(1568, 0.85) → (1568, 0.7) → (1280, 0.7) → (1024, 0.6)`. Iteración: elegir la imagen más pesada que no
  esté en el último peldaño, bajarla un peldaño, re-medir; repetir hasta que entre o no quede ninguna
  bajable. Resultados por `(adjunto, peldaño)` cacheados en memoria durante el envío.
- Si no alcanza (típico: PDF grande o varios PDF/textos) → no se envía; error con el exceso en KB y los
  nombres de los **dos adjuntos más pesados**; el Composer conserva texto y adjuntos (RN-3, RN-5). Los
  peldaños aplicados no se persisten en el borrador.
- La guarda genérica de `client.ts` (`frame-too-large`) queda como red de seguridad.

Tests: 5 imágenes grandes que entran tras la escalera; PDF justo en el límite (entra) y 1 byte por encima
(pre-chequeo); PDF + 4 imágenes que no entran (mensaje con los dos más pesados); texto con muchas comillas
y saltos (el escape JSON lo infla y el medidor lo ve).

### 6.3 Componentes

| Componente | Archivo | Responsabilidad |
| --- | --- | --- |
| `AttachmentTray` (COMP-007) | `src/components/workspace/AttachmentTray.tsx` | Fila de chips sobre el textarea, debajo de `PendingMessages`: miniatura (imagen, `objectURL` del encode) o tarjeta (PDF/texto) con nombre y tamaño, botón quitar con `aria-label`, contador `n/5`, errores por archivo. Zona de drop sobre todo el Composer con estado visual de arrastre. |
| `AttachmentView` (COMP-008) | `src/components/workspace/AttachmentView.tsx` | Render de un `AttachmentRef` en el timeline: imagen con caja reservada por `width/height` (sin layout shift; ayuda a `useStickToBottom`), clic abre en pestaña nueva; PDF tarjeta + "Abrir"; texto tarjeta + expandir a `<pre>` acotado; faltante → "adjunto no disponible" (CA-003.3). |
| `MentionMenu` (COMP-009) | `src/components/workspace/MentionMenu.tsx` | Popover anclado al textarea para `@` y `/` (§6.5). |
| `useAttachmentDraft` (COMP-012) | `src/lib/use-attachment-draft.ts` | Estado de adjuntos del borrador sobre el slice `drafts`: `add(files)`, `remove(id)`, `buildUploads(cmd)` (clasifica, encodea, presupuesto). Calcula `sha256` (`crypto.subtle`) de los bytes que se envían para pre-cargar la caché. |
| `useAttachmentContent` (COMP-013) | `src/lib/use-attachment-content.ts` | `objectURL` de un `AttachmentRef`: LRU de 64 con refcount (solo se revocan entradas sin consumidores montados), cola con concurrencia 2, dedupe de pedidos en vuelo por sha256, `attachment.get` + `AttachmentContent.parse` + verificación de sha256; pre-carga desde la pestaña que envía. |

Modificados (se registran en `components.json` al tocarlos, regla de cycle-01): `Composer.tsx` (botón
adjuntar, paste/drop, `MentionMenu`, envío con `attachments`/`refs`, permite enviar sin texto si hay
adjuntos), `Timeline.tsx` (ítem `user` con `AttachmentView` y chips de refs), `PendingMessages.tsx`
(chips de adjuntos de solo lectura), `lib/store/timeline.ts` (`attachments`/`refs` en el ítem `user` y en
`PendingItem`), `lib/store/state.ts` (slice `drafts`).

### 6.4 Borrador por hilo con adjuntos (CA-016.5) — X-4

```ts
export interface ComposerDraft {
  text: string;
  attachments: DraftAttachment[];
}
```

- `drafts: Record<string, ComposerDraft>`; misma clave `draftKey(channelId, threadId)`. Acciones:
  `setDraftText(key, text)`, `setDraftAttachments(key, list)`, `clearDraft(key)`. Entrada sin texto y
  sin adjuntos → se borra la clave (como hoy).
- `DraftAttachment` (interno de la web): `id`, `kind`, `name`, `mime`, `original: Blob`, `encoded`
  (datos listos para `AttachmentUpload` + `sha256`), `previewUrl?`, `size`.
- `clearDraft` y `remove` revocan los `previewUrl`. En memoria, no persistido: se pierde al recargar (RF-19).
- El Composer se sigue remontando por `key` y se inicializa desde el draft.

### 6.5 Menú `@` y `/`, inserción y refs

- **`@`** se abre al tipear `@` al inicio o tras espacio; `query` = caracteres hasta el cursor sin espacios.
  Grupos: **Archivos** (`workspace.searchFiles`, debounce 120 ms, descarta respuestas viejas por número de
  secuencia, `limit` 30) y **Agentes** (filtro local de `snapshot.agents`). Query vacía → solo Agentes.
- **`/`** se abre solo con `/` en la posición 0. Grupos: **Comandos** (fijos: `gate`, `validate` y las
  claves de `PROMPT_COMMANDS`, derivadas de los exports actuales; `slash.ts` intacto, RN-17) y **Skills y
  prompts** (`snapshot.skills`, sin los prompts cuyo `path` ya está en `PROMPT_COMMANDS`).
- **Inserción:** archivo → la **ruta sin `@`** + espacio (entre backticks si contiene espacios) (RN-13,
  CA-004); agente → `@<id> `; comando o skill → `/<id> ` reemplazando el token.
- Teclado: ↑/↓, Enter/Tab eligen, Esc cierra; con el menú abierto Enter **no** envía. ARIA: textarea con
  `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`; lista `role="listbox"` con
  grupos etiquetados.
- **Refs al enviar** (`src/lib/composer-refs.ts`, puro):
  - `agents`: tokens `@<id>` (inicio o tras espacio, seguidos de fin, espacio o puntuación) cuyo id está en
    el catálogo; quedan en el texto; dedupe; máx. 5.
  - `skills`: el `/<id>` inicial si **no** es un comando fijo y está en `snapshot.skills`; el texto se
    envía tal cual (X-2).
  - Orden de resolución en `onSubmit`: comando fijo (`parseSlash`) → skill del catálogo → `parseSlash`
    para el error "comando desconocido" de hoy.
  - Sin feature `catalog` → `refs` vacío y el flujo actual de `parseSlash` sin cambios.

---

## 7. FakeEngine (tests y desarrollo sin SDK)

D-07 se confirma; marcadores nuevos para cycle-02:

- El eco agrega ` [attachments: <n1>, <n2>]` con los nombres de los bloques `attachment` (en orden) y
  ` [refs: @a /b]` con los ids del preámbulo resuelto. Por cada adjunto llama `cb.readAttachment`; si
  devuelve `null` agrega `(missing)` al nombre: cubre el camino "adjunto borrado del disco".
- `#bad-attachment`: termina el turno por el camino de `#fail` con mensaje `attachment rejected`, para
  probar que un error del modelo con adjuntos no reintenta ni auto-envía pendientes (tabla D-21).
- Los adjuntos de pendientes entregados en corte (`#steps:N`) aparecen en el `heard:` con el mismo sufijo.
- La web puede desarrollarse entera contra el puente con FakeEngine: los tres features se anuncian igual.

---

## 8. Fases sugeridas (back → front)

Checkpoint entre fases: `pnpm nx run-many -t lint test build -p studio-protocol studio-bridge studio`.
`pnpm sdd:gate spec-e-burgos-001-studio-session-ux cycle-02` (GATE B) antes de la primera línea de código.

| Fase | Orden | Entrega | Congela |
| --- | --- | --- | --- |
| **F4a · Adjuntos puente** | 1 | `attachment-store.ts` + tests de magic bytes/dedupe/atomicidad; frontera `PromptBlock`/`readAttachment`; `buildTurnPrompt` + `toSdkUserMessage` async (X-1, X-3); engine con resolución y revert en carrera; `SessionManager` con `MessageInput`, cola de aceptación y `createThread` (X-7) | Layout `.sdd-studio/attachments`, frontera del engine |
| **F4b · `attachment.get`** | 2 | Router + §3.2 con sus tests de traversal | — |
| **F4c · Búsqueda** | 3 (paralelo a F4b) | `file-index.ts` + router + tests de secretos/symlinks/ranking | Exclusiones de búsqueda |
| **F4d · Catálogo y refs** | 4 | `catalog.ts`, watcher `.claude`, preámbulo y strip de `/<id>` (X-2), filtrado de refs; FakeEngine con marcadores | Precedencia del catálogo |
| **F4e · Activación** | 5 | `features = BRIDGE_FEATURES`, fuera `rejectUnsupportedBody`; `main.ts`; aviso >1 GiB | — |
| **F5a · Borrador y adjuntos web** | 6 | `lib/attachments/*`, slice `drafts` (X-4), `useAttachmentDraft`, `AttachmentTray`, Composer (elegir/pegar/arrastrar, enviar sin texto) | Algoritmo de presupuesto y escalera |
| **F5b · Render y recarga** | 7 | `useAttachmentContent`, `AttachmentView`, Timeline y `PendingMessages` con adjuntos | — |
| **F5c · Menú y refs** | 8 | `MentionMenu`, `composer-refs.ts`, integración con `parseSlash` | Formato de inserción |
| **F5d · Gating y cierre** | 9 | UI condicionada a `features`, test de handshake sin features, e2e contra FakeEngine | — |

F5 puede arrancar contra FakeEngine apenas F4a y F4e estén en verde.

---

## 9. Registros SDD

- `sdd/api.json`, `sdd/schema.json`: sin cambios.
- `sdd/components.json` (`apps/studio`): COMP-007, 008, 009, 012, 013 siguen `defined` (el implementador
  front los pasa a `implemented`); `updated_in_cycle: 2` + changelog donde cambió el path (X-5):
  COMP-007 → `src/components/workspace/AttachmentTray.tsx`, COMP-009 →
  `src/components/workspace/MentionMenu.tsx`, COMP-012 → `src/lib/use-attachment-draft.ts`, COMP-013 →
  `src/lib/use-attachment-content.ts`. COMP-008 ya tenía el path correcto.

## 10. Riesgos del brief → resolución

| Riesgo | Resolución en este documento |
| --- | --- |
| R-C2-1 frame con PDFs | Pre-chequeo al agregar (§6.2), medición sobre el comando serializado completo, escalera solo de imágenes, error con exceso y los dos más pesados, `maxPayload = MAX_FRAME_BYTES` ya vigente, tests con PDF en el límite y 5 adjuntos. |
| R-C2-2 rutas | §3.2 (ruta solo del hash, `O_NOFOLLOW`, realpath, fstat, sha recalculado, `not-found` genérico) y §4 (normalización, exclusiones, secretos, no lee contenido, realpath del resultado, walk sin seguir symlinks). Tests en la misma task. |
| R-C2-3 crecimiento | Dedupe + re-encode; suma no bloqueante con aviso >1 GiB; `prune` fuera de alcance. |
| R-C2-4 web publicada | Sin bump; UI por `features` (§6.1); test de handshake sin features. |
| R-C2-5 watcher `.claude` | §5.3: función `ignored` que solo admite `agents/**` y `skills/**`, `depth: 3`. |
| Nuevo: carrera interrupt ↔ lectura de bytes | §3.5: revert de los mensajes tomados si el interrupt llega durante la resolución. |

## 11. Dependencias externas

Ninguna nueva. `@anthropic-ai/claude-agent-sdk` 0.3.292 (bloques `image`/`document` en `SDKUserMessage`),
`chokidar` ^4 (función `ignored`), `git` del sistema (opcional), `node:crypto`, `crypto.subtle`,
`createImageBitmap`/`OffscreenCanvas`.

## 12. Bloqueos

Ninguno.
