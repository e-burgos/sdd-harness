# Architect — Cycle 1: studio-dual-sidebar

> **Input:** sdd/specs/spec-e-burgos-010-studio-dual-sidebar/cycles/cycle-01/functional.md
> **Output:** sdd/specs/spec-e-burgos-010-studio-dual-sidebar/cycles/cycle-01/architect.md
> **Generado por:** sdd-architect (claude/opus, effort high)

---

## Alcance del diseño

Sin base de datos ni endpoints REST: el contrato es el protocolo WebSocket de `libs/studio-protocol` (zod 4), el estado local del puente (`.sdd-studio/channels/*.jsonl`) y la escritura de un único archivo del repo, `sdd/tools.json`. Igual que en spec-005/007, **no se escribe en `sdd/schema.json` ni en `sdd/api.json`**. Sí se registran componentes web en `sdd/components.json` (app-key `apps/studio`): COMP-028..COMP-067 nuevos (`defined`) y COMP-010/019/021/022 actualizados (`updated`).

Stack respetado: TypeScript estricto + zod 4 (protocolo); Node ESM + chokidar + `ws` (puente, publicado en npm como `@e-burgos/sdd-studio`); Next 16 + React 19 + zustand + `@e-burgos/tucu-ui` 3.7.0 + `lucide-react` (web). Código sin comentarios. Este repo no es un workspace Nx: las tareas corren con `pnpm --filter <paquete> <script>`.

## Hallazgos del código que condicionan el diseño

| # | Hallazgo | Consecuencia |
| - | -------- | ------------ |
| H-1 | `BridgeClient.handle` descarta en silencio un frame que no decodifica (`if (!decoded.ok) return`). | Un `ServerEvent` nuevo, o un `bot.event` con un `botKind` nuevo, es inocuo para una web vieja: se pierde, no rompe. |
| H-2 | `Area` (`snapshot.ts`) viaja en `workspace.changed.areas` y en `snapshot.stale`. Un valor nuevo hace fallar el frame **entero** en una web vieja, que deja de recibir snapshots. | **Prohibido agregar valores a `AREAS`.** Los cambios de datos del kit viajan en un evento propio (`kit.changed`, D-03). |
| H-3 | `loadBotHistory` hace `z.array(BotEvent).parse(...)` sobre `channel.botHistory`: un solo `botKind` desconocido **lanza** y el canal no carga. | El historial de `#general` filtra `tools.changed` salvo que la web lo pida (`includeKitEvents`, D-05), mismo patrón que `includeDocumentTouched` de spec-007. |
| H-4 | `ClientCommand` es `discriminatedUnion('cmd')`: un comando desconocido para un puente viejo responde con `id: 'unknown'` y el `request` de la web vence por timeout. | Todo comando nuevo se usa solo con `client.supports(feature)`. |
| H-5 | Todos los `z.object` son no estrictos; `Welcome.features` admite hasta 32 (hoy 14). | Campos opcionales nuevos no rompen; llevan `.catch` para que un valor malformado no tumbe el frame. |
| H-6 | `workspace.readFile` ya resuelve cualquier ruta **dentro de `sdd/`** (`resolveSddPath`: sin absolutas, sin segmentos con punto, `realpath` contenido en `sdd/`), con un único fd y tope de 2 MB (`MAX_READ_BYTES`). Lo usan `DocumentViewerModal`, `LiveTelemetryHUD`, `EcosystemDashboard` y `Composer`. | Es la lista blanca de lectura: todo lo que el Kit, la Arquitectura y los documentos de ciclo necesitan vive bajo `sdd/`. **No hace falta un comando de lectura nuevo**, solo uno de listado. |
| H-7 | `MAX_FRAME_BYTES` (1 MiB) es el `maxPayload` de lo que el puente **recibe**; lo que el puente envía no tiene tope en el navegador. | Un archivo de hasta 2 MB viaja sin problema; el límite de lectura sigue siendo 2 MB y se publica en `limits.ts` para que la web lo anticipe. |
| H-8 | `setup-rtk.mjs --enable/--disable` y `sdd-mod.mjs --enable/--disable/--gate=` **solo escriben `sdd/tools.json`**: retornan antes de `ensureHooks`/`ensureBinary`. Efectos colaterales: ninguno; `sdd-mod` solo imprime un aviso si `.claude/skills/sdd-mod/.claude-plugin/plugin.json` falta. Si `tools.json` no existe, **ambos lo crean** con defaults. | El puente puede reproducir la semántica exacta en proceso (D-04). La creación del archivo es la única divergencia, y es deliberada (CE-8). |
| H-9 | `setup-rtk` escribe `tools.rtk = { ...rtk, enabled }`; `sdd-mod` escribe `tools.claude_mod = { enabled: false, gate: 'block', ...claude_mod, ...patch }`. Ambos serializan `JSON.stringify(tools, null, 2) + '\n'`. | Es el algoritmo de `applyToolsChange` y el contrato del test de paridad. |
| H-10 | El puente no tiene validador JSON Schema; `validate-sdd.mjs` usa `ajv` 8 (`new Ajv({ allErrors: true, strict: false })`), ya presente en el workspace. | `ajv` entra como dependencia del puente y valida contra el `tools.schema.json` **del repo del usuario** (misma versión de kit que su `tools.json`). |
| H-11 | `BotEvent` no tiene marca de tiempo; `ThreadStore.appendBot` deduplica comparando la línea serializada contra la última. Hoy nada escribe en el canal bot `general`. | Para ordenar actividad entre canales se agrega `at` opcional (D-05); la deduplicación compara sin `at`. Eventos viejos sin `at` se ordenan al final. |
| H-12 | `ThreadInfo` trae `status`, `lastActivity`, `pendingCount`, `link.target` y `link.targets`; no existe el concepto de conversación archivada. | «Activa», «por aprobar» y los filtros del Mapa se derivan en la web sin cambiar el protocolo (D-07). |
| H-13 | El watcher ignora `sdd/docs`, `sdd/documentation` y `node_modules`, y re-escanea cada 30 s. | Cambios en la documentación del kit se detectan en el re-escaneo (≤ 30 s), no al instante. Aceptado: solo cambian con `harness update sdd`. |
| H-14 | `AgentMapCanvas` (525 líneas) concentra selección de agente, reproducción de diálogos, filtro de gates, zoom/pan, `ConversationSelector`, `SwarmCommsConsole` y `AgentInspectorDrawer`. `AgentNode` es un componente aparte. | El Mapa en tres columnas se logra **sacando** del lienzo el selector y los paneles derechos, sin tocar `AgentNode.tsx` ni el dibujo del lienzo (D-12). |
| H-15 | `LiveTelemetryHUD` ya suma `usage` de `cycle.json` (`metrics.usage.by_agent`) y `fixes.json` con las tarifas de `pricing` vía `workspace.readFile`. El ahorro de rtk vive en una base SQLite por usuario y el visor lo pide a `rtk gain --project --all --format json`. | Costos reutiliza ese cargador; el ahorro de rtk necesita un comando del puente (D-06). |
| H-16 | El fragmento `#bridge=…&token=…` es del emparejamiento (`pairing.ts` lo lee y lo borra). | La navegación no usa la URL (D-09). |
| H-17 | El token real de 14 px es `text-copy` (`globals.css`, `typography-tokens.ts`); la constitution dice `text-body` por error. | Se usa `text-copy`; el fragmento de contexto del cierre corrige la constitution. |
| H-18 | `SidebarSearch` ya implementa ⌘K/Ctrl+K y Escape; `useCollapsedState` ya persiste colapsos por proyecto (`sdd-studio.sidebar.v1:<project>`). | Se reutilizan dentro de `ModulePanel`/`PanelGroup`. |

## Decisiones técnicas

### D-01. Compatibilidad: sin bump de `PROTOCOL_VERSION` (CA-8, CA-132, pregunta 7)

`PROTOCOL_VERSION` sigue en **2**. Subir la versión obliga a actualizar a la vez la web hospedada y el puente de npm, y el handshake rechaza la combinación vieja/nueva con un error: justo lo que CA-132 prohíbe. Las reglas que garantizan la compatibilidad, en orden de importancia:

