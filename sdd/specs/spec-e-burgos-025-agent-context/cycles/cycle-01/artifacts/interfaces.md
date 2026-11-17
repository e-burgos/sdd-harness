# spec-e-burgos-025 cycle-01 — contrato de interfaces

> Fuente única para los bloques del ciclo. Rutas relativas a `apps/cli/templates/sdd/` salvo que
> empiecen con `apps/`. En un repo de usuario el kit vive en `sdd/` (misma estructura).
> Convenciones del kit que aplican a todo: scripts `.mjs` sin dependencias nuevas (solo `node:*`,
> y `ajv` donde ya se usa), salida de consola en inglés y compacta, código sin comentarios,
> lógica pura en `scripts/lib/*.mjs` (testeable) y CLI fina en `scripts/sdd-*.mjs`.

## 1. `sdd/verify.json`

```json
{
  "$schema": "./schemas/verify.schema.json",
  "apps/billing-api": {
    "quick": ["pnpm nx run-many -t lint test -p billing-api"],
    "full": ["pnpm nx run-many -t lint test build"],
    "full_exclusive": true
  }
}
```

- Claves: `$schema`, `_description` (string) y el id lógico del subproyecto
  (`^(apps|libs|tools)/[a-z][a-z0-9-]*$`, el mismo de `global.json`/`cycle.json → apps`).
- Entrada: `quick` y `full` son arrays de strings (comandos de shell, se corren desde la raíz del
  repo); `full_exclusive` boolean opcional (default `false`). `additionalProperties: false` en la
  entrada. Ninguna clave es obligatoria dentro de la entrada: `quick` o `full` ausentes = nivel sin
  comandos.
- `{files}` dentro de un comando se reemplaza por los archivos de `--files`, cada uno entre
  comillas simples de shell, separados por espacio. Comando con `{files}` y sin `--files` ⇒ se
  saltea (`skipped: true`), no falla.
- El kit shippea `verify.json` solo con `$schema` y `_description`. Es dato del proyecto: `harness
  update sdd` nunca lo pisa.

## 2. `pnpm sdd:verify`

```bash
pnpm sdd:verify <app> quick [--files a,b] [--unit TASK-NNN]
pnpm sdd:verify <app> full  [--unit B-NN] [--reuse] [--wait <segundos>]
pnpm sdd:verify --init                      # siembra entradas para los subproyectos que no tienen
# comunes: [--spec <spec-id|slug> --cycle cycle-XX] [--verbose] [--json]
```

- `<app>`: id lógico (`apps/billing-api`) o nombre a secas (`billing-api`) si es único.
- Corre los comandos del nivel en orden y corta en el primero que falla.
- **Salida compacta por defecto** (la lee un agente): una línea por comando (`✔`/`✘`/`–` skipped,
  duración) y, si uno falla, las últimas 40 líneas de su salida más la ruta del log completo.
  `--verbose` transmite la salida entera. `--json` imprime solo el objeto resultado.
- **Persistencia**: si se resuelve un ciclo (por `--spec`/`--cycle`, o porque hay exactamente un
  ciclo `in-progress` cuyo `apps` incluye `<app>`), escribe
  `sdd/specs/<spec>/cycles/cycle-XX/artifacts/verify/<unidad>-<nivel>.json`, con `<unidad>` =
  `--unit` o `cycle`. Sin ciclo resoluble corre igual y avisa que no persistió. Los logs completos
  van a `artifacts/verify/logs/`, directorio que el script crea con un `.gitignore` propio (`*`).
- Resultado:
  ```json
  { "app": "apps/billing-api", "level": "full", "unit": "B-01", "ok": true,
    "commit": "<sha de HEAD>", "dirty": ["ruta/no/commiteada.ts"],
    "started_at": "<ISO>", "duration_ms": 0,
    "commands": [{ "command": "…", "exit_code": 0, "duration_ms": 0, "skipped": false }] }
  ```
  `dirty` lista los archivos con cambios sin commitear al arrancar, **excluyendo todo `sdd/`**.
- **`--reuse`** (solo `full`): si existe un resultado `full` del mismo `<app>` en ese ciclo con
  `ok: true`, `dirty` vacío, y tanto `git diff --name-only <commit> HEAD` como el working tree
  actual solo tocan rutas bajo `sdd/`, imprime `reused <ruta>` y sale 0 sin correr nada. Si no,
  corre normalmente.
- **Lease** (`scripts/lib/verify-lease.mjs`): solo para `full` con `full_exclusive: true`.
  Archivo `verify-full.lock` en `SDD_VERIFY_LOCK_DIR`, o `~/.sdd-harness/locks/`, o (si el home no
  es escribible) `os.tmpdir()/sdd-harness/`. Se crea con `wx` (atómico) y guarda
  `{ pid, repo, app, started_at }`. Dueño con pid muerto ⇒ lease muerto, se toma. Ocupado ⇒
  reintenta cada 2 s hasta `--wait` (default 600 s) informando una vez quién lo tiene; vencido el
  tope sale con código **75**. Se libera en `exit`, `SIGINT` y `SIGTERM`. Si no se puede escribir
  en ninguna ubicación, corre sin lease y avisa: la infraestructura del lease nunca bloquea una
  verificación.
