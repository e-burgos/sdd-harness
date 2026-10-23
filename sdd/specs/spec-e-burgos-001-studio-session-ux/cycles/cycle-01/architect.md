# Architect — Cycle 1: studio-session-ux

> **Input:** sdd/specs/spec-e-burgos-001-studio-session-ux/cycles/cycle-01/functional.md
> **Output:** sdd/specs/spec-e-burgos-001-studio-session-ux/cycles/cycle-01/architect.md
> **Generado por:** sdd-architect
> **Subproyectos:** `libs/studio-protocol` · `apps/studio-bridge` · `apps/studio`
> **Revisión:** 2026-10-23 (2ª) — corte en dos ciclos + HU-10 (mensajes pendientes sin interrumpir).
> **Base existente:** FIX-e-burgos-002 commiteado en `feat/studio-session-ux` (`bypassPermissions`).
> Este documento no lo modifica.

---

## 0. Alcance de este documento

### 0.1 Corte de ciclos

| | cycle-01 (este) | cycle-02 (siguiente, sin abrir) |
| --- | --- | --- |
| Historias implementadas | HU-4, HU-5, HU-6, HU-7, HU-8, HU-9, HU-10 | HU-1, HU-2, HU-3 |
| Protocolo | **Todo el protocolo de la spec**, un solo bump (`PROTOCOL_VERSION = 2`) | Ningún bump. Solo cambios aditivos y opcionales (R10) |
| Puente | Prompt streaming (canal de entrada vivo durante el turno), cola de pendientes, Always por regla, vínculo hilo↔ciclo/fix, catálogo mínimo (`source`/`path` de agentes, `skills: []`), fechas de fixes, handshake | Materializar adjuntos y mapearlos a bloques del SDK, `attachment.get`, `workspace.searchFiles`, catálogo completo + watcher de `.claude`, preámbulo de refs |
| Web | Sidebar (árbol, colapso, activos), indicadores, scroll, bandeja de pendientes, borrador de texto por hilo, `ThreadLinkPicker`, regla Always en `ApprovalCard`, guarda de frame en `client.ts` | Composer con adjuntos (re-encode siempre), menú `@`/`/`, render de adjuntos, borrador por hilo extendido a adjuntos |

Cada decisión de §1 lleva su etiqueta: **[C1]** se implementa en cycle-01; **[C2]** el contrato se
publica y testea con zod en cycle-01 y se implementa en cycle-02.

### 0.2 Cómo convive un puente de cycle-01 con contratos de cycle-02

`Welcome` suma `features: string[]` (opcional, aditivo). El puente de cycle-01 anuncia
`pending-messages`, `thread-link` y `always-rules`; el de cycle-02 agrega `attachments`,
`file-search` y `catalog`. La web muestra cada capacidad solo si el puente la anuncia. Un puente de
cycle-01 que recibe `attachments` o `refs` no vacíos, `workspace.searchFiles` o `attachment.get`
responde `bad-request` con `unsupported: <feature>`. Así cycle-02 no necesita otro bump aunque web y
puente se desfasen.

### 0.3 Qué no hay

- **Sin DB ni REST.** Los "contratos de API" son mensajes WebSocket validados con zod en
  `libs/studio-protocol`; los "schemas de datos" son esos tipos más los archivos de `.sdd-studio/` (§4).
- `sdd/api.json` y `sdd/schema.json` no se tocan: `api.schema.json` exige `method` HTTP y path; un
  comando WS ahí sería un registro falso. La fuente de verdad es este documento + `libs/studio-protocol`.
- `sdd/components.json` sí se actualiza (§7).

---

## 1. Decisiones técnicas

### D-01 · Un único bump: `PROTOCOL_VERSION` 1 → 2 [C1]

Todo el delta del protocolo de la spec entra en F1: adjuntos, refs, búsqueda, `attachment.get`,
catálogo, vínculo, oferta Always y mensajes pendientes. Se sube la versión una vez. Justificación:
`ThreadInfo.link`, `ThreadInfo.pendingCount` y `snapshot.skills` son requeridos en v2 y un cliente v1
no los entiende.

Handshake (`Hello` y `HandshakeError` nunca cambian de forma incompatible: son la negociación):

- `HandshakeError` suma `bridgeProtocolVersion` y `bridgeVersion` **opcionales** (un cliente v1 los ignora).
- Mensaje del puente: `protocol mismatch: web speaks ${hello.protocolVersion}, bridge speaks ${PROTOCOL_VERSION}`.
- Web v2 con `protocol-mismatch`: si `bridgeProtocolVersion > PROTOCOL_VERSION` → "La web es más vieja
  que el puente: recargá sin caché (Ctrl/Cmd+Shift+R)"; si es menor **o falta** (un puente v1 no lo
  envía) → "Actualizá el puente: `npx @e-burgos/sdd-studio@latest`" (texto ya existente en i18n).
- Release: puente (npm) y web (Cloudflare + UI local embebida) salen con el mismo tag.

### D-02 · Compatibilidad de lo persistido [C1]

Los JSONL viejos se reenvían por `thread.history`. Todo campo nuevo dentro de un `ThreadEvent` es
`.optional()` y los tipos de evento nuevos solo los produce un puente v2. `ThreadInfo.link` y
`pendingCount` son requeridos porque `threads.json` se migra al cargar (D-11, D-21).

### D-03 · Adjuntos: subida inline, referencia persistida [C2]

- Al enviar, cada adjunto va inline: imagen/PDF en base64, texto como string UTF-8.
- El puente valida, materializa en `.sdd-studio/attachments/<sha256>.<ext>` y emite `user.message` (o
  `pending.added`) con `AttachmentRef`, nunca binarios (RN-9).
- Tipos: `image/png|jpeg|webp|gif`, `application/pdf`, `text/plain|text/markdown`. El tipo texto se
  decide por extensión (`TEXT_ATTACHMENT_EXTENSIONS`, compartida) + `TextDecoder('utf-8', { fatal: true })`
  sin bytes NUL, porque el navegador reporta MIME basura para código (`.ts` → `video/mp2t`).
- El puente revalida por magic bytes (PNG `89 50 4E 47`, JPEG `FF D8 FF`, GIF `GIF87a|GIF89a`,
  WEBP `RIFF....WEBP`, PDF `%PDF-`) y UTF-8 para texto; discrepancia → `bad-request` con el nombre.
  No decodifica imágenes (sin dependencias nuevas): 1568 px es política del cliente.
- `text` pasa a `min(0)`: hace falta texto no vacío **o** al menos un adjunto (CA-002.4).

### D-04 · Presupuesto del frame y re-encode [C2, salvo la guarda genérica: C1]

- `MAX_FRAME_BYTES = 1_048_576` vive en el protocolo (el `maxPayload` del puente lo importa) y
  `FRAME_BUDGET_BYTES = MAX_FRAME_BYTES - 8_192`.