1. **Ningún valor nuevo en enums que viajan dentro de frames que una web vieja necesita** (`Area`, `ChannelId`, `ThreadLinkTarget`, `SessionStatus`). H-2.
2. **Comandos nuevos solo con feature** (`kit-index`, `kit-tools`, `rtk-gain` en `BRIDGE_FEATURES`). H-4.
3. **Campos nuevos opcionales con `.catch`** en el snapshot. H-5.
4. **Historial filtrado** para lo que una web vieja no sabe parsear (`includeKitEvents`). H-3.
5. **Eventos en vivo nuevos** (`kit.changed`, `bot.event` con `tools.changed`): las webs viejas los descartan. H-1.
6. **Tipos abiertos en lo que el puente puede ampliar después** (`KitEntry.section`/`role`, `kit.changed.sections` son `string`, no enum): una web de este ciclo frente a un puente futuro con una sección más no rompe el índice entero; filtra por `KIT_SECTIONS` conocidas.

Matriz de degradación:

| Combinación | Comportamiento |
| ----------- | -------------- |
| Web nueva + puente viejo | Kit muestra skills, prompts y agentes del snapshot y un `CapabilityNotice` para documentación, schemas, contexto y memoria (CA-101). Arquitectura funciona entera: lee `sdd/schema.json`, `sdd/api.json` y `sdd/components.json` por `workspace.readFile`, que ya existe. Herramientas: solo lectura; sin `snapshot.tools`, la web parsea `sdd/tools.json` por `workspace.readFile` y muestra los valores (CA-108). Documentos de ciclo: sin `documents`, la ficha lista los esperados por flow con estado «desconocido» y abrir uno intenta leerlo (error acotado si falta). Costos: sin ahorro de rtk, con aviso. |
| Web vieja + puente nuevo | Campos nuevos del snapshot descartados por zod; `kit.changed` y `bot.event{tools.changed}` descartados en vivo; el historial de `#general` sin `tools.changed`. Nada se rompe. |

### D-02. Datos del kit: snapshot ampliado para lo chico, índice bajo demanda para los listados, `workspace.readFile` para el contenido (pregunta 1, 5, 9; CA-088..101, CA-114..119, RNF-6)

Tres canales según el tamaño y la frecuencia de uso del dato:

| Dato | Canal | Por qué |
| ---- | ----- | ------- |
| Estado de herramientas (`rtk.enabled`, `claude_mod.enabled`, `claude_mod.gate`, revisión) | **Snapshot** `tools` (opcional) | Lo necesitan siempre el chip del header (CA-111) y los controles; el snapshot ya lee `tools.json`; < 200 bytes. |
| Documentos existentes por ciclo, documento de la spec, documento de cada fix | **Snapshot** `CycleSummary.documents`, `SpecSummary.document`, `FixSummary.document` (opcionales) | Pocos nombres por ciclo; `loadSpecs` ya recorre cada `cycles/`; la ficha de spec los necesita sin esperar (CA-056/057/060). `fix_document` ya está en `fixes.json`. |
| Listado de documentación, schemas JSON, contexto (base + `updates/`), memoria (lessons + journal) y registros de arquitectura | **Comando `kit.index`** (feature `kit-index`), pedido al abrir Kit o Arquitectura | Cientos de entradas que la mayoría de las sesiones nunca mira; no engordan el snapshot que viaja en cada `workspace.changed`. |
| Contenido de cualquier documento | **`workspace.readFile`** existente, al elegir el elemento | Ya es la lista blanca (H-6); el contenido completo de skills, prompts y agentes del kit se pide igual, por `SkillSummary.path`/`AgentSummary.path` cuando empiezan con `sdd/` (pregunta 9). |

**Secciones y reglas de enumeración de `kit.index`** (solo archivos regulares, se ignoran entradas que empiezan con punto, orden por ruta):

| `section` | Rutas | `role` | `group` |
| --------- | ----- | ------ | ------- |
| `docs` | `sdd/documentation/{es,en}/*.md` | `doc` | `es` / `en` |
| `schemas` | `sdd/schemas/*.json` | `schema` | `null` |
| `context` | `sdd/context/{constitution,context_prompt}.md`, `sdd/context/updates/*.md`, `sdd/context/{apps,libs,tools}/<n>/{constitution,context_prompt}.md`, `…/<n>/updates/*.md` | `base` / `update` | `global` o `apps/<n>`, `libs/<n>`, `tools/<n>` |
| `memory` | `sdd/memory/lessons.md`, `sdd/memory/journal/*.md` | `lessons` / `journal` | `null` |
| `registries` | `sdd/schema.json`, `sdd/api.json`, `sdd/components.json` | `registry` | `null` |

Skills, prompts y agentes del kit **no** entran al índice: ya están en el snapshot (`skills`, `agents` con `source: 'sdd'`). La web los filtra por origen (RN-15).

**Límites:** `MAX_KIT_ENTRIES = 2000` (con `truncated: true` si se excede; ~300 KB en el peor caso); `MAX_READ_FILE_BYTES = 2 MiB` (el valor actual de `MAX_READ_BYTES`, ahora exportado por el protocolo y usado por el puente). La web usa `KitEntry.size` para mostrar «excede el tamaño soportado» sin pedir el archivo (CA-098). `MAX_CYCLE_DOCUMENTS = 64` por ciclo.

**Documentos por ciclo** (`CycleSummary.documents`): nombres relativos a la carpeta del ciclo, de la lista blanca `brief.yaml`, `functional.md`, `planner.md`, `architect.md`, `plan.md`, `cycle.json`, `tasks.json`, más `artifacts/<archivo>` (solo archivos del primer nivel). La web arma la ruta `${spec.folder}/cycles/${cycle}/${name}`. `SpecSummary.document` = `${folder}/${id}.spec.md` si existe. `FixSummary.document` = `fix_document` de `fixes.json` si empieza con `sdd/` y no tiene `..`.

### D-03. Refresco de los datos del kit: `KitIndexer` y evento `kit.changed` (pregunta 1, CA-110)

- `apps/studio-bridge/src/workspace/kit-index.ts` construye el índice con `readdir` + `stat` (sin leer contenidos) y calcula una huella por sección (`sha1` de `ruta:mtimeMs:size` ordenadas), igual que `serveStateFingerprint` del visor.
- El indexador se **arma con el primer `kit.index`** de la vida del puente: un dev que nunca abre Kit no paga el recorrido.
- Ya armado, se recalcula (debounce 200 ms) cuando el watcher ve un cambio bajo una raíz del kit y en cada re-escaneo de 30 s (que cubre `sdd/documentation`, ignorada por chokidar, H-13). Si alguna huella cambió, el puente difunde `{ kind: 'kit.changed', sections, revision }`.
- La web invalida su caché de índice y de contenidos de esas secciones y vuelve a pedir `kit.index` solo si Kit o Arquitectura están montados; si no, al próximo montaje.
- Los cambios de `sdd/tools.json`, de los documentos de ciclo y de `fixes.json` llegan por el `workspace.changed` de siempre (áreas `tools`, `specs`, `fixes`).

### D-04. Escritura de `sdd/tools.json`: comando `kit.tools.set` en proceso, no los scripts (pregunta 6; CA-102..113, RN-12, CE-8, CE-9)

**El puente escribe el JSON en proceso con la misma semántica que los scripts; no los ejecuta.** Motivos:

1. Los scripts no tienen efectos colaterales para estos flags (H-8): ejecutarlos no aporta nada que reproducir.
2. Sin detección de conflicto ni escritura atómica en los scripts (CE-9).
3. Los scripts **crean** `tools.json` si falta; el funcional prohíbe que Studio lo cree o lo corrija (CE-8).
4. Un kit instalado más viejo puede no tener `sdd-mod.mjs`; el puente se publica aparte del kit.
5. `command.run` (el camino que ya existe para scripts) no sirve: `SafeArg` no admite `=` (`--gate=warn`) y solo devuelve salida de texto.

La paridad se garantiza con un **test dorado** que corre los scripts reales sobre un repo temporal y compara bytes contra `applyToolsChange` (ver tests del puente).

**Contrato:**

```ts
export const ToolsRevision = z.string().regex(/^[a-f0-9]{16}$/);
export const ToolsChange = z.discriminatedUnion('tool', [
  z.object({ tool: z.literal('rtk'), enabled: z.boolean() }),
  z.object({ tool: z.literal('mod'), enabled: z.boolean() }),
  z.object({ tool: z.literal('gate'), mode: GateMode }),
]);
z.object({ ...cmd('kit.tools.set'), change: ToolsChange, expectedRevision: ToolsRevision })
```

Una sola herramienta por comando, como una sola confirmación por control (CA-103). `ToolsChange` es cerrado: no hay forma de escribir otro campo (CA-113, RN-12e, RNF-10).

