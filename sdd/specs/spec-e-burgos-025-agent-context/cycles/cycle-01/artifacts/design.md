# Spec 025 — Contexto por agente y ejecución de ciclos (diseño aprobado)

> Estado: **aprobado por el dev el 2026-11-17** con las seis recomendaciones de §16 (bloques continuados, `packs.json` y
> `verify.json`, `project.md` con migración explícita, regla del gate de §11, dos ciclos, prueba controlada). Rama `feat/sdd-session-where`.
> Rutas relativas a `apps/cli/templates/sdd/` salvo que se indique otra cosa.

## 0. Resumen

El costo fijo por agente es mayor al estimado (56k tokens el implementador back, 80k el front,
75k el reviewer, si obedecen lo que el kit les manda leer) y se paga una vez por task. El diseño
lo ataca en cuatro frentes, de mayor a menor retorno:

1. **Un agente por bloque, continuado task por task** (`SendMessage`), no un agente por task ni un
   agente que hace el bloque de corrido. Conserva el gate por task y la telemetría **exacta** por
   task, sin prorrateo.
2. **Paquete determinista por unidad** (`pnpm sdd:pack`): el agente lee un archivo de ~12k tokens
   en vez de ~56k. El manifiesto vive en `sdd/packs.json`, no en el frontmatter.
3. **Verificación en dos niveles con comando propio** (`pnpm sdd:verify`), declarada en
   `sdd/verify.json`, con resultado persistido (el reviewer no la repite) y lease de máquina.
4. **Núcleo compartido de ~1.500 tokens** en `CLAUDE.md`/`AGENTS.md`/`GEMINI.md`; el resto pasa a
   reglas bajo demanda. Las instrucciones propias del repo salen a un archivo aparte para que el
   kit pueda actualizarse sin `.new`.

Cambios respecto de tus hipótesis: descarto `artifacts/cycle-context.md` como documento, el
manifiesto en frontmatter, el prorrateo de tokens como mecanismo principal, `verify` dentro de
`constitution.md` y el contexto inline «para el caché». Las razones están en §12.

---

## 1. Diagnóstico verificado

### 1.1 Causas raíz

| # | Hipótesis | Veredicto | Evidencia |
| - | --------- | --------- | --------- |
| 1 | La unidad de despacho es la task | Confirmada | `agents/sdd-implementor-back.agent.md:3,24`; `skills/sdd-implementor-back/SKILL.md:3,12-19`; `agents/sdd-orchestrator.agent.md:55,333,338` |
| 2 | El input son documentos enteros | Confirmada | `agents/sdd-implementor-back.agent.md:48-54`; front `:54-59` suma `api.json` y `components.json` enteros |
| 3 | Contexto compartido grande y no opcional | Confirmada, con matiz | `CLAUDE.md` raíz es symlink a `dual-harness/CLAUDE.md` (`scripts/setup-agents.sh:173`), 28.301 B. El hook reinyecta 2.721 B (`scripts/rule-zero-hook.mjs`). **No pude verificar** si SessionStart corre en subagentes |
| 4 | Skills de referencia monolíticas | Confirmada para implementadores, planner, architect y reviewer. **Ya mitigada para el orquestador**: `agents/sdd-orchestrator.agent.md:78-80` dice «por sección» | `agents/sdd-implementor-back.agent.md:11,17` manda leer `sdd-data-schemas` (42.916 B); el implementador usa §6 (5.936 B) |
| 5 | Un solo nivel de verificación | Confirmada | `skills/sdd-implementor-back/SKILL.md:18` (línea 18, no 16). La constitution generada no tiene sección de comandos (`examples/ctx-measure/sdd/context/apps/billing-api/constitution.md`: 4 secciones, 759 B) |
| 6 | El planner solo tiene techo | Confirmada | `skills/sdd-planner/SKILL.md:23`; `agents/sdd-planner.agent.md:74` |
| 7 | Sin coordinación de recursos pesados | Confirmada | `scripts/lib/session-registry.mjs:337-475`: los leases son por archivo (`leaseKey(rel)`); no hay recurso global |
| 8 | Telemetría asume un agente por task | **Parcialmente falsa** | `agents/sdd-orchestrator.agent.md:241-243` ya contempla reanudar el mismo subagente con `SendMessage` y registrar la **diferencia** entre notificaciones. Es la base del diseño de bloques |
| 9 | El SPEC GATE bloquea documentos | Confirmada | `skills/sdd-mod/hooks/.src/sdd.ts:64-73,456-460`: exentos solo los `.md` de la raíz y los directorios `sdd`, `.claude`, `.github`, `.gemini`, `.agents`, `.agent`, `.vscode`, `.idea`. `docs/prompts/x.md` cuenta como código |

Hallazgos que no estaban en tu lista:

