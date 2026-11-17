# spec-e-burgos-024-session-where — cycle-01 · plan (lite)

> Módulo: session-where | Subproyecto: apps/cli | 2026-11-17 · Rama `feat/sdd-session-where`.

## Diseño
- **Worktrees** (`scripts/lib/session-registry.mjs`, copia en el mod): `listWorktrees(fs, root)` lee
  `<git-common-dir>/worktrees/*/gitdir` + el worktree principal, solo con `read`/`list` (el mod no
  tiene Node). El snapshot del mod junta ciclos, fixes y specs abiertas de todos y anota el
  `worktree` de cada uno; si la misma unidad aparece en varios, gana el de la raíz de la sesión.
- **Unidad `spec`** (`{ kind: 'spec', spec }`): spec registrada, no completed/cancelled, sin ciclo
  in-progress. Se puede atar pero no entra en `openUnits` (no cuenta para «una sola unidad» ni para
  «otras»), no autoriza código, y la atadura sube sola al ciclo cuando éste se abre en su worktree.
- **Marca** `SDD-BIND`: suma `worktree=<ruta>` (opcional, la escriben `sdd:use` y `sdd:gate`) y
  admite `spec=<id>` sin ciclo. `sdd:gate` A APPROVED imprime la marca de spec; B la de ciclo.
  `sdd:use <spec>` sin ciclo ata al ciclo abierto si hay uno, si no a la spec. Marca sin worktree ⇒
  raíz de la sesión (compatibilidad).
- **Atadura por archivo**: `Edit`/`Write` sobre `<wt>/sdd/specs/<spec>/…` ata a la spec o a su
  `cycles/cycle-XX` si está abierto; sobre código en un worktree con una sola unidad abierta, a ésa.
- **Rama**: además del id, el slug de la spec dentro del nombre de la rama (match único).
- **Gate de edición**: el archivo se juzga contra el worktree que lo contiene (no `allow` por quedar
  fuera de la raíz); las reservas usan la ruta relativa a ese worktree.
- **Franja y `/sdd`**: `esta sesión: <spec · ciclo · flow · n/m | spec (preparando) | FIX-id · tipo>`
  + `· en <worktree>` si no es la raíz; una atadura rechazada deja un toast con el motivo.
- **Regla prioritaria**: bloque ① en AGENTS/CLAUDE/GEMINI del kit junto a ⓪ (declarar
  `Unidad SDD → …` y atarse desde el worktree de la unidad), recordatorio en el hook SessionStart,
  FIX GATE y orquestador cierran con `sdd:use`; validador avisa si falta el bloque.

## Tasks
- TASK-001 — Registro: worktrees, unidad spec, marca con worktree, rama por slug (+ tests).
- TASK-002 — Mod: snapshot multi-worktree, atadura por archivo y comando, gate por worktree, franja.
- TASK-003 — Scripts `sdd:use` y `sdd:gate` (marca con worktree y spec) + tests de integración.
- TASK-004 — Regla ① en arneses, SessionStart, FIX GATE, orquestador, docs y validador.
- TASK-005 — Verificación: build/typecheck/test, generación real y caso de opticagestion; cierre.