- Medición: bytes UTF-8 de `JSON.stringify(command)` sobre el comando completo tal cual se envía.
- **Re-encode siempre** de imágenes no GIF (decisión cerrada RF-20: quita EXIF/GPS), lado mayor
  ≤ 1568 px: origen JPEG → `image/jpeg` q 0.85; PNG/WebP → `image/webp` q 0.9 con fallback a
  `image/png` si el navegador no codifica WebP. `createImageBitmap` + `OffscreenCanvas` (fallback
  `<canvas>`). GIF ≤ 1568 px se envía tal cual (sin EXIF; conserva animación); mayor → primer cuadro estático.
- Si el comando excede el presupuesto: escalera solo sobre imágenes, la más pesada primero,
  `(1568, 0.85) → (1568, 0.7) → (1280, 0.7) → (1024, 0.6)`. Si no alcanza → error con exceso y los dos
  adjuntos más pesados; no se envía y el Composer conserva todo (RN-3, RN-5).
- **[C1]** Guarda genérica en `lib/bridge/client.ts`: `request()` mide todo comando y, si supera
  `MAX_FRAME_BYTES`, rechaza localmente con `Error('frame-too-large')` sin enviar (nunca 1009).

### D-05 · Servicio de adjuntos al recargar: comando `attachment.get` [C2]

No se reutiliza `workspace.readFile` (acotado a `sdd/` por `resolveSddPath`, devuelve `utf8`).
Request `{ sha256, mime }`; la ruta sale solo del hash validado (`^[a-f0-9]{64}$`) + `EXT_BY_MIME`,
realpath dentro de `.sdd-studio/attachments/`, archivo regular ≤ `MAX_FRAME_BYTES`, sha256
recalculado; si falla → `not-found`. Response `{ sha256, mime, data }` en base64. Web: caché LRU de 64
`objectURL`, pedidos perezosos con concurrencia 2, pre-carga desde la pestaña que envía (mismo sha256 vía
`crypto.subtle`). Faltante → "adjunto no disponible" (CA-003.3). Escritura atómica y dedupe por hash.

### D-06 · Prompt streaming del SDK con canal de entrada vivo [C1]

Evidencia en `@anthropic-ai/claude-agent-sdk` 0.3.292 (`node_modules/.pnpm/@anthropic-ai+claude-agent-sdk@0.3.292*/…`):

- `sdk.mjs`, `Query.streamInput`: `for await (const msg of stream) { …; this.runEnded = false; await transport.write(JSON + '\n') }`.
  Cada mensaje del iterable se escribe en el stdin del CLI **en orden y con await**, y reabre el run.
  Al agotarse el iterable, con necesidades bidireccionales (`canUseTool`/hooks, siempre presentes acá)
  espera `waitForRunEnd()` y recién entonces `transport.endInput()`. El modo string marca
  `isSingleUserTurn` y cierra stdin al fin del run.
- `sdk.d.ts:2861`: `interrupt()` es control request "only supported when streaming input/output is used"
  y resuelve `SDKControlInterruptResponse { still_queued: string[] }` (`sdk.d.ts:4635`) en CLIs con
  `interrupt_receipt_v1`.
- `sdk.d.ts:5736`, `SDKResultSuccess.user_message_uuids`: "Client uuids of every user message whose
  prompt this turn consumed … then any queued user message **folded into the running turn between
  tool rounds**". `queued_turn_count` (`sdk.d.ts:5722`): envíos aún en la cola del CLI al producir el result.
- `sdk.d.ts:959` y `PostToolBatchHookInput`: hook `PostToolBatch`, "Fired once after every tool call in a
  batch has resolved, **before the next model request**"; `agent_id` ausente = hilo principal.
- `SDKUserMessage.uuid?` (`sdk.d.ts:6346`) permite estampar nuestro id en cada mensaje.

Diseño:

- `QueryFn` pasa a `prompt: AsyncIterable<SDKUserMessage>` en **todos** los turnos (un solo camino).
- `engine/input-channel.ts`: iterable con `push(msgs)`, `end()` y `pushAndFlush(msgs)`, que resuelve
  cuando el SDK vuelve a pedir el siguiente elemento, es decir, cuando `transport.write` del anterior
  ya terminó.
- La query vive mientras haya trabajo: el canal **no** se cierra tras el primer mensaje. Al recibir cada
  `result` del hilo principal, el engine pide los pendientes (`collectPending('turn-end')`): si hay, los
  empuja (corren como el siguiente turno **en la misma query**, sin resume); si no hay y
  `queued_turn_count` es 0 o falta, `end()`. Con `end()` el SDK espera el fin del run y cierra stdin; el
  `for await` termina como hoy.
- `SDKUserMessage`: `{ type: 'user', message: { role: 'user', content }, parent_tool_use_id: null, session_id: '', uuid }`.
  `uuid` = id del mensaje en el puente (`pendingId` o el id del primer mensaje). Sin `priority` (sin
  semántica documentada en 0.3.292) y sin `client_composed` (D-10).
- Contenido en cycle-01: un bloque `text`. En cycle-02 se suman bloques `image`/`document`/`text` de
  adjuntos y el preámbulo de refs: preámbulo → adjuntos → texto del dev (o `Attachments: …` si está vacío).
- Interrupt: `const receipt = await q.interrupt()`; si `receipt?.still_queued` trae uuids nuestros,
  esos mensajes **no llegaron al modelo**: el engine los informa (`revertPending`, D-21) y llama a
  `abort.abort()` para que el CLI no los corra como turno nuevo después del interrupt. Luego
  `end()`. Se conserva el `catch → abort` actual.
- Resume: sin cambios (`options.resume`) para el primer mensaje de cada query nueva.

### D-07 · FakeEngine [C1]

- Recibe `input.prompts` (§3). Los marcadores se leen del texto del primer prompt (`#sub`, `#tool`,
  `#edit`, `#slow`, `#fail` se conservan); el eco `echo: ${text}` no cambia.
- Simula puntos de corte: `#steps:N` corre N rondas de una herramienta sin aprobación (`Read`), cada una
  de `delayMs * 20`; tras cada ronda llama `collectPending('cut-point')` y, si recibe mensajes, emite
  un mensaje del agente `heard: <texto>` en la ronda siguiente. Al terminar llama
  `collectPending('turn-end')` y, si hay, corre otro turno de eco dentro del mismo `EngineTurn`.
- `#revert` hace que el próximo `interrupt()` reporte como no entregado el último lote recibido
  (prueba de `pending.reverted`).
- Marcadores para Always: `#mcp` (`mcp__fake__ping`), `#edit-tool` (`Edit` sobre `apps/y.ts`),
  `#bash-git` (`git status --short`), `#bash-git2` (`git status`), `#bash-chain`
  (`git status && rm -rf x`). En cycle-02: ` [attachments: …]` y ` [refs: …]` en el eco y
  `#bad-attachment`.

### D-08 · `@archivo`: comando `workspace.searchFiles` [C2]