**Algoritmo** (`apps/studio-bridge/src/workspace/kit-tools.ts`), serializado por una cola única del proceso:

1. Leer los bytes crudos de `<root>/sdd/tools.json`. Si no existe → error `not-found` (`sdd/tools.json does not exist`). No se crea (CE-8).
2. `revision = sha256(bytes).slice(0, 16)`. Si difiere de `expectedRevision` → error `conflict` (CE-9). La web refresca el valor desde el snapshot y avisa.
3. `JSON.parse`; si falla o no es objeto → `bad-request`. Validar el documento **actual** contra `<root>/sdd/schemas/tools.schema.json` con `ajv` (draft-07, `allErrors`, `strict: false`); si no valida → `bad-request` con el primer error (CE-8: no se corrige un archivo inválido). Si el schema no existe en el repo (kit anterior), validación estructural mínima con zod: `rtk.enabled` booleano si `rtk` existe, `claude_mod.enabled` booleano y `claude_mod.gate ∈ {block, warn}` si existen.
4. Si el valor efectivo ya es el pedido → `{ changed: false }`, sin escribir ni registrar.
5. `applyToolsChange(doc, change)`, función pura, exactamente H-9: `rtk` → `doc.rtk = { ...(doc.rtk ?? {}), enabled }`; `mod`/`gate` → `doc.claude_mod = { enabled: false, gate: 'block', ...(doc.claude_mod ?? {}), ...patch }`. El orden de claves se conserva (un `claude_mod` ausente se agrega al final, como el script).
6. Validar el resultado con el mismo validador (red de seguridad; nunca debería fallar).
7. Escribir `JSON.stringify(next, null, 2) + '\n'` en `tools.json.<pid>.tmp` y `rename` sobre el original (patrón de `writeProfile`). `EACCES`/`EPERM`/`EROFS` → `internal` con el código del sistema en el mensaje.
8. `await watcher.refresh()` → `workspace.changed{areas:['tools']}` actualiza controles y chip a todas las pestañas conectadas (CA-110/111).
9. Registrar y difundir el evento de `#general` (D-05).
10. Devolver `ToolsSetResult`:

```ts
export const ToolsValue = z.union([z.boolean(), GateMode]);
export const ToolsSetResult = z.object({
  changed: z.boolean(),
  tool: z.enum(['rtk', 'mod', 'gate']),
  from: ToolsValue.nullable(),
  to: ToolsValue,
  tools: KitToolsState,
  warnings: z.array(z.string().max(40)).max(8),
});
```

`warnings` lleva `mod-not-linked` cuando se prende el mod y falta el plugin enlazado (paridad con el aviso de `sdd-mod.mjs`); la web lo muestra con el remedio (`pnpm setup:agents`).

**Valores efectivos** (paridad con `--status` de los scripts): `rtkEnabled = rtk.enabled !== false`; `modEnabled = claude_mod.enabled === true`; `gate = claude_mod.gate === 'warn' ? 'warn' : 'block'`. Con `status !== 'ok'` los tres son `null` (CE-8: estado desconocido).

**Fuera de alcance, documentado en la UI:** prender rtk desde Studio no instala hooks ni binario (tampoco lo hace `--enable`); si faltan, el texto del control remite a `pnpm sdd:rtk`.

**Riesgo aceptado:** entre el chequeo de revisión (paso 2) y el `rename` (paso 7) hay una ventana de milisegundos en la que un escritor externo podría colarse. Se acepta: la cola elimina las carreras internas y el caso externo exige un comando de consola en ese mismo instante.

### D-05. Registro en `#general`: `tools.changed`, `BotEvent.at` e `includeKitEvents` (pregunta 2, 6; CA-037, CA-106, RN-12c)

- `BotKind` suma `tools.changed`. Payload: `{ tool: 'rtk' | 'mod' | 'gate', from, to, file: 'sdd/tools.json' }`. Canal: `general` (`ChannelId` ya lo admite). Solo se emite con `changed: true`; un fallo o una cancelación no dejan registro (CA-106/107).
- `BotEvent` suma `at: z.string().max(40).optional()` (ISO). El puente estampa `at` en todo evento nuevo: en `main.ts` al difundir los de `diffSnapshots` (que sigue siendo pura) y en `kit.tools.set`.
- `ThreadStore.appendBot` deduplica comparando la serialización **sin `at`** (si no, dos eventos idénticos seguidos dejarían de colapsar).
- `channel.botHistory` suma `includeKitEvents: z.boolean().default(false)`; el puente omite `tools.changed` salvo `true` (H-3). La web lo envía solo con `supports('kit-tools')`.
- Un cambio hecho por consola (`pnpm sdd:rtk`) **no** genera `tools.changed`: el watcher no sabe qué herramienta cambió por intención del dev y el funcional lo pide solo para Studio. La UI refleja el valor nuevo igual (CA-110).

### D-06. Ahorro de rtk: comando `kit.rtkGain` (CA-123)

`z.object({ ...cmd('kit.rtkGain') })`, feature `rtk-gain`. El puente porta `findRtkBinary` (`RTK_BIN`, `PATH`, directorio de instalación por usuario: `RTK_INSTALL_DIR` o `~/.local/bin`, o `%LOCALAPPDATA%\rtk\bin` en Windows) y ejecuta `rtk gain --project --all --format json` con `execFile` (sin shell, `cwd: root`, timeout 8 s, `maxBuffer` 8 MiB, `RTK_TELEMETRY_DISABLED=1`), con caché de 10 s, como `serve.mjs`. No lee el `history.db` por comando (fuera de alcance).

```ts
export const RtkGain = z.object({
  status: z.enum(['ok', 'not-installed', 'error']).catch('error'),
  version: z.string().max(40).nullable(),
  gain: z.record(z.string(), z.unknown()).nullable(),
  readAt: z.string().max(40),
});
```

El número es estimado (rtk cuenta bytes ÷ 4) y la UI lo rotula así (RN-17b).

### D-07. Actividad, conversación activa, por aprobar, ciclo actual y filtros del Mapa: derivaciones en la web (preguntas 2, 3, 4, 11)

Sin cambios de protocolo. Funciones puras en `apps/studio/src/lib/nav/derive.ts`, con tests unitarios:

| Regla | Derivación con datos existentes |
| ----- | ------------------------------- |
| RN-5 spec activa | `spec.status === 'in-progress'` o algún `CycleSummary` de la spec con `status === 'in-progress'`; cerrada: `completed`. |
| RN-8 ciclo actual | El `in-progress`; si no hay, el de número más alto. Progreso: `tasksDone / tasksTotal` del `CycleSummary` (ya excluye `skipped`); `tasksTotal === 0` → «sin tareas». **`CycleSummary` alcanza**; solo se agrega `documents` (D-02). |
| RN-6 conversación activa | `status ∈ {queued, running, waiting-approval}` ∨ `pendingCount > 0` ∨ hilo sincronizado con aprobación o pregunta abierta ∨ `now − lastActivity ≤ 24 h`. «Archivada» no existe hoy: la condición es vacía en este ciclo. Sin `lastActivity` parseable → inactiva salvo en curso o por aprobar (CE-3). |
| «En curso» (CA-029) | Hilos `running`/`queued` + ciclos `in-progress`. |
| «Por aprobar» (CA-030) | Hilos `waiting-approval` + hilos sincronizados con `pendingApprovals(thread)` o preguntas sin resolver. |
| Filtros del Mapa (CA-080) | Sobre `linkEntriesOf(info)` y `info.link.target`. **Transversal:** ninguna entrada `cycle` ni `fix` (una asociación solo a spec cuenta como transversal). **Por ciclo:** alguna entrada `cycle`, agrupada por `specId/cycle`. **En ejecución:** `running`, `queued` o `waiting-approval` (la sesión no terminó). **Listas:** `idle`. Las asociaciones múltiples de spec-007 ya existen: solo se mapean. |
| Severidad (RN-9, CA-066) | `critical > high > medium > low > null`; empate por `createdAt` descendente. |
| Plan por flow (RN-11) | `lite → [plan.md]`; `full → [functional.md, planner.md, architect.md]`; `reduced → [planner.md, architect.md]` (opcionales según `sdd-gates.md` § Flow: un `reduced` sin ninguno muestra el estado vacío, no «pendiente»). |
| Actividad del proyecto | `ActivityItem { at: string \| null, origin: 'spec' \| 'fix' \| 'agent' \| 'tools', channelId, … }` armado con: `bot[spec:*]` (origen spec), `bot[fixes]` (fix), `bot[general]` con `tools.changed` (tools) y `ThreadInfo` por `lastActivity` (agent). Orden por `at` descendente; sin `at` (eventos anteriores a este ciclo) al final, en orden de archivo por canal. |