- **`components.json` entero en cada task de front.** En este repo pesa 94.354 B (~23k tokens).
- **`tasks.json` se edita a mano en cada task.** Pesa entre 22 y 58 KB en los ciclos `full` de
  este repo; el agente lo lee y lo reescribe por task.
- **`sdd-gates.md` (11.967 B) figura como «fuente canónica» en el agente implementador**, que solo
  necesita el resultado de `pnpm sdd:gate`.
- **En Antigravity las tres reglas son `trigger: always_on`**: 21.038 B siempre cargados además de
  `GEMINI.md` (28.606 B).
- **`pnpm sdd:validate` no es un costo**: 0,45 s y 226 B de salida en este repo. Se queda por task.
- **Las reglas de estilo están triplicadas**: `CLAUDE.md`, `rules/sdd-code-style.md` y cada
  `sdd-implementor-*.agent.md` (líneas 28-46).

### 1.2 Carga por rol (medida)

Método: bytes de lo inyectado (`CLAUDE.md`) más lo que `agent.md` y la skill del rol mandan leer,
más los documentos del ciclo. Documentos de ciclo: `spec-e-burgos-011` cycle-01 de este repo
(`full`, 26 tasks; architect 42 KB, planner 41 KB, functional 30 KB). Contexto de subproyecto:
`sdd/context/apps/cli` (20.621 B con sus `updates/`). ~4 B por token. Script:
`/private/tmp/claude-501/-Users-macbookprom2-github-personal-projects-sdd-harness/6b4b1be1-acdf-4fa4-8f2c-067de66fb5be/scratchpad/measure.mjs`.

| Rol | Kit (B) | Ciclo (B) | Total (B) | Tokens aprox. |
| --- | ------: | --------: | --------: | ------------: |
| orquestador | 157.706 | 50.300 | 208.006 | 52k |
| functional | 68.172 | 7.292 | 75.464 | 19k |
| planner | 120.099 | 53.301 | 173.400 | 43k |
| architect | 114.900 | 56.720 | 171.620 | 43k |
| implementor-back | 93.596 | 130.909 | 224.505 | **56k** |
| implementor-front | 94.373 | 225.263 | 319.636 | **80k** |
| reviewer | 142.710 | 158.932 | 301.642 | 75k |

Es una **cota superior**: asume que el agente lee completo todo lo que se le indica. El orquestador
está sobreestimado, porque su agente ya dice «por sección».

### 1.3 Consumo real por task (de `tasks.json → usage` de este repo)

| Ciclo `full` | Tasks | Tokens totales | Mediana por task | Fuente |
| ------------ | ----: | -------------: | ---------------: | ------ |
| spec-011 (kit) | 26 | 1.043.817 | 36.786 | 24 exactas, 2 estimadas |
| spec-013 (Studio) | 23 | 2.032.587 | 74.276 | 23 exactas |
| spec-010 (Studio) | 30 | 4.864.615 | 126.993 | 29 exactas, 1 estimada |

La mediana de spec-011 (37k) queda por debajo de la cota de 56k: los agentes no leen todo lo
indicado, o `subagent_tokens` no cuenta las lecturas de caché. **No sé cuál de las dos**; por eso
la medición «después» tiene que ser sobre `subagent_tokens` reales y no sobre bytes (§11).

Un punto que condiciona el diseño: lo que el agente carga al principio se vuelve a enviar en
cada turno de su bucle (como lectura de caché). El costo fijo pesa más que su tamaño nominal, y
por el mismo motivo un bloque largo se encarece: la task 4 arrastra el historial de las tres
anteriores.

---

## 2. Capas de contexto

| Capa | Qué es | Quién la recibe | Tamaño objetivo |
| ---- | ------ | --------------- | --------------- |
| 0 — núcleo | `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` adelgazados | Todos, inyectado por el arnés | ≤ 6.000 B (~1.500 tokens) |
| 1 — rol | `agents/sdd-<rol>.agent.md` adelgazado | El agente de ese rol | ≤ 3.500 B |
| 2 — paquete | `artifacts/packs/<unidad>.<rol>.md`, generado por `sdd:pack` | El agente de esa unidad | 8–14k tokens según rol |
| bajo demanda | `dual-harness/rules/*.md`, skills de referencia | Quien lo necesite, cuando un disparador lo indica | — |

No hay capa «contexto del ciclo» como documento aparte: es la primera sección del paquete (§4).

### 2.1 Núcleo (capa 0)

Contenido, en este orden:

1. Bloque `<!-- regla-cero:start/end -->` con regla cero y regla uno (hoy 2.721 B; se le suma la
   línea Fable/Opus de §10).
