---
trigger: model_decision
description: Abrir o ejecutar un ciclo SDD - protocolo de bloques, pnpm sdd:task, pnpm sdd:verify (quick y full), registros tipados y la trampa de NX_WORKSPACE_ROOT_PATH. Leelo antes de despachar o implementar tasks.
---

# Ejecución de un ciclo

Flows (`full` · `reduced` · `lite`), GATE A y GATE B: `sdd-gates.md` (fuente canónica; acá no se repite).
Esta regla cubre cómo se ejecutan las tasks una vez que el gate dio `APPROVED`.

## Registros tipados (INVIOLABLE)

Todo `*.json` de `sdd/` tiene JSON Schema estricto en `sdd/schemas/` y declara `$schema`.
**Antes de escribir un registro, leer su schema** (`sdd/skills/sdd-data-schemas/SKILL.md` tiene el
campo a campo). **Después de escribir:** `pnpm sdd:validate` (todos los registros + reglas cruzadas)
y `pnpm sdd:rebuild-tasks-index` (regenera el índice `sdd/tasks.json`; las tasks canónicas viven en
el `tasks.json` de cada ciclo — nunca editar el índice a mano). Un commit con `pnpm sdd:validate`
en rojo es inválido: el mismo check corre en CI y es paso obligatorio del sdd-reviewer.

> [!NOTE]
> Si `NX_WORKSPACE_ROOT_PATH` está definida y no apunta al cwd, cualquier `nx …`
> (`pnpm sdd:validate`, `nx run-many -t lint test build`, etc.) corre contra OTRO repo sin ningún
> error visible: desactivá la variable o verificá `echo $NX_WORKSPACE_ROOT_PATH` antes de correr
> `nx` o los scripts `sdd:*`.

## Protocolo de bloque

Los `batches` de `tasks.json` agrupan tasks de un mismo subproyecto y rol (tope: 4 tasks o 12 SP).
Un bloque lo ejecuta **un** agente, task por task, sin recargar contexto entre una y otra.

1. **Orquestador:** lanza un agente por bloque con la primera task.
2. **Agente, por task:** implementa → `pnpm sdd:verify <app> quick --files … --unit TASK-NNN` →
   commit → responde **una línea**: task, sha, resultado del verify.
3. **Orquestador:** toma `subagent_tokens` de la notificación, resta el acumulado anterior y corre
   `pnpm sdd:task <spec> cycle-XX TASK-NNN done --commit <sha> --tokens <diferencia> --model …
   --effort … --agent …`. Continúa al **mismo** agente con la task siguiente (`SendMessage`).
4. **Última task del bloque:** el agente corre además `pnpm sdd:verify <app> full --unit B-NN`.
5. **Corte:** si una task falla dos veces o el agente avisa que su contexto se compactó, el
   orquestador despacha el resto del bloque en un agente nuevo.
6. **Arneses sin continuación de subagentes** (Copilot, Gemini): una sesión hace el bloque en
   secuencia y cierra cada task con `sdd:task done … --approx`.
7. **Reviewer:** `pnpm sdd:verify <app> full --reuse` en vez de repetir la verificación completa.

## `pnpm sdd:task` — estado y telemetría de una task

```bash
pnpm sdd:task <spec-id|slug> cycle-XX TASK-NNN start
pnpm sdd:task <spec-id|slug> cycle-XX TASK-NNN done \
  (--files a,b | --commit <sha>[,<sha>]) \
  --tokens <total> | (--tokens-in N --tokens-out M) \
  --model <provider/model> --effort <low|medium|high|xhigh|max> --agent <rol> \
  [--source <usageSource>] [--approx] [--duration <minutos>] [--batch B-NN --batch-tokens N]
```

- `start` ⇒ `in-progress`; `done` ⇒ `done` con `files` y `usage`. `--commit` deriva `files` de los
  commits (sin rutas bajo `sdd/`); se puede combinar con `--files`.
- `--tokens <total>` reparte 85 % in / 15 % out. Sin `--approx` la fuente es
  `agent-usage-notification`; con `--approx`, `declared-estimate`. `--batch-tokens` exige `--approx`.
- Regenera el índice y corre `sdd:validate`; sale 1 si el validador queda en rojo. Reemplazar una
  task ya `done` exige `--force`.
- Contrato de telemetría (fuentes por arnés, reglas del validador): `sdd-model-budget.md`.

## `pnpm sdd:verify` — dos niveles

```bash
pnpm sdd:verify <app> quick [--files a,b] [--unit TASK-NNN]
pnpm sdd:verify <app> full  [--unit B-NN] [--reuse] [--wait <segundos>]
pnpm sdd:verify --init
```

- Los comandos de cada subproyecto viven en `sdd/verify.json` (dato del proyecto, `harness update`
  no lo pisa). `--init` siembra entradas para los subproyectos que no tienen.
- **`quick`** (por task): lint/tests acotados a lo que tocaste (`{files}` se reemplaza por `--files`).
  **`full`** (fin de bloque o ciclo): lint, tests y build completos del subproyecto.
- La salida es compacta: una línea por comando y, si falla, las últimas 40 líneas más la ruta del
  log completo. `--verbose` transmite todo; `--json` imprime solo el resultado.
- Con un ciclo resoluble persiste `artifacts/verify/<kind>-<name>/<unidad>-<nivel>.json` (incluye
  `commit` y `dirty`). `--reuse` salta el `full` si hay un resultado `ok` del mismo subproyecto,
  con los mismos comandos, sin cambios fuera de `sdd/` desde ese commit.
- Un `full` marcado `full_exclusive` toma un lease global: si está ocupado espera hasta `--wait`
  (default 600 s) y sale con código 75; no lo evites corriendo el build a mano.
- Códigos: `0` ok o reused · `1` falló un comando · `2` uso inválido · `3` el subproyecto no tiene
  entrada (corré `--init`) · `75` lease no obtenido.