**Carga de la actividad** (`useActivityFeed`): reutiliza `channel.botHistory` por canal (sin comando nuevo), solo para los canales que la vista necesita, con concurrencia 4 y `limit: 100`, una vez por sesión; después la mantiene el `bot.event` en vivo que ya actualiza `store.bot`. Se descartó un comando de feed agregado: con decenas de specs son decenas de pedidos chicos sobre localhost, y cada comando nuevo suma una rama de degradación.

### D-08. Shell web: riel, panel, centro y panel derecho por módulo (US-1, RN-1, RN-2, CA-001..009)

`StudioShell` (`components/shell/StudioShell.tsx`) reemplaza en `Connected` (dentro de `WorkspaceApp.tsx`) a `Workspace` y a las cuatro vistas por pestaña. Grilla CSS:

```
[ModuleRail 60px] [ModulePanel 220px | 0] [centro minmax(0,1fr)] [panel derecho 320px | PanelRail 44px | nada]
```

- **Registro de módulos** `lib/nav/modules.ts`: `ModuleDefinition { id, icon, labelKey, hideable, Panel, Center, Right: ComponentType | null, Scope?: ComponentType<{ children }> }`. `Right === null` en Kit, Arquitectura, Métricas y Actividad. `Scope` es un provider que envuelve panel, centro y derecho cuando comparten estado (Mapa: reproducción de diálogos). Un test sobre el registro fija RN-1 (nueve módulos, `home` no ocultable) y RN-2.
- `ModuleId = 'home' | 'specs' | 'fixes' | 'agents' | 'activity' | 'map' | 'kit' | 'architecture' | 'metrics'`.
- **Colapsos**: se reutiliza `usePanelState` (`sdd-studio.panels.v1`): `sidebarCollapsed` colapsa el panel (el riel queda), `rightCollapsed` el derecho. `sidebarIcons` queda sin uso (zod lo ignora; no se migra la clave).
- **Degradación sin vista mobile** (CA-009): bajo 1024 px el panel derecho arranca colapsado en `PanelRail`; bajo 768 px el panel de lista se vuelve una capa superpuesta que abre el ícono del módulo activo. Ningún ancho fijo suma más que el viewport: sin scroll horizontal.
- **Riel** (`ModuleRail`): proyecto arriba (nombre + `kitVersion` en tooltip), módulos visibles según preferencia, «Más» con contador de ocultos (CA-026), y al pie `NewConversationButton` y la cuenta: avatar con punto de conexión que abre el `AuthPanel` actual en un popover. Indicador del activo: barra lateral de 3 px + fondo, además del color (CA-002). `role="navigation"` con lista de botones y `aria-current="page"` (CA-008).
- **Header** (`StudioHeader`): sin `activeView`/`onSelectView` ni `SegmentedControl` de vistas; conserva marca, proyecto, chip del gate (que ahora muestra además el modo `block`/`warn` de `snapshot.tools?.gate ?? snapshot.gateMode`, CA-111), estado del equipo, idioma y tema (CA-006).

### D-09. Estado de navegación y persistencia (CA-010, CA-016, CA-022..027, RN-4, RN-18; pregunta 10)

**Sin rutas ni hash**: el fragmento es del emparejamiento (H-16) y la spec no pide enlaces profundos. Un store zustand propio de navegación (`lib/nav/use-nav.ts`, `NavProvider` montado en `Connected` con la clave del proyecto), separado de `StudioState` (que es espejo del puente).

```ts
interface NavState {
  module: ModuleId;
  selection: { specs: string | null; fixes: string | null; agents: string | null; kit: string | null; architecture: 'db' | 'api' | 'components' | null; metrics: MetricsView | null };
  specTab: 'summary' | 'plan' | 'tasks' | 'documents' | 'conversations';
  specCycle: string | null;
  home: { kind: 'channel'; channelId: string } | { kind: 'specs-channel' } | { kind: 'inbox'; which: 'running' | 'approvals' } | { kind: 'thread'; threadId: string };
  filters: { homeConversations: 'active' | 'all'; specs: 'active' | 'all' | 'closed'; map: 'all' | 'transversal' | 'cycle' | 'running' | 'ready'; activity: ('spec' | 'fix' | 'agent' | 'tools')[] };
  queries: Partial<Record<ModuleId, string>>;
}
```

- **Persistencia de navegación:** `localStorage['sdd-studio.nav.v1:<project>']` con todo menos `queries`, validado con zod; inválido → defaults. Al restaurar, una selección que ya no existe en el snapshot cae al panel sin elemento, y un `home.thread` inexistente a `#general` (CE-1).
- **Texto del buscador** (CA-016, una sola conducta para todos los módulos): cada módulo conserva el suyo **durante la sesión** al ir y volver; no se persiste entre recargas (RN-4).
- **Selección de agente compartida** (RN-13b): `selection.agents` es la única fuente; el Mapa, el panel de Agentes y la ficha la leen y escriben. Sin agente elegido por defecto (CA-084); hoy el mapa arrancaba con `sdd-orchestrator`.
- **Selección de conversación**: sigue siendo `StudioState.selectedThreadId` (`useConversationSelection`), compartida por Inicio, Mapa y header, como hoy.
- **Preferencia del riel** (`lib/nav/use-rail-preferences.ts`): `localStorage['sdd-studio.rail.v1:<project>'] = { order: ModuleId[], hidden: ModuleId[] }`. Al leer se reconcilia: ids desconocidos fuera, módulos nuevos al final y visibles (CA-024), `home` nunca oculto (CA-027), duplicados fuera; `try/catch` en lectura y escritura (RN-18c). «Restablecer» borra la clave (CA-021). Ocultar el módulo activo no cambia la navegación (CA-025).
- **Identidad del proyecto:** `snapshot.project` (`global.json → project`), la misma que ya usa `useCollapsedState`. Dos repos con el mismo nombre comparten preferencias de riel: aceptado (es inocuo y mantiene una sola convención).
- **Migración:** si no hay `sdd-studio.nav.v1:<project>` y existe `sdd-studio.active-view`, se mapea una vez (`agent-map → map`, `ecosystem`/`telemetry → metrics` con esa vista, `workspace → home`) y se borra la clave vieja.
- **Colapso de grupos** (CA-005): `useCollapsedState` con ids `"<module>:<group>"` en la clave existente.

### D-10. Reutilización y reemplazo de lo actual

| Pieza actual | Destino |
| ------------ | ------- |
| `lib/store/nav-tree.ts` (`buildNavTree`, progreso por spec), `nav-summary.ts`, `nav-filter.ts` | **Se reutilizan** como fuentes de datos de los paneles de Inicio, Specs y Fixes; `nav-filter` se generaliza a un filtro sin tildes ni mayúsculas por campos (RF-1-002, CA-013). |
| `SidebarSearch` | **Se reutiliza** dentro de `ModulePanel` (⌘K, Escape; se agrega el segundo Escape que devuelve el foco a la lista, CA-017). Un solo listener global: el del panel montado. |
| `useCollapsedState`, `PanelRail`, `usePanelState`, `NewConversationButton`, `AuthPanel`, `CapabilityNotice`, `useBridgeFeatures` | **Se reutilizan**. |
| `ChannelView`, `ThreadView`, `Composer`, `RunOutput`, `PreparedConversations`, `RightPanel` (`RightPanelView`) | **Se reutilizan** en `HomeCenter` y en el panel derecho de Inicio; la lógica de `view` de `Workspace.tsx` pasa a `NavState.home`. |
| `Workspace.tsx`, `Sidebar.tsx`, `SidebarHeader.tsx`, `SidebarRail.tsx`, `NavTree.tsx`, `NavSections.tsx`, `use-studio-view.ts` | **Se eliminan** al terminar la migración (COMP-001/002/003 pasan a `deprecated` cuando el implementador borre los archivos). `NavParts` (chips de estado, severidad, presencia, `CycleTrail`) se conserva y se ajusta a la escala. |
| `AgentInspectorDrawer` | Su contenido pasa a `AgentCard`; el drawer se elimina (el mapa ya no superpone paneles). |
| `ConversationSelector` (COMP-016) | Sale de la barra del lienzo; el panel del Mapa lista las conversaciones con filas. Se depreca al borrarlo. |
| `SwarmCommsConsole`, `SwarmSpeechBubble` (`LiveSwarmComms.tsx`), `GateCard`, `GateInspectorDrawer`, `AgentNode` | **Intactos.** |
| `EcosystemDashboard`, `LiveTelemetryHUD` | **Intactos**, montados en el centro de Métricas (RN-17). El cargador de `usage` de `LiveTelemetryHUD` se extrae a `useCycleRecords` sin cambiar su comportamiento. |
| `DocumentViewerModal` (ya sobre `SplitModal`) | Se conserva como visor modal para Plan, Documentos y fixes (CA-058). Su render (Markdown/JSON, crudo/renderizado) se extrae a `DocumentContent`, que también usa el centro del Kit (CA-095). |
| `components/SegmentedControl.tsx` propio | El código nuevo usa `SegmentedControl` de tucu-ui 3.7.0; el reemplazo del propio en los usos existentes no es de este ciclo. |