2. Solo pnpm; dónde viven los proyectos.
3. SPEC GATE en tres líneas: los dos comandos y qué significa `BLOCKED`.
4. Código sin comentarios, en cuatro líneas, con puntero a `rules/sdd-code-style.md`.
5. Telemetría: «ninguna unidad se cierra sin `usage`», con puntero a `rules/sdd-model-budget.md`.
6. **Tabla de disparadores**: «si pasa X, leé Y antes de seguir».

| Disparador | Leer |
| ---------- | ---- |
| El pedido trae `[HOTFIX]`, `[BUGFIX]`, `[FIX]`, `[IMPROVEMENT]` | `rules/sdd-gates.md` § FIX GATE |
| Una edición vuelve con `SPEC GATE:` o `SDD reserva:` | El propio mensaje (ya trae la acción); detalle en `rules/sdd-gates.md` |
| Vas a abrir, ejecutar o cerrar un ciclo | `rules/sdd-execution.md` (nuevo: bloques, paquetes, verify) |
| Vas a cerrar un ciclo o fix | `rules/sdd-context.md` (nuevo: fragmentos aditivos, CONTEXTO GATE, MEMORIA GATE) |
| Sos la sesión principal y recién empezás | `sdd/memory/lessons.md`; chequeo de workspace en `rules/sdd-workspace.md` |
| Tocás graphify, rtk, sdd-mod, tucu-ui o video-maker | `rules/sdd-tools.md` (nuevo) |
| Elegís modelo para un subagente | `rules/sdd-model-budget.md` (tabla de tiers) |

Qué se pierde al sacar una regla del núcleo, y cómo se cubre:

- **Reglas que se disparan por un mensaje de herramienta** (`SPEC GATE:`, `SDD reserva:`): no se
  pierde nada si el mensaje es autosuficiente. Hoy `session-registry.mjs:314` y `:468` ya traen
  la acción y la ruta de la regla. Se revisan todos los rechazos del mod para que cumplan eso.
- **Reglas que se disparan por el pedido** (FIX GATE): una fila en la tabla. El riesgo real es que
  un agente no reconozca un fix sin prefijo; hoy ese riesgo ya existe y lo cubre el orquestador
  (`agents/sdd-orchestrator.agent.md:145-181`), que no cambia.
- **Reglas de cierre** (contexto, memoria): las ejecuta un solo actor (reviewer u orquestador), y
  su `agent.md` las referencia. Un implementador no las necesita nunca.
- **Opcionales** (graphify, rtk, tucu-ui, video-maker, mod): la regla «nunca lo prendas ni apagues
  por tu cuenta» se condensa en **una** línea del núcleo que cubre a las cinco.

### 2.2 Instrucciones propias del repo

Hoy `harness configure sdd` las absorbe **dentro** de `dual-harness/CLAUDE.md` bajo
«Instrucciones previas del proyecto (absorbidas al instalar SDD)». Eso vuelve híbrido el archivo
y bloquea toda actualización futura del núcleo.

Propuesta: pasan a `sdd/dual-harness/project.md`, que es del dev y `update sdd` nunca toca.

- `CLAUDE.md` termina con `@sdd/dual-harness/project.md` (import nativo de Claude Code).
- `GEMINI.md` usa el import de Gemini CLI; `AGENTS.md` lleva un puntero en prosa («leé
  `sdd/dual-harness/project.md`»), porque no tiene imports.
- Instalaciones nuevas: el absorbedor escribe en `project.md`.
- Repos existentes: §9.

### 2.3 `agent.md` (capa 1)

Cada `agent.md` conserva rol, límites, protocolo y formato de salida. Sale lo que ya está en el
núcleo (estilo de código), los ejemplos de JSON de telemetría (los reemplaza `sdd:task`, §7) y la
lista de documentos a leer, que pasa a ser una sola línea: «tu contexto es el paquete que te
indica el orquestador; no leas documentos del ciclo fuera de él salvo que te falte algo».

---

## 3. Manifiesto y selectores

**Dónde:** `sdd/packs.json`, con schema en `sdd/schemas/packs.schema.json`. No en el frontmatter:
los `.agent.md` se enlazan en `.claude/agents` y `.github/agents`, y no hay garantía de que
Copilot acepte claves desconocidas ahí.