Índice en el puente, cacheado 15 s: `git ls-files -z --cached --others --exclude-standard` (respeta
`.gitignore`), timeout 5 s, máx. 100 000 entradas; fallback sin git: BFS profundidad ≤ 12 y ≤ 50 000
entradas. Exclusiones siempre: `.git`, `node_modules`, `.sdd-studio`, `.nx`, `.next`, `dist`,
`coverage`, `.claude/worktrees/`; secretos por basename `^\.env(\..+)?$` salvo
`.env.example|.sample|.template`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.keystore`, `id_rsa*`,
`id_ed25519*`, `.npmrc`, `.netrc`. Solo rutas relativas POSIX normalizadas; **no lee contenido**.
Ranking: prefijo del basename > substring del basename > substring de ruta > subsecuencia; empate →
ruta más corta. `limit` 30 (máx. 50), `truncated`. Web: debounce 120 ms, descarta respuestas viejas,
inserta la **ruta sin `@`** (el CLI no expande contenido, RN-13).

### D-09 · Catálogo de agentes, skills y prompts [contrato C1, descubrimiento completo C2]

- Viaja en el snapshot (refresco por `workspace.changed`); `AREA_FIELDS.agents = ['agents', 'skills']`.
- **[C1]** `AgentSummary` suma `source` y `path`, que el `loadAgents` actual ya puede llenar
  (`source: 'sdd'`); `skills: []`.
- **[C2]** Fuentes por precedencia (primera gana por `id`; dedupe además por realpath, porque
  `.claude/agents → ../sdd/agents` y `.claude/skills → ../sdd/skills` en este repo):
  `.claude/agents/*.md`, `sdd/agents/*.agent.md`, `.claude/skills/*/SKILL.md`, `sdd/skills/*/SKILL.md`,
  `sdd/prompts/*.prompt.md` (kind `prompt`). Directorios resueltos dentro del root; caps 200 por tipo,
  descripción ≤ 300. Watcher: segundo `chokidar.watch` sobre `.claude` con `ignored` que solo deja
  `.claude/agents/**` y `.claude/skills/**`, `depth: 3`. **Nunca vigilar `.claude/` entero**
  (`.claude/worktrees/` contiene copias del repo).
- Menú `/`: grupo Comandos (los fijos de `slash.ts`, intactos, RN-17) y grupo Skills y prompts
  (catálogo, sin los prompts ya cubiertos por `PROMPT_COMMANDS`). Menú `@`: Archivos y Agentes.

### D-10 · `@agente` y `/skill`: refs estructuradas, preámbulo del puente [C2]

La web envía `refs: { agents, skills }` (máx. 5 c/u): tokens `@<id>` de agentes del catálogo (quedan
en el texto) y el `/<id>` inicial que sea skill/prompt del catálogo y no comando fijo (se quita del
texto). `/<id>` desconocido → "comando desconocido" como hoy. El puente revalida contra su snapshot
y descarta en silencio las refs inexistentes (CA-005.7). Preámbulo, primer bloque de texto:
`Delegate this task to the subagent "<id>" using the Agent tool.` ·
`Use the skill "<id>" (<path>) for this task.` · `Follow the instructions in <path>.`
**`client_composed` no se usa** (default confirmado): desactivaría el contexto inicial del turno
(CLAUDE.md anidados, listado de skills), que `/skill` necesita.

### D-11 · Vínculo hilo ↔ spec/ciclo | fix [C1]

- `ThreadInfo.link = { target: cycle {specId, cycle} | fix {fixId} | none, source: auto | manual | legacy }`.
  Navegacional: no afecta gate, write scope ni cola.
- Auto-asignación en `createThread`: (1) `link` explícito válido → `manual`; (2) canal `spec:<id>` →
  ciclo `in-progress` de esa spec (el de número mayor si hay varios), si no y hay **exactamente un**
  fix abierto con ese `spec_id` → ese fix, si no `none`; (3) canal `fixes` → el único fix abierto o
  `none`; (4) `general` y `dm:*` → `none`. Fix abierto = `pending | in-progress` (igual que `gate/judge.ts`).
- `thread.setLink { threadId, link }` → `ThreadInfo`, `source: manual`, `thread.updated` a todas las
  pestañas. Destino: cualquier ciclo o fix del snapshot (incluidos cerrados) o `none`. Inexistente →
  `not-found` y el vínculo previo queda.
- Migración: `ThreadStore.init()` completa los hilos sin `link` con `{ target: { kind: 'none' }, source: 'legacy' }`.

### D-12 · Fixes cerrados visibles: los 5 más recientes [C1]

Abiertos + 5 cerrados por `closedAt` desc (`resolved_at ?? validated_at`), luego `createdAt` desc,
luego id desc. Los cerrados fuera del top 5 **que tengan conversaciones** van a un nodo colapsado
"Fixes anteriores (n)": ningún hilo desaparece (RN-24). `FixSummary` suma `createdAt` y `closedAt`.

### D-13 · Ubicación de cada hilo en el Sidebar [C1]

`spec:*` sale de CANALES (decisión cerrada RF-18); el nombre de la spec en SPECS abre su canal y el
caret colapsa/expande. CANALES queda con `general` y `fixes`. Cada hilo aparece una sola vez:

| `link.target` | Canal | Lugar |
| --- | --- | --- |
| `cycle` | cualquiera | SPECS › spec › ciclo |
| `fix` visible | cualquiera | FIXES › fix |
| `fix` fuera del top 5 | cualquiera | FIXES › Fixes anteriores › fix |
| `none` | `spec:<id>` | SPECS › spec › "Sin ciclo" |
| `none` | `general` / `fixes` | CANALES › canal |
| `none` | `dm:<agente>` | AGENTES › agente |

### D-14 · "Always" por regla [C1]

- `sessions/always-rule.ts` reemplaza `alwaysKeyOf`: `Edit | Write | MultiEdit | NotebookEdit` →
  `{ kind: 'tool', tool }`; `mcp__<srv>__<tool>` → `{ kind: 'mcp', tool }` con el nombre completo;
  `Bash` → `{ kind: 'bash-prefix', prefix }`; resto → `{ kind: 'tool', tool }` (como hoy).
  `Live.alwaysAllow` pasa a `AlwaysRule[]` con `matchesRule`.
- **Prefijo Bash** (determinista, conservador):
  1. Comando **simple**: sin `\n`, `;`, `&`, `|`, `` ` ``, `$(`, `<`, `>`, `(`, `)`, `{`, `}`. Si no → no calculable.
  2. Tokens por espacios con comillas simples/dobles sin escapes; desbalanceadas → no calculable.
  3. Primer token tipo asignación (`^[A-Za-z_][A-Za-z0-9_]*=`) → no calculable.
  4. Programa = primer token (`^[A-Za-z0-9._/-]+$`); envoltorios (`sudo`, `env`, `bash`, `sh`, `zsh`,
     `eval`, `exec`, `xargs`, `nohup`, `time`, `command`, `npx`, `pnpx`, `bunx`) → no calculable.
  5. Prefijo = programa + hasta 2 tokens que matcheen `^[a-z][a-z0-9:_-]*$`.
  6. Coincidencia: el candidato también debe ser simple y empezar con los mismos tokens; por eso
     `git status && rm -rf x` nunca matchea `git status`.

  | Comando | Prefijo |
  | --- | --- |
  | `git status --short` | `git status` |
  | `pnpm nx run-many -t lint` | `pnpm nx run-many` |
  | `pnpm sdd:validate` | `pnpm sdd:validate` |
  | `ls -la apps` | `ls` |
  | `./gradlew build` | `./gradlew build` |
  | `npx vitest run` | no calculable |
  | `git log \| head` | no calculable |

- Gate inviolable: `deny` se anuncia y bloquea antes de mirar reglas; `warn` siempre crea tarjeta.
  **Hueco actual corregido:** hoy `PendingApproval.alwaysKey` se calcula aunque haya `gateWarning`, y
  Always sobre una tarjeta `warn` guarda una regla que silencia la próxima edición sin warn. En v2, con
  `gateWarning` no se guarda regla.
- Tarjeta `warn` o regla no calculable: `always: { kind: 'none', reason }`; la tarjeta **no muestra
  el botón Always** y explica por qué. El efecto es el que propone el functional (CA-009.3: se aprueba
  solo esa acción), sin un botón que prometa recordar algo (CA-008.4). `scope: 'thread'` recibido
  igual se trata como `once`.
- `approval.requested.always` lo calcula el puente; la web solo lo formatea con i18n.
  `approval.resolved.remembered` informa la regla guardada. No se usan
  `suggestions`/`updatedPermissions` del SDK: saltean `canUseTool`, tienen otra semántica de prefijo y
  sobreviven al hilo.

### D-15 · Sidebar: árbol colapsable con persistencia [C1]

- `lib/store/nav-tree.ts` (puro): `buildNavTree(snapshot, threads, view) → NavSection[]`. Secciones:
  HILOS ACTIVOS, CANALES, SPECS, FIXES, AGENTES. Ids de nodo = claves de colapso:
  `section:{active|channels|specs|fixes|agents}`, `channel:<id>`, `spec:<id>`, `spec-none:<id>`,
  `cycle:<specId>/<cycle>`, `fix:<id>`, `fixes:older`, `dm:<agent>`.
- Orden: specs `in-progress` primero y luego por id (completadas incluidas); ciclos por número desc;
  hilos por `lastActivity` desc, 25 visibles por nodo y "mostrar más" inline.
- Defaults: secciones expandidas; spec/ciclo `in-progress` expandidos; cerrados colapsados; fixes
  abiertos expandidos; `fixes:older` colapsado.
- `useCollapsedState`: `localStorage` `sdd-studio.sidebar.v1:<project>`, `{ [nodeId]: boolean }` solo con
  overrides; validado con zod; inválido → defaults sin error (CE-17); poda a 500; sync por evento
  `storage`. Sin dependencias nuevas.
- Nodos colapsados exponen `containsSelection` y `needsAttention` (algún descendiente
  `waiting-approval`), calculados en `buildNavTree` (CA-007.3, CA-007.5). Encabezados
  `<button aria-expanded aria-controls>`; ←/→ colapsan/expanden.
- Navegación: `useState` en `Workspace.tsx`; abrir un hilo fija `channelId = thread.channelId`. Sin
  routing por URL.
- `ThreadLinkPicker` en el header de `ThreadView` llama a `thread.setLink` y muestra el error (CA-006.11).

### D-16 · Hilos activos [C1]

`activeThreads(threads)`: `waiting-approval`, `running`, `queued` (SessionStatus), en ese orden y luego
`lastActivity` desc. Sin conexión: "Estado posiblemente desactualizado" y atenuado (CA-010.7). La fila
muestra `pendingCount` si es > 0 (insignia "n pendientes").

### D-17 · Indicadores de trabajo [C1]

`ActivityIndicator({ status, placement: 'row' | 'avatar' | 'thread' })`: `running` = typing dots
(anillo giratorio en avatar); `waiting-approval` = ícono escudo/pausa estático; `queued` = reloj
estático; otro → nada. Sin layout shift: slot fijo `w-4` en filas, insignia `absolute` en el avatar,
fila de alto fijo al final del timeline. Animaciones solo con `motion-safe:animate-*`; se corrige
`Sidebar.tsx:14` (`animate-pulse` sin variante de movimiento reducido). `AgentAvatar` recibe `status?`.

### D-18 · Scroll: causas encontradas y solución [C1]

| # | Dónde | Causa | Efecto | Solución |
| --- | --- | --- | --- | --- |
| S1 | `ThreadView.tsx:40-44` | El autoscroll depende solo de `items.length`; `message.delta` cambia el texto del último ítem sin cambiar la cantidad. | No sigue el streaming ni contenido que crece después (imágenes) — CA-012.1. | `useStickToBottom`: `ResizeObserver` sobre contenido y scroller; si `stick`, al fondo en cada cambio de tamaño. |
| S2 | `Workspace.tsx:36` + `ThreadView.tsx:22` | `ThreadView` sin `key={threadId}`: `stick` y `count` sobreviven al cambio de hilo. | Abrir otro hilo no posiciona al final — CA-012.4. | `key={threadId}` + scroll al fondo cuando `synced` pasa a `true`. |
| S3 | `ThreadView.tsx:36-39` | `stick` solo cambia en `onScroll`; no hay control para volver ni se fuerza al enviar. | CA-012.2 y CA-012.3. | `JumpToLatest` si `!atBottom`; un ítem `user` nuevo fuerza `stick = true`; umbral 120 → 48 px. |
| S4 | `Sidebar.tsx:49` | El `<nav>` entero es el scroller; el header (líneas 50-60) se va con el árbol. | CA-012.5. | `nav` `flex h-full min-h-0 flex-col`; header y pie `shrink-0`; árbol en `div` `min-h-0 flex-1 overflow-y-auto`. |
| S5 | `Workspace.tsx:32` | Grid sin filas explícitas (depende del estiramiento de la fila `auto`). | Riesgo, no bug reproducido. | `grid-rows-[minmax(0,1fr)]`. |
| S6 | `Composer.tsx:73` | `resize-y` del textarea (y ahora la bandeja de pendientes) achica el scroller sin evento de scroll. | El final queda tapado. | Lo cubre S1 (observer sobre el scroller). |

`ChannelView.tsx:47` y `RightPanel.tsx:20` ya son un único scroller; los `pre` con `max-h-* overflow-auto`
(`Timeline.tsx:38`, `ApprovalCard.tsx:55,58,64`) son scroll interno intencional. jsdom no trae
`ResizeObserver`: polyfill en el setup de vitest. El implementador reproduce y registra cada caso
antes de corregir (CA-012.7).

### D-19 · Crecimiento de `.sdd-studio/attachments` [C2]

No se borra nada (RN-12). Dedupe por hash + re-encode. Al iniciar, el puente suma tamaños sin bloquear
y loguea un aviso por encima de 1 GiB. La limpieza (`sdd-studio prune`) queda para un ciclo posterior.

### D-20 · Concurrencia en `SessionManager` [C1]

`send` deja de lanzar `conflict` por hilo ocupado (D-21). Toda decisión "iniciar turno / agregar
pendiente / entregar en corte" es **síncrona** en el puente (sin `await` entre el chequeo y la mutación).
En cycle-02, donde materializar adjuntos es asíncrono, el hilo se reserva (`Live.accepting`) antes del
primer `await` y los adjuntos se escriben antes de crear el hilo en `createThread` (CE-8).

### D-21 · HU-10: mensajes pendientes sin interrumpir [C1]

**Nombre en protocolo y UI: "pendiente" (`pending.*`).** No se usa "queued" para no confundirlo con
`SessionStatus.queued`, que es un **hilo** esperando el write scope de su canal. Copy de UI: "Pendiente"
/ "Entregado" para mensajes; "En cola (esperando turno de escritura)" para el estado del hilo.

**Fuente de verdad: el puente.** Los pendientes se guardan en el puente y **no se empujan al SDK hasta
el punto de corte**. Mientras estén en el puente, editar y quitar son operaciones locales sin carrera
con el CLI, así que no hace falta `cancelAsyncMessage`: existe en `sdk.mjs` pero no está en la
interfaz `Query` de `sdk.d.ts`.

**Punto de corte y urgencia (mecanismo elegido).** Se registra un hook **`PostToolBatch`** (solo hilo
principal: `agent_id` ausente). El SDK lo dispara una vez cuando resolvieron **todas** las tool calls
de la ronda, incluidas las denegadas, **antes del siguiente request al modelo**. En el callback:

1. `collectPending('cut-point')` toma **todos** los pendientes de forma síncrona y los pasa a
   entregados: emite `user.message { pendingId, delivery: 'cut-point' }` por cada uno, en orden.
2. `await channel.pushAndFlush(msgs)` escribe los `SDKUserMessage` (con `uuid = pendingId`) en el stdin
   del CLI.
3. Recién entonces devuelve la salida del hook.

Como `streamInput` escribe con `await` y en orden, las líneas del mensaje preceden en stdin a la
respuesta del hook. El CLI ya tiene el mensaje en su cola cuando cierra la ronda, y lo pliega "into
the running turn between tool rounds" (`user_message_uuids`). Resultado: el modelo lo lee en el
**request siguiente al tool en curso**, no al final del turno (CA-013).

- **Verificación obligatoria (primer task de F2, spike e2e con el SDK real):** turno haiku/low que
  ejecuta dos rondas de tools; empujar un pendiente en el primer `PostToolBatch` y afirmar que su uuid
  aparece en `user_message_uuids` **del mismo `result`** que el prompt inicial, y que la respuesta lo
  contempla.
- **Fallback si el spike falla** (el CLI no pliega a tiempo): mismo hook, pero el texto viaja en
  `hookSpecificOutput.additionalContext` de `PostToolBatch` ("Reaches the model … before the next model
  request"), con el envoltorio `Message from the user, sent while you were working:\n<texto>`. Llega
  garantizado en el próximo request; limitación: solo texto (en cycle-02 los adjuntos de un pendiente
  irían en el siguiente turno). El engine expone un `deliveryMode: 'stream' | 'hook-context'` interno y
  el spike decide el default. El protocolo no cambia.
- **Sin tool en curso** (el modelo responde sin herramientas): no hay `PostToolBatch`. Los pendientes
  se entregan al `result` como siguiente turno de la misma query (`delivery: 'next-turn'`, D-06).
- **Subagentes:** el `PostToolBatch` de un subagente (`agent_id` presente) no entrega. El pendiente llega
  al terminar la ronda del hilo principal que contiene el tool `Agent`, igual que la cola de Claude Code.

| Situación | Comportamiento |
| --- | --- |
| Hilo sin turno, sin pendientes | `thread.send` inicia el turno como hoy (o pasa a `queued` por write scope) → `{ delivery: 'started' }` |
| `running` / `waiting-approval` / `queued` | `thread.send` agrega un pendiente → `pending.added` → `{ delivery: 'pending', pendingId }` |
| `waiting-approval` | Resolver la aprobación **no** entrega: tras el tool aprobado o denegado cierra la ronda → `PostToolBatch` → entrega |
| `queued` (write scope) | El turno arranca con su prompt original; los pendientes se entregan en sus cortes |
| Fin normal del turno con pendientes | Entrega al `result` (`next-turn`). Carrera: si llegan después de `end()`, `finish()` ve pendientes y arranca un turno nuevo con ellos (`next-turn`, con resume) |
| `thread.interrupt` | Los pendientes **siguen pendientes y visibles; no se auto-envían**. Los entregados que el recibo de interrupt lista en `still_queued` vuelven a pendientes (`pending.reverted`) y se aborta el proceso para que no corran |
| Error del turno | Los pendientes quedan; no se auto-envían (evita repetir el error en bucle) |
| Hilo `idle`/`interrupted`/`error` con pendientes | `thread.send` arranca un turno con los pendientes en orden + el mensaje nuevo (todos `next-turn`); `thread.pending.flush` hace lo mismo sin mensaje nuevo |
| Reinicio del puente | Los pendientes se recargan de `threads.json`; el hilo queda `interrupted` (recover actual); no se auto-envían |
| Editar / quitar | Solo `pending`: `thread.pending.edit` / `.remove`. Si ya se entregó → `conflict` "already delivered" (CA-014). El puente es secuencial: la toma del corte y la edición nunca se intercalan |

- Límite: `MAX_PENDING_PER_THREAD = 10`; el 11º → `conflict` "too many pending messages".
- `ThreadInfo.pendingCount` se actualiza con `thread.updated` en cada alta, baja o entrega.
- Sin pérdida ni duplicado (RNF-7): un pendiente se borra del puente **solo** al emitir su `user.message`
  de entrega o al quitarlo; el revert lo devuelve. Cada `pendingId` produce como máximo un
  `user.message` vigente: si hubo revert, la web marca el anterior como "no llegó al modelo".

---

## 2. Contratos del protocolo (`libs/studio-protocol`) — todos se publican en F1

> Snippets normativos: formas, límites y nombres. Todo lo exportado lleva su `type X = z.infer<typeof X>`.

### 2.1 `version.ts` · `limits.ts` (nuevo)

```ts
export const PROTOCOL_VERSION = 2;
```

```ts
export const MAX_FRAME_BYTES = 1_048_576;
export const FRAME_BUDGET_BYTES = MAX_FRAME_BYTES - 8_192;
export const MAX_ATTACHMENTS = 5;
export const IMAGE_MAX_SIDE = 1568;
export const MAX_PROMPT_REFS = 5;
export const FILE_SEARCH_MAX = 50;
export const MAX_PENDING_PER_THREAD = 10;
export const BRIDGE_FEATURES = ['pending-messages', 'thread-link', 'always-rules', 'attachments', 'file-search', 'catalog'] as const;
export const TEXT_ATTACHMENT_EXTENSIONS = [
  'txt', 'md', 'mdx', 'markdown', 'json', 'jsonc', 'yaml', 'yml', 'toml', 'ini', 'csv', 'log', 'diff', 'patch',
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'css', 'scss', 'html', 'xml', 'svg', 'sql', 'sh', 'py', 'java',
  'kt', 'go', 'rs', 'rb', 'php', 'c', 'h', 'cpp', 'cs', 'swift', 'gradle', 'properties',
] as const;
```

### 2.2 `handshake.ts`

```ts
export const Welcome = z.object({
  kind: z.literal('welcome'),
  protocolVersion: z.number().int(),
  bridgeVersion: z.string(),
  workspace: z.object({ root: z.string(), project: z.string() }),
  kitVersion: z.string().nullable(),
  authMode: AuthMode,
  features: z.array(z.string().max(40)).max(32).optional(),
});

export const HandshakeError = z.object({
  kind: z.literal('handshake.error'),
  code: HandshakeErrorCode,
  message: z.string(),
  bridgeProtocolVersion: z.number().int().optional(),
  bridgeVersion: z.string().max(64).optional(),
});
```

`features` es `string[]` y no un enum, para que un puente más nuevo no rompa a una web más vieja.

### 2.3 `attachments.ts` (nuevo) [contratos de C2]

```ts
export const ImageMime = z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
export const TextMime = z.enum(['text/plain', 'text/markdown']);
export const AttachmentMime = z.union([ImageMime, z.literal('application/pdf'), TextMime]);
export const EXT_BY_MIME = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
  'application/pdf': 'pdf', 'text/plain': 'txt', 'text/markdown': 'md',
} as const;

export const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const DisplayName = z.string().min(1).max(255);
const Base64 = z.base64().max(MAX_FRAME_BYTES);
const Dim = z.number().int().min(1).max(IMAGE_MAX_SIDE);

export const AttachmentUpload = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('image'), name: DisplayName, mime: ImageMime, data: Base64, width: Dim, height: Dim }),
  z.object({ kind: z.literal('pdf'), name: DisplayName, mime: z.literal('application/pdf'), data: Base64 }),
  z.object({ kind: z.literal('text'), name: DisplayName, mime: TextMime, text: z.string().min(1).max(MAX_FRAME_BYTES) }),
]);

export const AttachmentRef = z.object({
  sha256: Sha256,
  kind: z.enum(['image', 'pdf', 'text']),
  mime: AttachmentMime,
  name: DisplayName,
  size: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const CatalogId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/);
export const PromptRefs = z.object({
  agents: z.array(AgentId).max(MAX_PROMPT_REFS),
  skills: z.array(CatalogId).max(MAX_PROMPT_REFS),
});

export const AttachmentContent = z.object({ sha256: Sha256, mime: AttachmentMime, data: z.base64() });
```

`name` es solo para mostrar: nunca construye rutas. `size` = bytes almacenados.

### 2.4 `domain.ts`

```ts
export const SpecIdValue = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
export const CycleIdValue = z.string().regex(/^cycle-\d{2}$/);
export const FixIdValue = z.string().regex(/^FIX-[A-Za-z0-9._-]{1,96}$/);

export const ThreadLinkTarget = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('cycle'), specId: SpecIdValue, cycle: CycleIdValue }),
  z.object({ kind: z.literal('fix'), fixId: FixIdValue }),
  z.object({ kind: z.literal('none') }),
]);
export const ThreadLink = z.object({ target: ThreadLinkTarget, source: z.enum(['auto', 'manual', 'legacy']) });

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
});

export const AlwaysRule = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('tool'), tool: z.string().min(1).max(128) }),
  z.object({ kind: z.literal('mcp'), tool: z.string().regex(/^mcp__.+__.+$/).max(256) }),
  z.object({ kind: z.literal('bash-prefix'), prefix: z.string().min(1).max(256) }),
]);
export const AlwaysOffer = z.union([
  AlwaysRule,
  z.object({ kind: z.literal('none'), reason: z.enum(['gate-warning', 'not-calculable']) }),
]);
```

`PermissionModeChoice` queda como lo dejó FIX-e-burgos-002.

### 2.5 `commands.ts`

```ts
const MessageBody = {
  text: z.string().max(100_000),
  attachments: z.array(AttachmentUpload).max(MAX_ATTACHMENTS).default([]),
  refs: PromptRefs.default({ agents: [], skills: [] }),
};
const hasContent = (m: { text: string; attachments: unknown[] }) => m.text.trim().length > 0 || m.attachments.length > 0;

z.object({ ...cmd('thread.create'), channelId: ChannelId, options: ThreadOptions, link: ThreadLinkTarget.optional(), ...MessageBody })
  .refine(hasContent, { message: 'text or attachments required', path: ['text'] }),
z.object({ ...cmd('thread.send'), threadId: Id, ...MessageBody })
  .refine(hasContent, { message: 'text or attachments required', path: ['text'] }),
z.object({ ...cmd('thread.pending.edit'), threadId: Id, pendingId: Id, text: z.string().max(100_000) }),
z.object({ ...cmd('thread.pending.remove'), threadId: Id, pendingId: Id }),
z.object({ ...cmd('thread.pending.flush'), threadId: Id }),
z.object({ ...cmd('thread.setLink'), threadId: Id, link: ThreadLinkTarget }),
z.object({ ...cmd('workspace.searchFiles'), query: z.string().max(200), limit: z.number().int().min(1).max(FILE_SEARCH_MAX).default(30) }),
z.object({ ...cmd('attachment.get'), sha256: Sha256, mime: AttachmentMime }),
```

Esquemas de resultado exportados:

```ts
export const SendResult = z.discriminatedUnion('delivery', [
  z.object({ delivery: z.literal('started') }),
  z.object({ delivery: z.literal('pending'), pendingId: z.string().min(1) }),
]);
export const FileSearchResult = z.object({
  query: z.string(),
  files: z.array(z.object({ path: z.string().min(1).max(1024) })).max(FILE_SEARCH_MAX),
  truncated: z.boolean(),
  source: z.enum(['git', 'walk']),
});
```

| Comando | Fase | Response `data` | Errores |
| --- | --- | --- | --- |
| `thread.create` | C1 (adjuntos/refs: C2) | `ThreadInfo` | `bad-request` (validación, DM con otro agente, `unsupported: attachments` en un puente C1), `not-found` (`link`), `internal` (C2: adjunto no guardado → el hilo no se crea) |
| `thread.send` | C1 (adjuntos/refs: C2) | `SendResult` | `bad-request`, `not-found`, `conflict` (11º pendiente), `internal` (C2) |
| `thread.pending.edit` | C1 | `null` | `not-found` (hilo o pendiente), `conflict` (ya entregado), `bad-request` (texto vacío sin adjuntos) |
| `thread.pending.remove` | C1 | `null` | `not-found`, `conflict` (ya entregado) |
| `thread.pending.flush` | C1 | `SendResult` (`started`) | `not-found`, `conflict` (hilo `running`/`waiting-approval`: se entregan en el próximo corte; o sin pendientes) |
| `thread.setLink` | C1 | `ThreadInfo` | `not-found` (hilo o destino), `bad-request` |
| `workspace.searchFiles` | C2 | `FileSearchResult` | `internal` (índice no disponible) · C1: `bad-request` `unsupported: file-search` |
| `attachment.get` | C2 | `AttachmentContent` | `not-found`, `bad-request` · C1: `bad-request` `unsupported: attachments` |

`ErrorCode` no cambia. `workspace.readFile`, `command.run`, `approval.respond` (`once | thread`),
`auth.set` y el resto quedan iguales. `thread.send` ya no responde `conflict` por hilo ocupado.

### 2.6 `events.ts`

```ts
z.object({
  type: z.literal('user.message'),
  text: z.string(),
  attachments: z.array(AttachmentRef).max(MAX_ATTACHMENTS).optional(),
  refs: PromptRefs.optional(),
  pendingId: z.string().optional(),
  delivery: z.enum(['cut-point', 'next-turn']).optional(),
}),
z.object({
  type: z.literal('pending.added'),
  pendingId: z.string(),
  text: z.string(),
  attachments: z.array(AttachmentRef).max(MAX_ATTACHMENTS).optional(),
  refs: PromptRefs.optional(),
}),
z.object({ type: z.literal('pending.edited'), pendingId: z.string(), text: z.string() }),
z.object({ type: z.literal('pending.removed'), pendingId: z.string() }),
z.object({ type: z.literal('pending.reverted'), pendingId: z.string(), reason: z.literal('interrupt') }),
z.object({
  type: z.literal('approval.requested'),
  approvalId: z.string(),
  author: Author,
  tool: z.string(),
  summary: z.string(),
  diff: z.string().optional(),
  input: z.string().optional(),
  inputTruncated: z.boolean().optional(),
  gateWarning: z.string().optional(),
  always: AlwaysOffer.optional(),
}),
z.object({
  type: z.literal('approval.resolved'),
  approvalId: z.string(),
  decision: z.enum(['allow', 'deny']),
  reason: z.string().optional(),
  remembered: AlwaysRule.optional(),
}),
```

Un `user.message` sin `pendingId` es el mensaje que inicia un turno, como hoy. Con `pendingId`, cierra
el pendiente en la web: lo saca de la bandeja y lo ubica en el timeline donde se entregó.

### 2.7 `snapshot.ts`

```ts
export const CatalogSource = z.enum(['claude', 'sdd']);
export const AgentSummary = z.object({
  id: z.string(),
  description: z.string(),
  model: z.string().nullable(),
  source: CatalogSource,
  path: z.string(),
});
export const SkillSummary = z.object({
  id: CatalogId,
  kind: z.enum(['skill', 'prompt']),
  description: z.string().max(300),
  source: CatalogSource,
  path: z.string(),
});
export const FixSummary = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  severity: z.string().nullable(),
  specId: z.string().nullable(),
  createdAt: z.string().nullable(),
  closedAt: z.string().nullable(),
});
```

`WorkspaceSnapshot` suma `skills: z.array(SkillSummary)` (vacío en el puente de cycle-01).

---

## 3. Contratos internos del puente (`apps/studio-bridge`)

| Módulo | Contrato | Fase |
| --- | --- | --- |
| `engine/types.ts` | `EngineTurnInput.text` → `prompts: OutgoingMessage[]` con `OutgoingMessage = { id: string; prompt: TurnPrompt }`, `TurnPrompt = { text: string; preamble: string[]; blocks: PromptBlock[] }` (`preamble`/`blocks` vacíos en C1). `EngineCallbacks` suma `collectPending(at: 'cut-point' \| 'turn-end'): OutgoingMessage[]` y `revertPending(ids: string[]): void`. Sin tipos del SDK en la frontera. | C1 |
| `engine/input-channel.ts` (nuevo) | `InputChannel<T>`: `AsyncIterable<T>` con `push`, `pushAndFlush` (resuelve cuando el consumidor pide el siguiente) y `end`. | C1 |
| `engine/prompt-content.ts` (nuevo) | `toSdkUserMessage(message: OutgoingMessage): SDKUserMessage` (`uuid = id`). Bloques de adjuntos y preámbulo en C2. | C1 / C2 |
| `engine/claude-sdk-engine.ts` | `QueryFn` con `prompt: AsyncIterable<SDKUserMessage>`; hook `PostToolBatch` (main thread) para entregar; al `result`, entregar o `end()`; interrupt con recibo → `revertPending` + abort; `deliveryMode` interno (D-21). El bloque `bypass` de FIX-002 se conserva. | C1 |
| `engine/fake-engine.ts` | D-07. | C1 |
| `sessions/session-manager.ts` | `send` → `SendResult`; `editPending`, `removePending`, `flushPending`; `collectPending` / `revertPending`; `finish()` auto-entrega solo si el fin fue normal; `setLink`; `assignLink` puro y exportado; D-14. | C1 |
| `sessions/always-rule.ts` (nuevo) | `alwaysOfferOf(toolName, input, gateWarning?)`, `bashPrefixOf(command)`, `matchesRule(rule, toolName, input)`. | C1 |
| `sessions/store.ts` | `StoredThread` suma `pending: PendingMessage[]` (interno; `toInfo` lo quita y expone `pendingCount`); migración de `link` y `pending` en `init()`. | C1 |
| `sessions/attachment-store.ts` (nuevo) | `put(upload)`, `read(sha256, mime)`. | C2 |
| `workspace/file-index.ts` (nuevo) | `search(query, limit)`. | C2 |
| `workspace/catalog.ts` (nuevo) | `loadCatalog(root)`; reemplaza `loadAgents`. En C1 solo se agregan `source`/`path` al loader actual. | C2 (C1 parcial) |
| `workspace/snapshot.ts` · `watcher.ts` | `skills`, `AREA_FIELDS.agents`, fechas de fixes (C1); watcher de `.claude` (C2). | C1 / C2 |
| `server/router.ts` | Casos nuevos de §2.5; los de C2 responden `unsupported` en C1. | C1 |
| `server/ws-server.ts` | `maxPayload: MAX_FRAME_BYTES` del protocolo; `Welcome.features`; `HandshakeError` con versiones. | C1 |

---

## 4. Persistencia en `.sdd-studio/`

```text
.sdd-studio/
├── .gitignore                      "*" (ya existe)
├── threads.json                    StoredThread[] = ThreadInfo (+ link) + engineSessionId + pending[]
├── threads/<threadId>.jsonl        { seq, event: ThreadEvent }: user.message, pending.*, approval.* …, sin binarios
├── channels/<channel>.jsonl        BotEvent (sin cambios)
└── attachments/<sha256>.<ext>      [C2] bytes exactos; ext ∈ png|jpg|webp|gif|pdf|txt|md; inmutable; deduplicado
```

| Archivo | Cambio | Compatibilidad |
| --- | --- | --- |
| `threads.json` | `link` y `pending` por entrada (`PendingMessage = { id, text, attachments?, refs?, createdAt }`) | `init()` completa faltantes: `link` legacy, `pending: []` |
| `threads/*.jsonl` | Eventos `pending.*`; `user.message.{pendingId, delivery, attachments, refs}`; `approval.*.{always, remembered}` | Campos nuevos opcionales; líneas viejas validan |
| `attachments/` | Nuevo (C2) | Se crea en `init()` |

`threads.json` es la fuente para reconstruir la cola tras un reinicio (no hace falta releer JSONL); el
JSONL es el historial que ve la web.

---

## 5. Estado de UI (`apps/studio`)

| Pieza | Dónde | Fase |
| --- | --- | --- |
| Árbol | `lib/store/nav-tree.ts` (puro) — D-13, D-15 | C1 |
| Colapso | `hooks/useCollapsedState.ts` | C1 |
| Hilos activos | `selectors.ts` → `activeThreads` | C1 |
| Pendientes | `ThreadState.pending: PendingItem[]` reducido desde `pending.*` y `user.message.pendingId`; `PendingMessages` (bandeja sobre el Composer: texto, editar inline, quitar, estado) | C1 |
| Borrador por hilo | Slice `drafts` en el store de zustand (no persistido): clave `threadId` o `new:<channelId>`, valor `{ text, attachments: [] }`. El Composer se sigue remontando por `key` (`Workspace.tsx:24`), pero se inicializa desde el draft y lo escribe en cada cambio. Se pierde al recargar (RF-19). Los adjuntos del draft se llenan en C2 (se revocan sus `objectURL` al quitar el draft) | C1 (texto) / C2 (adjuntos) |
| Composer con hilo ocupado | El botón pasa a "Encolar" y el envío usa `SendResult` para decidir si mostrar el pendiente | C1 |
| Stick-to-bottom | `hooks/useStickToBottom.ts` — D-18 | C1 |
| Regla Always | `ApprovalCard.tsx` según `always` — D-14 | C1 |
| Guarda de frame | `lib/bridge/client.ts` — D-04 | C1 |
| Adjuntos, menú `@`/`/`, render | `useAttachmentDraft`, `useAttachmentContent`, `AttachmentTray`, `AttachmentView`, `MentionMenu` | C2 |

---

## 6. Fases y contratos que congela cada una

| Fase | Ciclo | Subproyecto | Entrega | Congela |
| --- | --- | --- | --- | --- |
| **F1 · Protocolo** | C1 | `libs/studio-protocol` | §2 completo (incluye todo C2), `PROTOCOL_VERSION = 2`, `limits.ts`, esquemas de resultado, specs zod (compatibilidad de JSONL viejos incluida) | Todas las formas, límites y constantes de §2. Único bump de la spec; después, solo cambios aditivos opcionales (R10). |
| **F2 · Puente** | C1 | `apps/studio-bridge` | **Primer task: spike e2e de entrega en corte (D-21).** Luego canal de entrada + streaming, cola de pendientes, FakeEngine, Always por regla, vínculo + migración, `source`/`path`/fechas en el snapshot, `features`, `unsupported` para C2, handshake | Frontera del engine (`OutgoingMessage`, `collectPending`, `revertPending`), `deliveryMode` elegido, semántica de pendientes (tabla D-21), algoritmo del prefijo Bash, regla de auto-asignación, marcadores del FakeEngine. |
| **F3 · Web** | C1 | `apps/studio` | Árbol + colapso + activos, `ActivityIndicator`, scroll S1–S6, `ThreadLinkPicker`, bandeja de pendientes, borrador de texto por hilo, regla Always en la tarjeta, guarda de frame | `NavNode.id` (claves de `localStorage`), clave/versión de storage, API de `ActivityIndicator`/`useStickToBottom`, forma del slice `drafts`. |
| F4 · Puente C2 | C2 | `apps/studio-bridge` | Adjuntos (store, bloques SDK), `attachment.get`, `workspace.searchFiles`, catálogo + watcher `.claude`, preámbulo de refs; `features` += `attachments`, `file-search`, `catalog` | Layout de `.sdd-studio/attachments`, exclusiones de búsqueda, precedencia del catálogo. |
| F5 · Web C2 | C2 | `apps/studio` | Adjuntos con re-encode y presupuesto, `MentionMenu`, render de adjuntos, borrador con adjuntos | Algoritmo de presupuesto y escalera, formato de inserción. |

F2 y F3 arrancan con F1 en verde (F3 puede correr contra el FakeEngine). Checkpoint entre fases:
`pnpm nx run-many -t lint test build` de los tres proyectos.

---

## 7. Registros SDD

- `sdd/api.json`, `sdd/schema.json`: sin cambios (§0.3).
- `sdd/components.json` → `apps/studio`, `status: "defined"`, ciclo 1:
  - Se implementan en cycle-01: `SidebarTree`, `NavSection`, `ActiveThreads`, `ActivityIndicator`,
    `ThreadLinkPicker`, `JumpToLatest`, `PendingMessages`, `useCollapsedState`, `useStickToBottom`,
    `useComposerDraft`.
  - Se definen ahora y se implementan en cycle-02 (lo dice su descripción): `AttachmentTray`,
    `AttachmentView`, `MentionMenu`, `useAttachmentDraft`, `useAttachmentContent`.
  - Los existentes que se modifican (`Sidebar`, `Composer`, `ApprovalCard`, `Timeline`, `ThreadView`,
    `Workspace`, `AgentAvatar`) no estaban registrados: el implementador front los registra al tocarlos.

## 8. Riesgos → mitigación

| Riesgo | Mitigación |
| --- | --- |
| R1 tamaño | Corte en dos ciclos; fases F1–F3 con checkpoint. HU-10 concentra el riesgo en F2: el spike va primero. |
| R2 versión | D-01 + `features` (§0.2): un solo bump; cycle-02 sin bump aunque haya desfase. |
| R3 streaming SDK | D-06: evidencia del código del SDK; un solo camino; spike e2e real de entrega en corte, interrupt y resume. |
| R4 frame 1 MiB | Guarda genérica en `client.ts` (C1); presupuesto y escalera (C2). |
| R5 FIX-002 | Ya commiteado: sin conflicto. |
| R6 seguridad | D-05, D-08 (C2); D-14 (prefijo conservador, compuestos y envoltorios nunca; hueco de `warn` corregido). |
| R7 crecimiento | D-19 (C2). |
| R8 Next 16 | Todo es client-side (`'use client'`); nada depende de APIs de Next 15 vs 16. |
| R9 semántica de la cola | D-21: puente como fuente de verdad, toma síncrona en el corte, `conflict` en editar/quitar entregados, tabla de waiting-approval / interrupt / error / reinicio, "pendiente" ≠ `SessionStatus.queued`. |
| R10 contratos sin consumidor | Specs zod de cada contrato C2 en F1, `unsupported` explícito en el puente C1, revisión al abrir cycle-02 con regla de cambios solo aditivos. |
| R11 (nuevo) plegado del CLI | Si el CLI no pliega el pendiente antes del request siguiente, el fallback `additionalContext` de `PostToolBatch` garantiza la entrega del texto. Lo decide el spike de F2 sin tocar el protocolo. |
| R12 (nuevo) API no tipada | No se usa `cancelAsyncMessage` (presente en `sdk.mjs`, ausente de `Query` en `sdk.d.ts`); el interrupt usa solo `still_queued` documentado + `abort()`. |

## 9. Dependencias externas

Ninguna nueva. `@anthropic-ai/claude-agent-sdk` 0.3.292 (streaming input, `PostToolBatch`, recibo de
interrupt), `git` del sistema (C2, opcional), `crypto`/`crypto.subtle`, `createImageBitmap` /
`OffscreenCanvas` (C2), `ResizeObserver` (polyfill solo en tests).

## 10. Decisiones cerradas por el dev (reflejadas)

1. `spec:*` fuera de CANALES, solo bajo SPECS — D-13.
2. Borrador por hilo en memoria del cliente (texto en C1, adjuntos en C2) — §5.
3. Re-encode siempre de imágenes, quita EXIF/GPS (C2) — D-04.
4. Sin `client_composed`: queda el default — D-10.
5. Fixes cerrados: top 5 + "Fixes anteriores" con hilos — D-12.