### D-11. Ficha de spec y documentos (US-4; CA-054..065; pregunta 4, 5)

- `SpecCard` = encabezado (título, `StateBadge` de estado, ciclo actual) + `AnimatedTabs` (tucu-ui, `size="sm"`, `mobile="scroll"`, sin `queryParamKey`) con las cinco pestañas; la activa vive en `NavState.specTab` (CA-064 se cumple solo: las cinco existen para toda spec).
- **Resumen** y **Tareas**: solo snapshot. Selector de ciclo (`NavState.specCycle`, por defecto el actual, RN-11c) compartido con Plan.
- **Plan** (`SpecPlanTab`): documentos esperados por flow (D-07) cruzados con `CycleSummary.documents`; los ausentes como «pendiente» sin enlace (CA-057). Sin `documents` (puente viejo): estado «desconocido» y apertura que intenta leer.
- **Documentos** (`SpecDocumentsTab`): `SpecSummary.document`, por ciclo todos los `documents` (incluidos `artifacts/…`), y los `FixSummary.document` de los fixes con `specId` de la spec, agrupados por ciclo y un grupo «Fixes».
- Abrir: `DocumentViewerModal` con `toViewerDocument`-like (ruta, nombre, tipo por `documentTypeOf`); abrir no cambia pestaña ni selección (CA-058).
- **Conversaciones**: hilos de `spec:<id>` ∪ hilos con alguna entrada de `linkEntriesOf` sobre la spec o sus ciclos, sin duplicados; elegir uno navega a Inicio con ese hilo (el centro de conversación es uno solo); «iniciar una» abre Inicio en el canal `spec:<id>` con el composer.
- **Panel derecho** (`EntityRightPanel`, compartido con Fixes): Actividad (`bot[spec:<id>]` + hilos asociados, D-07) y Detalles (id, carpeta, módulo, app, dependencias navegables).
- Errores acotados por pestaña (CA-063): cada pestaña es su propio `ErrorBoundary` + `ErrorState`.

### D-12. Mapa en tres columnas con los nodos intactos; ficha de agente compartida con chat directo (US-5-002, US-6; CA-071..087; RF-5-001)

- **Centro**: `AgentMapCanvas` sin `ConversationSelector`, sin `SwarmCommsConsole`, sin `AgentInspectorDrawer` y sin el botón «abrir panel». Conserva lienzo, `AgentNode`, `GateCard`, filtro de gates (`cycle`/`transversal`/`all`, que es de gates, no de conversaciones), zoom/pan, burbuja de diálogo y `GateInspectorDrawer` (CA-086). Nueva firma: `{ selectedAgent, onSelectAgent, onSelectGate? }`; el `onOpenDm` deja de existir. **`AgentNode.tsx` no se modifica** (diff vacío) y `agentmap.spec.tsx` debe pasar con cambios solo en lo que se movió de lugar.
- **Estado compartido** del Mapa en `useSwarmPlayback` (provider `Scope` del módulo): índice de diálogo, reproducción, diálogo inspeccionado; lo consumen la burbuja del centro y la consola del derecho.
- **Panel** (`MapPanel`): «nueva conversación», filtros con `FilterBar`/`FilterPill` (tucu-ui) con cantidades (CA-080), lista de conversaciones con `PanelRow`, agrupada por ciclo con el filtro Por ciclo. Elegir una llama a `store.selectThread` (CA-081).
- **Derecho** (`MapRightPanel`): `SwarmCommsConsole` arriba; con agente elegido, `AgentCard` debajo; sin agente, la consola y un indicio (CA-083/084).
- **`AgentCard`** (un solo componente para Agentes y Mapa, RN-13): presencia, descripción, modelo, origen, ruta de definición, documentos y diálogos de la conversación seleccionada cuando hay (lo que hoy hace el drawer) y `AgentDirectChat`. Agente ausente del snapshot → «agente no disponible», chat deshabilitado (CE-7).
- **`AgentDirectChat`**: el chat directo es el canal `dm:<agent>` que ya existe (`channelForDm`). Muestra el hilo más reciente de ese canal con `ThreadView` en modo compacto y un `Composer(channelId: 'dm:<agent>', threadId)`; un hilo nuevo aparece en Inicio y en el Mapa porque es un hilo más del store (CA-074, RN-13c). Deshabilitado con motivo si la conexión no está `open` (CA-077).
- **Agentes** (`AgentsPanel`): agentes del snapshot agrupados por `source` (`sdd` = kit, `claude` = proyecto) con `PresenceAvatar`; centro: conversaciones del agente (hilos con `info.agent === id` o en `dm:<id>`); derecho: `AgentCard`.

### D-13. Kit, Arquitectura y Métricas (US-7, US-9, US-10)

- **Kit**: `KitPanel` lista Skills, Prompts, Agentes del kit (snapshot, `source: 'sdd'`), Herramientas, Documentación, Schemas JSON, Contexto y Memoria (índice) con cantidades. `KitCenter` muestra `DocumentContent` para el elemento elegido vía `useWorkspaceFile(path)` (caché por ruta, invalidada por `kit.changed`/`workspace.changed`). Documentación: el `group` del idioma de la UI; si falta, el otro con aviso de idioma (CA-091). Contexto: por subproyecto, base primero y luego `updates/` en orden de nombre, con rótulos «base»/«fragmento» (CA-093, RN-15c). Memoria: `lessons` completo y journal listado; cada entrada se pide al abrirla (RN-15d).
- **Herramientas** (`KitToolsPanel` + `useKitTools`): dos `Switch` (rtk, mod) y un `SegmentedControl` (`block`/`warn`) de tucu-ui. Cambiar abre `ConfirmDialog` (tucu-ui) con herramienta, valor actual → nuevo, archivo `sdd/tools.json` y advertencia de efecto (tono `warning` para gate → `warn` y para apagar el mod; `info` para el resto; CA-103/112). Al confirmar: `loading` en el diálogo y control deshabilitado (CA-109); el control cambia **solo** con el resultado del puente (CA-105). `conflict` → valor actual del snapshot + aviso (CE-9); otro error → valor anterior + motivo (CA-107). Sin `kit-tools`: solo lectura con `CapabilityNotice` (CA-108).
- **Arquitectura**: `SectionListPanel` (Base de datos, API, Componentes con cantidades) + `ArchitectureView` con tres renderers sobre esquemas zod laxos (`passthrough`) en `lib/kit/registries.ts`, alineados con `db-schema.schema.json` (`{ [app]: { tables: { [name]: { columns, indexes, status, … } } } }`), `api.schema.json` (`{ [app]: { endpoints: [{ id, method, path, description, status, … }] } }`) y `components.schema.json`. Se leen por `workspace.readFile` (funciona con puente viejo). Archivo ausente o inválido → `ErrorState` acotado a la sección (CE-10); sin registros → `EmptyState` (RN-16).
- **Métricas**: `SectionListPanel` con las cinco vistas; centro: `MetricsDashboard` (`StatCard` de tucu-ui con specs por estado, ciclos en curso, avance de tareas, fixes abiertos — solo snapshot), `PlanningView` (specs → ciclos → tareas con avance, snapshot), `CostsView` (por agente, modelo y ciclo con `useCycleRecords` + `pricing`; sin `pricing` → `EmptyState`, nunca `0`/`NaN` (CA-127); pestaña de ahorro de rtk con `kit.rtkGain`), `EcosystemDashboard`, `LiveTelemetryHUD` (CA-124/125).