```json
{
  "$schema": "./schemas/packs.schema.json",
  "execution": { "max_tasks_per_batch": 4, "max_points_per_batch": 12, "max_parallel_batches": 1 },
  "roles": {
    "implementor-back": {
      "unit": "batch",
      "include": ["cycle", "tasks:@unit", "plan:@unit", "refs:@unit", "context:@app",
                  "registry:api@app", "verify:@app", "protocol:implementor"]
    },
    "implementor-front": {
      "unit": "batch",
      "include": ["cycle", "tasks:@unit", "plan:@unit", "refs:@unit", "context:@app",
                  "registry:api@refs", "registry:components@app:index", "verify:@app",
                  "protocol:implementor"]
    },
    "reviewer": { "unit": "cycle", "include": ["cycle", "tasks:@all:summary", "acceptance",
                  "verify-results", "context:@app:prompt", "protocol:reviewer"] },
    "functional": { "unit": "cycle", "include": ["cycle", "spec", "context:@app:prompt", "template:functional"] },
    "planner": { "unit": "cycle", "include": ["cycle", "doc:functional", "index:architect",
                  "context:@app", "template:planner", "template:tasks"] },
    "architect": { "unit": "cycle", "include": ["cycle", "doc:functional", "registry:api@app",
                  "registry:schema@app", "context:@app", "template:architect"] }
  }
}
```

| Selector | Qué emite |
| -------- | --------- |
| `cycle` | Objetivo, alcance y restricciones de `brief.yaml` (o de `plan.md` en `lite`), más flow y apps |
| `tasks:@unit` | Las entradas de `tasks.json` de la unidad, sin `usage` |
| `tasks:@all:summary` | Una línea por task: id, título, status, archivos |
| `plan:@unit` | Las secciones `### TASK-NNN` de `planner.md` de la unidad |
| `refs:@unit` | Las secciones citadas en `refs` de las tasks de la unidad (§3.1), sin duplicar |
| `index:<doc>` | Índice de encabezados del documento con rango de líneas |
| `doc:<nombre>` | El documento entero (solo roles que lo transforman: planner y architect) |
| `context:@app[:prompt]` | `context_prompt.md` y `constitution.md` del subproyecto, con sus `updates/*.md` aplicados en orden; `:prompt` deja solo el primero |
| `registry:<json>@app[:index]` | El recorte del registro bajo el app-key; `:index` deja nombre y ruta |
| `registry:api@refs` | Solo los endpoints nombrados en las secciones citadas |
| `verify:@app` | Los comandos `quick` y `full` de `sdd/verify.json` |
| `verify-results` | Resultados persistidos de `sdd:verify` (§6) |
| `acceptance` | Los criterios de aceptación de `functional.md` (bloques `CA-`) |
| `template:<x>` | Solo ese template de `sdd-file-structure` |
| `protocol:<rol>` | Los pasos de cierre del rol (qué comando corre al terminar cada task) |

Sin entrada para un rol en `packs.json`, `sdd:pack` no genera nada y el agente trabaja como hoy.

### 3.1 Direccionar secciones sin reescribir documentos

Los `architect.md` existentes ya traen identificadores estables en los encabezados
(`### D-04. …` en spec-011, 14 decisiones; `CA-NNN`, `RN-NN`, `US-N-NNN` en functional). Se
aprovechan en vez de inventar anclas.

- Campo opcional en la task: `"refs": ["architect#D-04", "architect#D-07", "functional#US-2-001"]`.
- Resolución de `<doc>#<token>`, en orden: encabezado cuyo texto empieza con el token como
  palabra completa; si no, igualdad del texto normalizado (minúsculas, sin acentos ni signos).
- La sección va desde ese encabezado hasta el siguiente de nivel igual o superior.
- Token que no resuelve: el paquete lo lista arriba como «no resuelto», agrega el índice del
  documento, y `sdd:validate` avisa.
- **Task sin `refs`** (ciclos viejos, o el planner no las puso): el paquete trae el índice de
  encabezados con rangos de línea, y el agente lee solo lo que necesita con `Read offset/limit`.
  Esto solo ya reemplaza «leer las 900 líneas» sin tocar ningún documento existente.

El template de `architect.md` (`sdd-file-structure` §3.6) pasa a pedir decisiones numeradas
`D-NN`, que es lo que los arquitectos ya hacen.

---

## 4. `pnpm sdd:pack`

```bash
pnpm sdd:pack <spec> cycle-XX <rol> [B-NN|TASK-NNN]   # escribe el paquete e imprime su ruta
pnpm sdd:pack <spec> cycle-XX --stats                  # bytes por rol y por unidad, sin escribir
```

- **Lo arma un script, entero.** Es determinista, no gasta tokens y se puede auditar. El
  orquestador aporta juicio en un solo lugar: las líneas libres del prompt de despacho.
- **El orquestador lo corre justo antes de despachar.** El paquete nunca está viejo al usarse, así
  que no hace falta un chequeo de frescura en el validador. Guarda igual los hashes de sus
  fuentes en el encabezado, para auditoría.
- **Salida:** `sdd/specs/<spec>/cycles/cycle-XX/artifacts/packs/<unidad>.<rol>.md`. Es derivado:
  se ignora con un `sdd/.gitignore` propio del kit (no se toca el `.gitignore` del usuario).
- **El prompt de despacho queda en ~5 líneas:** rol, unidad, ruta del paquete, primera task,
  notas del orquestador.