- `--init`: para cada subproyecto de `global.json → monorepo.apps|libs` sin entrada, infiere y
  escribe una. Con `nx.json`: `quick` = `pnpm nx run-many -t <lint,test presentes> -p <name>`,
  `full` = `pnpm nx run-many -t <lint,test,build presentes> -p <name>`, `full_exclusive: true`
  (targets presentes = los de `project.json` si existe; si no, `lint test build`). Sin `nx.json` y
  con `package.json` del subproyecto: `pnpm --filter <pkg.name> run <script>` para los scripts que
  existan entre `lint`, `typecheck`, `test` (quick) y esos más `build` (full). Standalone (código
  en la raíz): `pnpm run <script>`. Nunca pisa una entrada existente; imprime qué agregó.
- Códigos de salida: `0` ok o reused · `1` un comando falló · `2` uso inválido · `3` el
  subproyecto no tiene entrada (o el nivel está vacío): lo dice y sugiere `--init` · `75` lease no
  obtenido.

## 3. `pnpm sdd:task`

```bash
pnpm sdd:task <spec-id|slug> cycle-XX TASK-NNN start
pnpm sdd:task <spec-id|slug> cycle-XX TASK-NNN done \
  (--files a,b | --commit <sha>[,<sha>]) \
  --tokens <total> | (--tokens-in N --tokens-out M) \
  --model <provider/model> --effort <low|medium|high|xhigh|max> --agent <rol> \
  [--source <usageSource>] [--approx] [--duration <minutos>] \
  [--batch B-NN --batch-tokens N] [--pack-miss <ruta> …]
```

- Resuelve la spec igual que `spec-gate.mjs` (id o slug).
- `start` ⇒ `status: "in-progress"`. `done` ⇒ `status: "done"`, `files` y `usage`.
- `--commit` ⇒ `files` = unión de `git show --name-only` de esos commits, sin rutas bajo `sdd/`.
  `--files` y `--commit` se pueden combinar (unión, sin duplicados, orden estable).
- `--tokens <total>` aplica el reparto documentado en el schema (85 % in / 15 % out) y guarda
  `tokens_total`. `--source` default: `agent-usage-notification` si no hay `--approx`,
  `declared-estimate` si lo hay. `recorded_at` = hoy. Nunca escribe una combinación que el
  validador rechaza (`approx: false` + `declared-estimate` ⇒ error de uso, código 2).
- `--batch`/`--batch-tokens` ⇒ `usage.allocation`; exige `--approx`. `--pack-miss` (hasta 5) ⇒
  `usage.pack_misses`.
- `done` sobre una task ya `done` reemplaza `files`/`usage` solo con `--force`; sin él, código 2.
- Después de escribir: regenera el índice (`rebuild-tasks-index.mjs`) y corre `validate-sdd.mjs`.
  Salida: una línea (`TASK-003 done · 4 files · 41,200 tokens · validate OK`). Código `1` si el
  validador quedó en rojo (imprime sus errores), `2` uso inválido o task/ciclo inexistente.
- Escribe el JSON con `JSON.stringify(x, null, 2) + "\n"`.

## 4. Schemas (todo opcional)

`schemas/cycle-tasks.schema.json`:
- Raíz: `batches`: array de `{ id: "^B-\\d{2}$", app, role (string), tasks: [ids, minItems 1],
  depends_on: [ids de bloque] }` (`required: id, app, role, tasks`).
- `TaskEntry.refs`: array de strings `^[a-z][a-z0-9-]*#.+$` (`architect#D-04`).
- `usage.allocation`: `{ batch: "^B-\\d{2}$", batch_tokens: integer ≥ 0 }`.
- `usage.pack_misses`: array de strings, `maxItems: 5`.

`schemas/tools.schema.json`: `claude_mod.exempt`: array de strings (globs).

## 5. Avisos nuevos del validador (nunca errores)

- `batches`: id de task inexistente, task en dos bloques, `app` fuera de `apps` del ciclo,
  `depends_on` a bloque inexistente, bloque sobre el tope (4 tasks o 12 SP; el tope se lee de
  `sdd/packs.json → execution` si existe).
- `usage.allocation` presente con `approx` distinto de `true`.
- `verify.json` (si existe se valida contra su schema — eso sí es error, como todo registro): un
  solo aviso que lista los subproyectos de `global.json` sin entrada y sugiere
  `pnpm sdd:verify --init`. Si el archivo no existe, un solo aviso con la misma sugerencia.
- Núcleo: para `dual-harness/{CLAUDE,AGENTS,GEMINI}.md`, si la parte anterior al encabezado
  «Instrucciones previas del proyecto (absorbidas al instalar SDD)» supera 6.000 bytes, avisa y
  sugiere `harness update sdd --split-project`.

## 6. Núcleo y `project.md`

- `dual-harness/{CLAUDE,AGENTS,GEMINI}.md` ≤ 6.000 bytes cada uno. Empiezan con el bloque
  `<!-- regla-cero:start -->…<!-- regla-cero:end -->` (lo extrae `scripts/rule-zero-hook.mjs` y lo
  exige el validador junto con el texto `REGLA UNO`).