### D-14. Módulo Actividad — provisional (pregunta 8)

Se adopta la propuesta del funcional como **provisional**: panel con filtros por origen (Specs, Fixes, Agentes, Herramientas) con `FilterPill` y cantidades, más el buscador (texto del evento y origen); centro con `ActivityTimeline` (D-07), más reciente primero, agrupado por día; **sin panel derecho** (`Right: null`). Cada ítem navega a su spec, fix, hilo o a la sección Herramientas del Kit. Queda marcada para confirmación del dev en la revisión visual del ciclo; cambiarla no afecta contratos.

### D-15. Escala tipográfica: aplicada por construcción y verificada por test (CA-001, RNF-1)

- `lib/typography-tokens.ts` suma `PANEL_TYPE = { title: 'text-title font-semibold', group: 'text-small font-medium text-ink-400', item: 'text-copy', meta: 'text-meta', rail: 'text-meta' }` y `ROW_HEIGHT = 'h-7'`, `ROW_ICON = 16`.
- Solo `ModulePanel` (título 16 semibold), `PanelGroup` (encabezado 13 medium secundario, separador `border-t` de 1 px), `PanelRow` (fila 28 px, ícono 16, texto 14, meta 11) y `ModuleRail` (etiqueta 11) aplican esas clases; los paneles de módulo componen esas primitivas y no ponen tamaños propios.
- Regla 7 de la constitution: con componentes de tucu-ui el tamaño va en un span envolvente.
- **Test de escala** (`typography.spec.tsx`): renderiza cada `Panel` del registro con un snapshot de fixture y falla si algún elemento dentro de `[data-studio-panel]` o `[data-studio-rail]` tiene `text-xs|sm|base|lg|xl|2xl` o `text-[`. La verificación visual en 1280×700 y 1440×860, claro y oscuro, es del reviewer.

### D-16. Estados de carga, vacío y error (CA-100, CA-130, CA-131)

`EmptyState` y `ErrorState` (tucu-ui 3.7.0) en todos los paneles y centros; `Skeleton` para carga (tucu-ui no tiene vista de carga). Cada `Panel`, `Center` y `Right` del registro se monta dentro de su propio `ErrorBoundary` (el existente), así un error no cruza módulos. Desconectado: el shell sigue montado con el último snapshot del store, `ConnectionBanner` como hoy, y las acciones que piden puente (enviar, cambiar herramientas, `kit.index`) deshabilitadas con motivo.

## Respuestas a las preguntas abiertas del funcional

| # | Pregunta | Respuesta |
| - | -------- | --------- |
| 1 | Datos del Kit y Arquitectura | Híbrido: snapshot para herramientas y documentos de ciclo/spec/fix; `kit.index` bajo demanda para listados; `workspace.readFile` para contenido; refresco con `kit.changed` (D-02, D-03). Arquitectura lee los tres registros por `workspace.readFile`. |
| 2 | Eventos de actividad | Existen `bot.event` por canal (`spec:<id>`, `fixes`) desde `diffSnapshots` y `ThreadInfo.lastActivity`. Se agrega `tools.changed` en `general` y `at` opcional en `BotEvent` (D-05, D-07). |
| 3 | Conversación activa | `status`, `pendingCount`, `lastActivity` de `ThreadInfo`; no hay «archivada» (condición vacía). Umbral de 24 h aplicable (D-07). |
| 4 | Progreso y ciclo actual | `CycleSummary` alcanza; se suma `documents` opcional (D-02, D-07). |
| 5 | Documentos por ciclo y fixes | Snapshot (`documents`, `document`) con lista blanca de nombres; lectura por `workspace.readFile` (sdd/, 2 MiB) (D-02, D-11). |
| 6 | Escritura de `sdd/tools.json` | `kit.tools.set` en proceso con paridad probada, `ajv` contra el schema del repo, revisión sha256 para conflictos, escritura atómica, `tools.changed` en `#general`, feature `kit-tools` (D-04, D-05). |
| 7 | Compatibilidad | Opcionales + features; `PROTOCOL_VERSION` sigue en 2 (D-01). |
| 8 | Módulo Actividad | Propuesta del funcional adoptada como provisional, sin panel derecho (D-14). |
| 9 | Contenido de skills/prompts/agentes | Se pide al elegir, por `workspace.readFile` sobre su `path` (solo origen `sdd/`) (D-02). |
| 10 | Persistencia del riel | `localStorage` por `snapshot.project`; buscador por módulo solo en la sesión (D-09). |
| 11 | Filtros del Mapa | Derivados de `link.targets`/`link.target` y `status` (D-07). |

## Cambios en schema (sdd/schema.json)

Ninguno: no hay tablas. El único archivo del repo que Studio escribe es `sdd/tools.json`, cuyo formato no cambia.

## Contratos de API (sdd/api.json)

Ninguno: no hay endpoints HTTP. El contrato vive en `libs/studio-protocol` (zod). Delta:

| Elemento | Archivo | Tipo | Compatibilidad |
| -------- | ------- | ---- | -------------- |
| `MAX_READ_FILE_BYTES`, `MAX_KIT_ENTRIES`, `MAX_CYCLE_DOCUMENTS` | `limits.ts` | constantes | aditivo |
| `BRIDGE_FEATURES` + `kit-index`, `kit-tools`, `rtk-gain` (17 de 32) | `limits.ts` | lista | aditivo |
| `KitToolsState`, `ToolsRevision`, `WorkspaceSnapshot.tools?` | `snapshot.ts` | tipo + campo opcional con `.catch(undefined)` | aditivo |
| `CycleSummary.documents?`, `SpecSummary.document?`, `FixSummary.document?` | `snapshot.ts` | campos opcionales con `.catch` | aditivo |
| `KIT_SECTIONS`, `KitEntry`, `KitIndex`, `ToolsChange`, `ToolsValue`, `ToolsSetResult`, `RtkGain` | `kit.ts` (nuevo, exportado en `index.ts`) | tipos | aditivo |
| `kit.index`, `kit.tools.set`, `kit.rtkGain` | `commands.ts` | comandos nuevos | solo con su feature |
| `channel.botHistory.includeKitEvents` | `commands.ts` | campo con `default(false)` | aditivo |
| `BotKind` + `tools.changed`; `BotEvent.at?` | `events.ts` | miembro + campo opcional | filtrado del historial |
| `kit.changed` en `ServerEvent` | `events.ts` | evento nuevo | descartado por webs viejas |
| `Area` | `snapshot.ts` | **sin cambios** (H-2) | — |
| `PROTOCOL_VERSION` | `version.ts` | **sin cambios (2)** | — |

Tipos nuevos (`snapshot.ts` y `kit.ts`):

```ts
export const KitToolsState = z.object({
  status: z.enum(['ok', 'missing', 'invalid']),
  rtkEnabled: z.boolean().nullable(),
  modEnabled: z.boolean().nullable(),
  gate: GateMode.nullable(),
  modLinked: z.boolean(),
  revision: ToolsRevision.nullable(),
});

export const KIT_SECTIONS = ['docs', 'schemas', 'context', 'memory', 'registries'] as const;
export const KitEntry = z.object({
  section: z.string().min(1).max(32),
  role: z.string().min(1).max(32),
  group: z.string().max(128).nullable(),
  path: z.string().min(1).max(512).regex(/^sdd\//),
  size: z.number().int().nonnegative(),
  mtime: z.string().max(40),
});
export const KitIndex = z.object({
  revision: z.string().max(64),
  entries: z.array(KitEntry).max(MAX_KIT_ENTRIES),
  truncated: z.boolean(),
});
```

`ServerEvent` nuevo: `z.object({ kind: z.literal('kit.changed'), sections: z.array(z.string().min(1).max(32)).max(16), revision: z.string().max(64) })`.

Errores de `kit.tools.set` (sobre `ErrorCode` existente): `not-found` (falta `tools.json`), `bad-request` (JSON o schema inválido), `conflict` (revisión distinta), `internal` (permiso o disco). `kit.index` y `kit.rtkGain` no fallan por contenido: devuelven listas vacías o `status` (`internal` solo ante un error inesperado).

## Componentes (sdd/components.json, app-key `apps/studio`)

Registrados en este documento con `status: defined` (el implementador los pasa a `implemented`):