- **Forma del paquete:** encabezado (unidad, fuentes y hashes, refs no resueltas), después las
  secciones en el orden del manifiesto.

Implementación: `scripts/sdd-pack.mjs` más `scripts/lib/pack.mjs` (funciones puras, testeables),
sin dependencias nuevas. Los fragmentos `updates/*.md` se concatenan en orden de nombre debajo
del archivo base; no se intenta fundirlos.

---

## 5. Bloques y planner

### 5.1 Modelo

Campo opcional de nivel raíz en el `tasks.json` del ciclo:

```json
"batches": [
  { "id": "B-01", "app": "apps/billing-api", "role": "implementor-back",
    "tasks": ["TASK-001", "TASK-002", "TASK-003"], "depends_on": [] }
]
```

Va en la raíz y no como campo de cada task porque el bloque tiene datos propios (app, rol,
dependencias) y así el orden queda en un solo lugar. La task sigue siendo la unidad de
trazabilidad: status, `files`, `usage` y commit propios.

### 5.2 Ejecución: un agente por bloque, continuado

1. El orquestador corre `sdd:pack … B-01` y lanza **un** agente con la primera task.
2. El agente implementa, corre `verify quick`, commitea y cierra la task (`sdd:task done`).
3. Llega la notificación con `subagent_tokens` acumulado. El orquestador registra la diferencia
   en el `usage` de esa task y verifica que quedó `done`.
4. El orquestador manda `SendMessage` al **mismo** agente: «seguí con TASK-002». El contexto del
   agente sigue intacto: no relee nada.
5. Después de la última task: «corré `verify full`». Su costo se registra en el `usage` de la
   última task.

Por qué esto y no «el agente hace el bloque de corrido»:

- **La telemetría por task es exacta**, con `source: agent-usage-notification` y `approx: false`.
  No hay prorrateo ni cambio de schema. La resta entre notificaciones ya está documentada en
  `agents/sdd-orchestrator.agent.md:241-243`.
- **El gate por task sigue en manos del orquestador**: no avanza si la task no quedó `done` con
  `usage`.
- **Se puede cortar en cualquier task**: si falló dos veces, o el agente avisa que su contexto se
  compactó, el orquestador cierra ese agente y despacha el resto del bloque en uno nuevo.

Costo conocido: la primera task del bloque carga con el paquete. Es real, no un artefacto; se
documenta en la vista Costos.

### 5.3 Reglas del planner

- **Techo:** se mantiene (≤ 1 día, ≤ 5 SP).
- **Piso:** una task de menos de 1 hora se fusiona con su vecina, salvo que sea la única de su
  zona o una task de tests.
- **Bloques:** tasks de la misma app y rol, contiguas en el orden topológico, hasta 4 tasks y
  12 SP (`packs.json → execution`). El tope es por puntos y no solo por cantidad, porque el
  historial del agente crece con cada task.
- **`refs` por task:** las decisiones del architect y las historias que implementa. El planner
  corre en paralelo con el architect; por eso el orquestador las completa al recibir ambos
  documentos, con el índice de encabezados, si el planner no pudo.

Con las 24 tasks del caso real (2–4 h cada una): entre 7 y 9 bloques.

### 5.4 Paralelismo

Dos bloques corren a la vez solo si tienen distinta `app` y ninguno depende del otro.
`max_parallel_batches` vale 1 por defecto. Con el mod prendido, los leases de archivo ya frenan
un choque; sin el mod, el orquestador no paraleliza bloques de la misma app.

---

## 6. Verificación en dos niveles y lease

### 6.1 Declaración: `sdd/verify.json`

```json
{
  "$schema": "./schemas/verify.schema.json",
  "apps/billing-api": {
    "quick": ["pnpm nx run billing-api:lint", "pnpm nx run billing-api:test --findRelatedTests {files}"],
    "full": ["pnpm nx run-many -t lint test build"],
    "full_exclusive": true
  }
}
```

No va en `constitution.md` por tres razones: es un archivo que no se edita durante un ciclo, el
script necesitaría parsear markdown, y los generadores (`add app`, `scaffold-nx`) pueden escribir
los comandos correctos por stack en un JSON con schema.

Sin entrada para el subproyecto, `sdd:verify` lo dice y el agente verifica como hoy;
`sdd:validate` avisa.

### 6.2 Comando

```bash
pnpm sdd:verify <app> quick [--files a,b]
pnpm sdd:verify <app> full  [--unit B-01]
```

- Corre los comandos declarados y corta en el primero que falla.
- Escribe el resultado en `artifacts/verify/<unidad>-<nivel>.json`: comandos, exit code,
  duración y el commit sobre el que corrió.
