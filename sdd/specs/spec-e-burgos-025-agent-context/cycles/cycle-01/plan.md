# spec-e-burgos-025-agent-context — cycle-01 · plan (lite)

> Módulo: agent-context | Subproyecto: apps/cli | 2026-11-17 · Rama `feat/sdd-session-where`.
> Diseño completo y alternativas descartadas: `artifacts/design.md` (§ entre paréntesis).
> Rutas relativas a `apps/cli/templates/sdd/` salvo que empiecen con `apps/`.

## Diseño
- **Verify (§6)**: `verify.json` (+ `schemas/verify.schema.json`) con `quick`, `full` y
  `full_exclusive` por subproyecto. `scripts/sdd-verify.mjs` + `scripts/lib/verify.mjs` corren los
  comandos en orden, cortan en el primero que falla y escriben
  `sdd/specs/<spec>/cycles/cycle-XX/artifacts/verify/<unidad>-<nivel>.json` (comandos, exit code,
  duración, commit). `scripts/lib/verify-lease.mjs`: lease de máquina en el directorio temporal del
  sistema, con pid vivo, espera con tope y código de salida propio. No toca `session-registry.mjs`.
- **`sdd:task` (§7)**: `scripts/sdd-task.mjs` `start|done` escribe status, `files` y `usage` en el
  `tasks.json` del ciclo, regenera el índice y valida.
- **Schemas y validador (§5, §7, §9)**: `batches` en la raíz de `tasks.json`; `allocation` y
  `pack_misses` en `usage`; todo opcional. Avisos nuevos: bloque incoherente o sobre el tope,
  subproyecto sin entrada en `verify.json`, núcleo por encima de 6.000 B.
- **Núcleo (§2, §8, §10)**: `dual-harness/{CLAUDE,AGENTS,GEMINI}.md` ≤ 6.000 B con tabla de
  disparadores; reglas nuevas `rules/sdd-execution.md`, `sdd-context.md`, `sdd-tools.md`,
  `sdd-workspace.md` (< 8.000 c/u, `trigger: model_decision`); viñeta «máximo no es el default» en
  el bloque regla-cero, `copilot-instructions.md` y la tabla de tiers.
- **`project.md` (§2.2, §9)**: el absorbedor escribe las instrucciones previas del repo en
  `sdd/dual-harness/project.md`; los tres arneses lo referencian; `harness update sdd
  --split-project` migra un híbrido existente y nunca corre solo.
- **Gate (§11)**: `isCodePath` exime `.md`/`.mdx` cuyo primer segmento no es `apps|libs|tools`;
  `tools.json → claude_mod.exempt` (globs) para el resto.
- **Generadores**: cada app/lib nueva suma su entrada a `verify.json`; `sdd:verify` y `sdd:task`
  quedan registrados en el `package.json` raíz.
- **Agentes y skills (§5)**: el orquestador despacha un agente por bloque y lo continúa con
  `SendMessage`; el planner gana piso (< 1 h se fusiona) y arma `batches` (≤ 4 tasks, ≤ 12 SP);
  implementadores y reviewer usan `sdd:verify` (quick por task, full por bloque) y `sdd:task`.

## Bloques de ejecución
- B-01 (scripts): TASK-001 → TASK-002 → TASK-003.
- B-02 (arneses): TASK-004 → TASK-005.
- B-03 (mod): TASK-006.
- B-04 (cierre de superficie): TASK-007 → TASK-008.
- Orquestador: TASK-009.

## Tasks
- TASK-001 — `verify.json`, `sdd:verify` y lease de máquina (+ tests).
- TASK-002 — `sdd:task start|done` (+ tests).
- TASK-003 — Schemas opcionales (`batches`, `allocation`, `pack_misses`) y avisos del validador.
- TASK-004 — Núcleo adelgazado, reglas bajo demanda y regla «máximo no es el default».
- TASK-005 — `project.md`: absorbedor, referencias en los arneses y `update sdd --split-project`.
- TASK-006 — Gate: `.md` fuera de `apps|libs|tools` exento y `claude_mod.exempt`.
- TASK-007 — Generadores escriben `verify.json`; scripts registrados en el `package.json` raíz.
- TASK-008 — Agentes, skills y docs: bloques continuados, piso del planner, niveles de verify.
- TASK-009 — Verificación: build/typecheck/test, generación real, auditoría de bugs y cierre.