| ID | Nombre | Tipo | Ruta |
| -- | ------ | ---- | ---- |
| COMP-028 | `StudioShell` | layout | `src/components/shell/StudioShell.tsx` |
| COMP-029 | `ModuleRail` | component | `src/components/shell/ModuleRail.tsx` |
| COMP-030 | `RailCustomizeMenu` | component | `src/components/shell/RailCustomizeMenu.tsx` |
| COMP-031 | `ModulePanel` | component | `src/components/shell/ModulePanel.tsx` |
| COMP-032 | `PanelGroup` | component | `src/components/shell/PanelGroup.tsx` |
| COMP-033 | `PanelRow` | component | `src/components/shell/PanelRow.tsx` |
| COMP-034 | `useNav` | hook | `src/lib/nav/use-nav.ts` |
| COMP-035 | `useRailPreferences` | hook | `src/lib/nav/use-rail-preferences.ts` |
| COMP-036 | `HomePanel` | component | `src/components/modules/home/HomePanel.tsx` |
| COMP-037 | `HomeCenter` | component | `src/components/modules/home/HomeCenter.tsx` |
| COMP-038 | `ChannelSummary` | component | `src/components/modules/home/ChannelSummary.tsx` |
| COMP-039 | `SpecsPanel` | component | `src/components/modules/specs/SpecsPanel.tsx` |
| COMP-040 | `SpecCard` | component | `src/components/modules/specs/SpecCard.tsx` |
| COMP-041 | `SpecPlanTab` | component | `src/components/modules/specs/SpecPlanTab.tsx` |
| COMP-042 | `SpecDocumentsTab` | component | `src/components/modules/specs/SpecDocumentsTab.tsx` |
| COMP-043 | `EntityRightPanel` | component | `src/components/modules/specs/EntityRightPanel.tsx` |
| COMP-044 | `FixesPanel` | component | `src/components/modules/fixes/FixesPanel.tsx` |
| COMP-045 | `FixCard` | component | `src/components/modules/fixes/FixCard.tsx` |
| COMP-046 | `AgentsPanel` | component | `src/components/modules/agents/AgentsPanel.tsx` |
| COMP-047 | `AgentCard` | component | `src/components/modules/agents/AgentCard.tsx` |
| COMP-048 | `AgentDirectChat` | component | `src/components/modules/agents/AgentDirectChat.tsx` |
| COMP-049 | `ActivityPanel` | component | `src/components/modules/activity/ActivityPanel.tsx` |
| COMP-050 | `ActivityTimeline` | component | `src/components/modules/activity/ActivityTimeline.tsx` |
| COMP-051 | `useActivityFeed` | hook | `src/lib/activity/use-activity-feed.ts` |
| COMP-052 | `MapPanel` | component | `src/components/modules/map/MapPanel.tsx` |
| COMP-053 | `MapRightPanel` | component | `src/components/modules/map/MapRightPanel.tsx` |
| COMP-054 | `useSwarmPlayback` | hook | `src/lib/map/use-swarm-playback.ts` |
| COMP-055 | `KitPanel` | component | `src/components/modules/kit/KitPanel.tsx` |
| COMP-056 | `KitCenter` | component | `src/components/modules/kit/KitCenter.tsx` |
| COMP-057 | `DocumentContent` | component | `src/components/documents/DocumentContent.tsx` |
| COMP-058 | `KitToolsPanel` | component | `src/components/modules/kit/KitToolsPanel.tsx` |
| COMP-059 | `useKitIndex` | hook | `src/lib/kit/use-kit-index.ts` |
| COMP-060 | `useKitTools` | hook | `src/lib/kit/use-kit-tools.ts` |
| COMP-061 | `useWorkspaceFile` | hook | `src/lib/kit/use-workspace-file.ts` |
| COMP-062 | `ArchitectureView` | component | `src/components/modules/architecture/ArchitectureView.tsx` |
| COMP-063 | `SectionListPanel` | component | `src/components/shell/SectionListPanel.tsx` |
| COMP-064 | `MetricsDashboard` | component | `src/components/modules/metrics/MetricsDashboard.tsx` |
| COMP-065 | `PlanningView` | component | `src/components/modules/metrics/PlanningView.tsx` |
| COMP-066 | `CostsView` | component | `src/components/modules/metrics/CostsView.tsx` |
| COMP-067 | `useCycleRecords` | hook | `src/lib/metrics/use-cycle-records.ts` |

Actualizados (`updated`): **COMP-010 `useCollapsedState`** (ids de grupo por módulo), **COMP-019 `NewConversationButton`** (pasa al pie del riel), **COMP-021 `CapabilityNotice`** (capacidades del kit), **COMP-022 `useBridgeFeatures`** (`BridgeCapability` suma `kit-index`, `kit-tools`, `rtk-gain`).

A deprecar por el implementador al borrar los archivos (D-10): COMP-001 `NavTree`, COMP-002 `NavNodeView`, COMP-003 `ActiveThreads`, COMP-016 `ConversationSelector`.

## Dependencias externas

- **`ajv` ^8.20.0** como dependencia de `apps/studio-bridge` (ya está en el workspace por `validate-sdd.mjs`); se agrega a `external` en `build.js`. Sin `ajv-formats` (`tools.schema.json` no usa formatos).
- `@e-burgos/tucu-ui` 3.7.0 (adoptada en c146f59): `AnimatedTabs`, `SegmentedControl`, `FilterBar`/`FilterPill`, `EmptyState`/`ErrorState`, `StateBadge`, `StatCard`, `ConfirmDialog`, `Switch`, `SplitModal`, `Skeleton`.
- Binario `rtk` del usuario (opcional, solo para `kit.rtkGain`).
- tucu-ui no trae un riel de módulos ni un panel de lista agrupado: `ModuleRail`, `ModulePanel`, `PanelGroup` y `PanelRow` son propios; se reporta como fricción a la sesión «tucu-ui spec 002».

## Riesgos y verificaciones pendientes

| # | Riesgo | Mitigación |
| - | ------ | ---------- |
| R-1 | `ajv` suma una dependencia de runtime al paquete publicado del puente. | Dependencia ya auditada en el workspace; `external` en esbuild; fallback zod si falta el schema en el repo. |
| R-2 | Ventana TOCTOU entre la revisión y el `rename` frente a un escritor externo (D-04). | Aceptado y documentado; la cola cubre todo lo interno. |
| R-3 | Eventos bot anteriores al ciclo no tienen `at`: el orden entre canales es aproximado. | Al final, en orden de archivo por canal, sin hora visible. |
| R-4 | Refactor de `AgentMapCanvas` podría tocar el aspecto de los nodos (pedido explícito del dev). | `AgentNode.tsx` con diff vacío; `agentmap.spec.tsx` como red; captura antes/después en la revisión visual. |
| R-5 | Alcance XL en tres subproyectos. | Orden y cortes del planner (abajo); ninguna task de UI depende de datos nuevos hasta que exista el contrato. |
| R-6 | tucu-ui 3.7.0 entró en c146f59 (spec-009 cycle-06, cerrado). Cualquier ajuste posterior de esa adopción en los mismos archivos (`DocumentViewerModal`, `SegmentedControl`) chocaría con este ciclo. | Las fricciones nuevas de tucu-ui van a la sesión «tucu-ui spec 002»; no se reabre spec-009 en esta rama mientras este ciclo esté abierto. |
| R-7 | Preferencias del riel compartidas entre repos con el mismo `project`. | Aceptado (D-09). |
| R-8 | La documentación del kit se refresca con hasta 30 s de demora (H-13). | Aceptado; no cambia durante una sesión normal. |
| R-9 | `kit.rtkGain` ejecuta un binario del `PATH`. | Igual que el visor del kit: `execFile` sin shell, timeout, caché, solo bajo demanda. |
| R-10 | El e2e de Studio navega con el sidebar y las pestañas actuales. | Se reescriben los pasos de navegación del e2e en la task del shell; los flujos de conversación no cambian. |
| R-11 | La constitution dice `text-body` y el token es `text-copy` (H-17). | Corrección en el fragmento de contexto del cierre. |

## Trazabilidad CA → decisión

| CA (funcional) | Decisión |
| -------------- | -------- |
| CA-001..010 | D-08, D-09, D-15 |
| CA-011..017 | D-09, D-10 (`SidebarSearch`), D-07 (filtro) |
| CA-018..027 | D-09 (riel) |
| CA-028..046 | D-07, D-10, D-05 (`#general`) |
| CA-047..065 | D-11, D-07, D-02 |
| CA-066..070 | D-07, D-02 (`FixSummary.document`), D-11 (`EntityRightPanel`) |
| CA-071..078 | D-12 |
| CA-079..087 | D-12, D-07 |
| CA-088..101 | D-02, D-03, D-13, D-01 |
| CA-102..113 | D-04, D-05, D-13 |
| CA-114..119 | D-13, D-01 |
| CA-120..127 | D-13, D-06 |
| CA-128..133 | D-16, D-01, D-15 |