- **El reviewer lee ese resultado.** Solo repite `full` si no hay uno en verde para el `HEAD`
  actual. Hoy lo repite siempre.

### 6.3 Niveles

| Nivel | Cuándo | Quién |
| ----- | ------ | ----- |
| `quick` | Al cerrar cada task | Implementador |
| `full` | Al cerrar cada bloque | Implementador, último mensaje del bloque |
| `full` | Al cerrar el ciclo, solo si no hay uno verde para `HEAD` | Reviewer |

### 6.4 Lease

`full` con `full_exclusive: true` toma un lease **de máquina**, no de repo: el recurso que se
agota es la memoria, y las otras sesiones pueden ser de otro repositorio.

- Archivo en el directorio temporal del sistema (`sdd-harness/verify-full.lock`): pid, sesión,
  repo, inicio. Se renueva mientras el comando corre.
- Si el pid del dueño no existe, el lease está muerto y se toma.
- Si está ocupado, espera hasta un tope (10 min por defecto) e informa quién lo tiene. Vencido el
  tope, sale con un código propio y el agente lo reporta en vez de forzar.
- Vive en `scripts/lib/verify-lease.mjs`, **fuera** de `session-registry.mjs`, para no cambiar el
  módulo que Studio carga en tiempo de ejecución.

Límite: solo coordina procesos que usan `sdd:verify`. Un `pnpm test` lanzado a mano no lo respeta.

---

## 7. Telemetría

- **Claude Code, bloques continuados:** exacta por task, como hoy (§5.2). Sin cambios de schema.
- **Arneses sin `SendMessage`** (Copilot, Antigravity, Gemini CLI): una sesión hace el bloque en
  secuencia y declara una estimación por task con `approx: true`, igual que hoy.
- **Agente que hizo varias tasks sin cortes** (corte de emergencia): el total se reparte en
  proporción a `estimation_hours`; el resto va a la última task para que la suma sea exacta.
  Cada task lleva `approx: true` y un campo opcional nuevo
  `"allocation": { "batch": "B-02", "batch_tokens": N }`. El total del ciclo no se falsea; solo
  el reparto es aproximado, y queda marcado.
- **`pack_misses`:** campo opcional en `usage`, lista de hasta 5 rutas que el agente leyó fuera
  del paquete. Sin narrativa. `sdd:pack --stats` las agrega entre ciclos para ajustar
  `packs.json`. Es autodeclarado, así que sirve como señal y no como métrica.
- **`pnpm sdd:task <spec> cycle-XX TASK-NNN start|done [--files …] [--tokens N …]`:** escribe
  status, `files` y `usage` en `tasks.json`, regenera el índice y valida. El agente deja de leer
  y editar a mano un archivo de 22–58 KB por task, y deja de necesitar el schema.

La vista Costos (`docs/app.js`) no cambia: ya lee `tokens_total` y `approx`. Se le suma una
etiqueta para `allocation`.

---

## 8. Impacto por arnés

| | Claude Code | Copilot | Antigravity / Gemini CLI |
| --- | --- | --- | --- |
| Núcleo | `CLAUDE.md` adelgazado, inyectado en sesión y subagentes | `copilot-instructions.md` ya es un resumen de 3.144 B: se alinea con el núcleo | `GEMINI.md` adelgazado |
| Bajo demanda | Reglas leídas por disparador | Igual, por puntero | Las reglas nuevas llevan `trigger: model_decision`; `sdd-gates`, `sdd-model-budget` y `sdd-code-style` siguen `always_on` |
| Paquete | El orquestador corre `sdd:pack` y pasa la ruta | El dev o el agente corre `sdd:pack` y abre el archivo | Igual que Copilot |
| Bloques | Un subagente continuado con `SendMessage` | Una sesión por bloque, en secuencia | Igual que Copilot |
| Telemetría | Exacta por task | Estimación declarada por task | Estimación declarada; `/stats` en Gemini CLI |
| Verify | `sdd:verify` | `sdd:verify` | `sdd:verify` |

Tope de 12.000 caracteres: `sdd-gates.md` está en 11.967 y **no se toca**. Todo lo nuevo va a
archivos nuevos: `sdd-execution.md`, `sdd-context.md`, `sdd-tools.md`, `sdd-workspace.md`, cada
uno bajo 8.000. `sdd-model-budget.md` (7.702) recibe la tabla de tiers y la regla de §10.

---

## 9. Migración y retrocompatibilidad

- **Schemas:** todo lo nuevo es opcional (`batches`, `refs`, `allocation`, `pack_misses`;
  `packs.json` y `verify.json` son archivos nuevos). Nada pasa a `required`.
- **Validador:** solo avisos nuevos (ref sin resolver, subproyecto sin `verify.json`, `CLAUDE.md`
  por encima del tamaño del núcleo, bloque que excede el tope).