- Instrucciones propias del repo: `sdd/dual-harness/project.md`. Es dato del proyecto: no lo
  shippea el kit, no entra al manifiesto, `update sdd` no lo toca.
- **Verificado con Claude Code 2.1.325**: un `@import` dentro de un `CLAUDE.md` symlinkeado se
  resuelve desde la ruta **real** del archivo, no desde el symlink; un import que no existe se
  ignora en silencio. Por eso `CLAUDE.md` termina con dos líneas, cada una en su propia línea:
  `@project.md` (caso symlink, el normal) y `@sdd/dual-harness/project.md` (caso copia en la raíz,
  Windows sin symlinks).
- `AGENTS.md`, `GEMINI.md` y `copilot-instructions.md` llevan un puntero en prosa: «Si existe
  `sdd/dual-harness/project.md`, leelo antes de trabajar: son las instrucciones propias de este repo».
- Reglas bajo demanda nuevas en `dual-harness/rules/` (< 8.000 caracteres cada una, frontmatter
  `trigger: model_decision` + `description:`): `sdd-execution.md` (abrir/ejecutar un ciclo:
  bloques, `sdd:task`, `sdd:verify`, registros tipados), `sdd-context.md` (cierre: fragmentos
  aditivos, CONTEXTO GATE, MEMORIA GATE), `sdd-tools.md` (graphify, rtk, sdd-mod, tucu-ui,
  video-maker), `sdd-workspace.md` (chequeo de workspace, invariantes pnpm/Nx, guías de Nx).
  `sdd-gates.md` **no se toca** (está a 33 caracteres del tope de 12.000).
- Regla nueva en el bloque regla-cero (los tres arneses) y en una frase de
  `copilot-instructions.md`:
  > **Máximo no es el default del trabajo difícil.** Antes de elegir el tier máximo, decidí
  > explícitamente «máximo o alto» y escribí por qué el tier alto no alcanza. Vale para diseño
  > crítico sin precedente en el repo, trade-offs entre muchos subsistemas o un verify/judge
  > adversarial. Ningún subagente va en máximo sin esa justificación.

## 7. `harness update sdd` y los arneses

- Hoy `dual-harness/{AGENTS,CLAUDE,GEMINI}.md` son híbridos: si difieren del kit nuevo siempre
  reciben `.new`. Regla nueva: son híbridos **solo si el manifiesto instalado es de un kit
  < 0.23.0** (o no hay manifiesto). Desde 0.23.0 los gobierna el hash como a cualquier archivo del
  kit, porque las instrucciones del repo ya viven en `project.md`.
- `harness update sdd --split-project` (nunca corre solo): para cada uno de los tres archivos
  instalados, (a) si contiene el encabezado absorbido, mueve lo absorbido a
  `sdd/dual-harness/project.md` (sin duplicar texto idéntico entre los tres) y deja el resto; (b) si
  el resto es idéntico al archivo que el kit había instalado (hash del manifiesto viejo) o al kit
  nuevo, lo reemplaza por el del kit nuevo; (c) si no, lo conserva y deja `.new`. Informa qué hizo
  con cada archivo.
- El absorbedor (`harness configure sdd` / init) escribe lo absorbido en `project.md` y deja los
  tres archivos del kit intactos.

## 8. Gate de edición (`skills/sdd-mod/hooks/.src/sdd.ts`)

`isCodePath(rel, exempt)`:
- Primer segmento en los directorios exentos de hoy ⇒ no es código (sin cambios).
- Primer segmento `apps`, `libs` o `tools` ⇒ es código, salvo que la ruta matchee un glob de
  `tools.json → claude_mod.exempt`.
- Cualquier otra ruta: `.md` y `.mdx` ⇒ no es código; el resto ⇒ código, salvo glob de `exempt`.
- Globs: `**` (cualquier profundidad), `*` (dentro de un segmento), `?`; matcher propio, sin
  dependencias (el mod no tiene Node).

## 9. Protocolo de bloque (texto para agentes, skills y `sdd-execution.md`)

1. Orquestador: lanza **un** agente por bloque con la primera task.
2. Agente, por task: implementa → `pnpm sdd:verify <app> quick --files … --unit TASK-NNN` →
   commit → responde una línea: task, sha, resultado del verify.
3. Orquestador: toma `subagent_tokens` de la notificación, resta el acumulado anterior y corre
   `pnpm sdd:task <spec> cycle-XX TASK-NNN done --commit <sha> --tokens <diferencia> --model …
   --effort … --agent …`. Continúa al **mismo** agente con la task siguiente.
4. Última task del bloque: el agente corre además `pnpm sdd:verify <app> full --unit B-NN`.
5. Corte: si una task falla dos veces o el agente avisa que su contexto se compactó, el
   orquestador despacha el resto del bloque en un agente nuevo.
6. Arneses sin continuación de subagentes: una sesión hace el bloque en secuencia y cierra cada
   task con `sdd:task done … --approx`.
7. Reviewer: `pnpm sdd:verify <app> full --reuse` en vez de repetir la verificación completa.