## Archivos a tocar por subproyecto (orden: protocolo → puente → web)

### 1. `libs/studio-protocol`

- `src/limits.ts`: `MAX_READ_FILE_BYTES`, `MAX_KIT_ENTRIES`, `MAX_CYCLE_DOCUMENTS`; `BRIDGE_FEATURES` + 3.
- `src/snapshot.ts`: `ToolsRevision`, `KitToolsState`, `WorkspaceSnapshot.tools?`, `CycleSummary.documents?`, `SpecSummary.document?`, `FixSummary.document?`.
- `src/kit.ts` (nuevo) y `src/index.ts`: `KIT_SECTIONS`, `KitEntry`, `KitIndex`, `ToolsChange`, `ToolsValue`, `ToolsSetResult`, `RtkGain`.
- `src/commands.ts`: `kit.index`, `kit.tools.set`, `kit.rtkGain`, `channel.botHistory.includeKitEvents`.
- `src/events.ts`: `BotKind` + `tools.changed`, `BotEvent.at?`, `kit.changed`.
- Tests: `snapshot.spec.ts` (snapshot v2 sin campos nuevos parsea; valores malformados caen por `.catch`), `kit.spec.ts` (índice con secciones desconocidas parsea; `path` fuera de `sdd/` rechazado; `ToolsChange` cerrado), `commands.spec.ts` (tres comandos, `includeKitEvents` default `false`, `expectedRevision` obligatorio), `events.spec.ts` (`kit.changed`, `tools.changed`, `at` opcional; una copia del `BotKind` anterior rechaza `tools.changed`, que justifica el filtro), `handshake.spec.ts` (features ≤ 32, `PROTOCOL_VERSION === 2`).

### 2. `apps/studio-bridge`

- `package.json` (`ajv`), `build.js` (`external`).
- `src/workspace/snapshot.ts`: `readToolsState` (bytes crudos, revisión, `modLinked`; nunca falla, devuelve `status`), `documents` por ciclo, `document` de spec y de fix; `AREA_FIELDS.tools` incluye `tools` para `changedAreas`, y `mergeSnapshot` no restaura `tools` desde el anterior (lleva su propio `status`).
- `src/workspace/kit-tools.ts` (nuevo): `applyToolsChange` (pura), `effectiveTools`, `KitToolsWriter` (cola, revisión, ajv, escritura atómica), `ToolsError`.
- `src/workspace/tools-validator.ts` (nuevo): ajv contra `<root>/sdd/schemas/tools.schema.json` (caché por `mtime`) y fallback zod.
- `src/workspace/kit-index.ts` (nuevo): `buildKitIndex`, huellas por sección, `KitIndexer` armado bajo demanda.
- `src/workspace/rtk-gain.ts` (nuevo): resolución del binario y `rtk gain` con caché.
- `src/workspace/watcher.ts`: ganchos `onPath`/`onRescan` para el `KitIndexer`.
- `src/sessions/store.ts`: deduplicación sin `at`; filtro de `tools.changed` en `botHistory` salvo `includeKitEvents`.
- `src/server/router.ts`: `kit.index`, `kit.tools.set`, `kit.rtkGain`, `channel.botHistory` con la opción; `MAX_READ_BYTES` → `MAX_READ_FILE_BYTES`.
- `src/main.ts`: estampa `at`, difunde `kit.changed`, crea `KitToolsWriter`/`KitIndexer`.
- Tests: `kit-tools.spec.ts` (cada cambio, no-op, `not-found`, JSON inválido, schema inválido antes, `conflict`, cola sin escrituras intercaladas, `modLinked`/`mod-not-linked`, orden de claves), **`kit-tools.parity.spec.ts`** (repo temporal con `sdd/scripts/{setup-rtk,sdd-mod,rtk-common}.mjs` del repo y varios `tools.json` de entrada; corre `node … --enable|--disable|--gate=warn|block` con `SDD_RTK_SKIP_INSTALL=1` y compara bytes con `applyToolsChange`), `kit-index.spec.ts` (secciones, roles, grupos, tope y `truncated`, archivos con punto y no regulares fuera, huellas que cambian solo en la sección tocada), `rtk-gain.spec.ts` (binario falso por `RTK_BIN`: ok, ausente, timeout, JSON inválido), `snapshot.spec.ts` (tools ok/missing/invalid, documentos por ciclo, `artifacts/`, spec y fix), `store.spec.ts` (dedupe sin `at`, filtro), `router.spec.ts`, `watcher.spec.ts` (`kit.changed` tras crear un journal).

### 3. `apps/studio`

- Navegación y shell: `lib/nav/{modules.ts,use-nav.ts,use-rail-preferences.ts,derive.ts}`, `components/shell/*`, `components/WorkspaceApp.tsx` (`Connected` monta `NavProvider` + `StudioShell`), `components/StudioHeader.tsx`, `lib/typography-tokens.ts`.
- Módulos: `components/modules/{home,specs,fixes,agents,activity,map,kit,architecture,metrics}/*`, `components/documents/DocumentContent.tsx`, `components/mission-control/{AgentMapCanvas,DocumentViewerModal}.tsx` (extracciones), `lib/{activity,kit,map,metrics}/*`, `lib/kit/registries.ts`.
- Protocolo en la web: `lib/bootstrap.ts` (`includeKitEvents` con `kit-tools`), `lib/store/state.ts` (`kit.changed` → invalidación), `lib/use-bridge-features.ts`, `lib/format.ts` (`bot.tools.changed`), `lib/i18n/{es,en}.ts` (claves nuevas sin reordenar).
- Borrados al final: `Workspace.tsx`, `Sidebar.tsx`, `SidebarHeader.tsx`, `SidebarRail.tsx`, `NavTree.tsx`, `NavSections.tsx`, `AgentInspectorDrawer.tsx`, `ConversationSelector.tsx`, `lib/use-studio-view.ts` y sus specs.
- Tests: `derive.spec.ts` (RN-5/6/8/9/11, filtros del Mapa, orden de actividad con y sin `at`), `use-rail-preferences.spec.ts` (reconciliación, corrupto, `home` fijo, por proyecto), `use-nav.spec.ts` (persistencia, migración de `active-view`, selección inexistente), `modules.spec.ts` (RN-1/RN-2), `typography.spec.tsx`, `shell.spec.tsx` (riel, ⌘K, teclado, «Más»), specs de cada panel y ficha, `kit-tools.spec.tsx` (confirmación, cancelación, `conflict`, error, solo lectura), `agentmap.spec.tsx` ajustado, e2e Playwright con `--engine fake` reescrito para la navegación nueva más un caso de herramientas.

### Orden para el planner (lo que va primero)

1. **Protocolo completo** (una task): todo lo de `libs/studio-protocol` con sus tests. Desbloquea puente y web.
2. **En paralelo después del protocolo:**
   - Puente: snapshot ampliado → `kit-tools` + validador + paridad → `tools.changed`/`at`/filtro → `kit-index` + `kit.changed` → `rtk-gain`.
   - Web, sin datos nuevos: shell + registro + `useNav` + riel personalizable + header (con los módulos como placeholders) → Inicio → Specs (Resumen/Tareas/Conversaciones) → Fixes → Agentes + `AgentCard` + chat directo → Mapa en tres columnas → Métricas (Dashboard, Planificación, Ecosistema, Telemetría) → Actividad.
3. **Web con datos nuevos** (cada una después de su parte del puente): Plan/Documentos de la ficha (`documents`), Kit (índice y contenido), Herramientas (`kit-tools`), Costos con rtk (`rtk-gain`), Arquitectura (puede ir antes: usa `workspace.readFile`).
4. **Último:** borrado de la navegación vieja, test de escala, e2e y recorrida visual.

### Cierre (no es implementación)

Fragmentos aditivos en `updates/` de los tres subproyectos (incluida la corrección de `text-body` → `text-copy` y la nueva navegación), fila de `sdd/context/constitution.md`, `components.json` a `implemented`/`deprecated`, `sdd:validate` y `sdd:rebuild-tasks-index`: responsabilidad de quien cierra el ciclo.