- **Ciclos abiertos o viejos:** sin `batches` se ejecutan task por task; sin `refs` el paquete
  trae el índice. Ningún documento existente se reescribe.
- **Repos sin instrucciones absorbidas:** `update sdd` reemplaza los tres archivos de arnés, como
  cualquier archivo del kit sin modificar.
- **Repos híbridos:** siguen recibiendo `.new`. Se agrega un paso **explícito** en `update sdd`
  (pregunta, o `--split-project`): corta el archivo en el encabezado «Instrucciones previas del
  proyecto (absorbidas al instalar SDD)», mueve lo de abajo a `project.md` y, si lo de arriba
  coincide con una versión publicada del kit, lo reemplaza. Si no coincide, queda el `.new`.
  Nunca corre solo.
- **Studio:** no cambia `session-registry.mjs`. `tasks.json` gana campos opcionales que Studio
  ignora; hay que confirmar que su lector no valida con `additionalProperties` estricto.
- **Regla uno, `sdd:use`, mod:** sin cambios. El subagente de bloque corre el GATE B una vez, y
  eso lo ata al ciclo, como hoy.
- **CONTEXTO GATE y MEMORIA GATE:** sin cambios de fondo; su texto se muda a `sdd-context.md`.

Verificación del delta contra datos reales, antes de cerrar: correr el validador nuevo sobre el
`sdd/` de este repo (25 specs, ciclos `full` y `lite`) y sobre un ejemplo generado con la 0.22.0.

---

## 10. Regla Fable/Opus en el kit

Texto para el bloque regla-cero de `CLAUDE.md`, `AGENTS.md` y `GEMINI.md` (una viñeta, ~330
caracteres; el bloque queda cerca de 3.100):

> **Máximo no es el default del trabajo difícil.** Antes de elegir el tier máximo, decidí
> explícitamente «máximo o alto» y escribí por qué el tier alto no alcanza. Vale para diseño
> crítico sin precedente en el repo, trade-offs entre muchos subsistemas o un verify/judge
> adversarial. Ningún subagente va en máximo sin esa justificación.

- `copilot-instructions.md`: una frase en el punto 0.
- Tabla de tiers (`sdd-model-budget.md`): la fila «máximo» cambia su columna de tipo de tarea a
  «solo con justificación escrita de por qué alto no alcanza».
- El validador ya exige `REGLA UNO` dentro del bloque; no se agrega un chequeo por esta viñeta.

---

## 11. Qué cuenta como código para el gate (punto 9)

Regla nueva de `isCodePath` (`skills/sdd-mod/hooks/.src/sdd.ts:456`):

- **Código:** todo lo que está bajo `apps/`, `libs/` o `tools/`, y todo archivo que no sea
  markdown fuera de los directorios exentos. Igual que hoy.
- **Exento, nuevo:** los `.md` y `.mdx` cuyo primer segmento no es `apps`, `libs` ni `tools`.
  Cubre `docs/prompts/*.md`.
- **Exento, configurable:** `sdd/tools.json → claude_mod.exempt` con una lista de globs, para
  casos como un sitio de documentación bajo `apps/`. Lo edita el dev, no el agente.

Por qué no eximir todo `.md`: en este repo `apps/cli/templates/sdd/**/*.md` **es** el producto
que se publica en npm, y en un sitio de docs los `.mdx` también. El invariante del kit dice que
los proyectos viven en `apps/`, `libs/` y `tools/`, así que eso define qué es código.

Modo standalone: el código vive en `src/` en la raíz; un `.md` ahí quedaría exento. Lo considero
aceptable y lo dejo anotado.

---

## 12. Alternativas descartadas

| Alternativa | Por qué no |
| ----------- | ---------- |
| `artifacts/cycle-context.md` como documento del ciclo | Sería un quinto documento que alguien escribe y que envejece. Todo su contenido sale de `brief.yaml`, el índice del architect y el contexto del subproyecto, de forma determinista. Queda como sección del paquete |
| Contexto del ciclo inline al principio del prompt, para el caché | El orquestador pagaría ese texto como **salida** en cada despacho, y la salida es lo más caro. El caché ya funciona dentro del bucle de cada agente. Con ~8 agentes por ciclo, compartir prefijo entre agentes ahorra poco. No pude verificar el orden en que Claude Code arma el prompt de un subagente; el diseño no depende de eso |
| Manifiesto en el frontmatter del `agent.md` | El mismo archivo lo leen tres arneses; claves desconocidas son un riesgo en Copilot. Un JSON con schema es coherente con el resto del kit |
| Un agente hace el bloque de corrido y se prorratea | Pierde la telemetría exacta y el control por task. Queda solo como corte de emergencia |
| Un agente por task con paquete chico | Arregla los tokens pero no el tiempo: sigue habiendo 24 arranques y 24 verificaciones |
| `verify.quick`/`full` en `constitution.md` | Archivo disputado, no editable durante el ciclo, y obliga a parsear markdown |
| Lease de `verify full` en `session-registry.mjs` | Es por repo; el recurso es la máquina. Y ese módulo lo carga Studio |
| Que el orquestador arme el paquete | Gasta tokens del tier más caro en cada despacho y no es reproducible |
| Partir `sdd-data-schemas` y `sdd-file-structure` en archivos chicos | Rompe los enlaces de repos existentes. Los selectores `template:` y `registry:` extraen la sección sin mover nada |
| Eximir todos los `.md` del gate | §11 |

---

## 13. Qué queda afuera de la 025

- Un scaffolder de ciclo (`sdd:new cycle`) que cree `cycle.json`, `brief.yaml` y `tasks.json`;
  bajaría más la carga del orquestador.
- Recortar `constitution.md` por sección dentro del paquete. Hoy entra entero y es la parte más
  grande del paquete del implementador (20 KB en `apps/cli`, 31 KB en `apps/studio`).
- Registro automático de lecturas fuera del paquete con un hook, en vez de `pack_misses`.
- Mostrar bloques y resultados de verify en Studio.
- Coordinación de `verify full` con procesos que no pasan por `sdd:verify`.
- El flow `lite` no usa paquetes ni bloques: es un solo actor en la sesión principal. Sí recibe el
  núcleo adelgazado, `sdd:verify`, `sdd:task` y la regla de §11. `plan.md` no necesita anclas.

---

## 14. Proyección y cómo se mide

Paquete de un implementador back para un bloque de 3 tasks, con los documentos de spec-011
(proyección por tamaño medio de sección, **no medido**):

| Parte | Bytes |
| ----- | ----: |
| Núcleo | 6.000 |
| `agent.md` | 3.500 |
| `cycle` | 1.000 |
| 3 tasks + sus secciones del planner | 6.500 |
| 4 decisiones del architect | 12.000 |
| Contexto del subproyecto | 20.600 |
| Verify y protocolo | 1.500 |
| **Total** | **~51.000 (~12,8k tokens)** |

| | Hoy (cota) | Con el diseño (proyección) |
| --- | ---: | ---: |
| Carga inicial por agente implementador | 56k tokens | 12,8k tokens |
| Agentes para 24 tasks | 24 | 7–9 |
| Carga inicial total, 24 tasks | ~1,35M tokens | ~100–115k tokens |
| `verify full` por ciclo | 24 + reviewer | 7–9, y el reviewer la reutiliza |

Medición honesta, en tres niveles:

1. **Estática, reproducible:** `sdd:pack --stats` por rol sobre el mismo ciclo, antes y después.
   Mide lo que se le da al agente, no lo que gasta.
2. **Real, por task:** `subagent_tokens` de `tasks.json`. Línea de base: las tres filas de §1.3.
   Se compara tokens por story point, no por task, porque los bloques cambian el reparto.
3. **Tiempo:** `duration_minutes` en `usage` y las duraciones que guarda `sdd:verify`.

Lo que no se puede atribuir limpio: la dificultad de las tasks cambia entre ciclos. Para aislarlo
propongo una prueba controlada en `examples/`: el mismo ciclo de 3 tasks corrido con el kit 0.22.0
y con el nuevo, con subagentes `sonnet`/`medium`. Cuesta tokens reales; la corro solo si la
aprobás.

---

## 15. Plan de implementación propuesto (para aprobar)

`spec-e-burgos-025`, flow `lite` (perfil `solo`), en dos ciclos:

- **cycle-01 — ejecución:** núcleo adelgazado y reglas bajo demanda, `project.md` y el paso de
  migración, regla Fable/Opus, `isCodePath`, `batches` y despacho continuado, `verify.json`,
  `sdd:verify` y el lease, `sdd:task`.
- **cycle-02 — paquetes:** `packs.json`, `sdd:pack`, `refs`, adelgazado de los `agent.md`,
  `pack_misses`, medición y documentación.

Antes del cycle-01: destilar las 5 entradas de `sdd/memory/journal/` en `lessons.md`, en commit
aparte. Subagentes de implementación en `sonnet`/`medium`; mediciones en `haiku`/`low`.

## 16. Decisiones que necesito de vos

1. ¿Bloques continuados con `SendMessage` como modo por defecto en Claude Code?
2. ¿`sdd/packs.json` y `sdd/verify.json` como archivos nuevos del kit?
3. ¿Sacar las instrucciones absorbidas a `project.md`, con migración explícita?
4. ¿La regla de §11 para el gate?
5. ¿Dos ciclos, o todo en uno?
6. ¿Corro la prueba controlada de §14?
