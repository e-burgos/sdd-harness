# spec-e-burgos-014-github-integration — cycle-01 · plan (lite)

> Módulo: github-integration | Subproyectos: apps/cli (CLI y kit) | Fecha: 2026-11-07
> Objetivo: conectar un proyecto a GitHub con el `gh` del dev, con el CI del kit en el primer push,
> protección de rama a pedido y rama + PR por ciclo según el perfil. Studio es el cycle-02.
> Rama `feat/github-onboarding`.

## Historias
- US-1 — Crear el repo. CA: `harness github connect` verifica `gh` instalado y autenticado (si no,
  explica cómo y sale con código 1), asegura repo git con commit, escribe
  `.github/workflows/sdd-validate.yml` si falta y lo commitea, muestra el plan (owner/nombre,
  visibilidad, rama) y solo con confirmación (prompt o `--yes`) corre
  `gh repo create <owner>/<nombre> --private|--public --source . --remote origin --push`. Si ya hay
  `origin`, informa y no crea nada. `harness github status [--json]` reporta gh, git, remoto y CI.
- US-2 — Protección a pedido. CA: `--protect` en `connect` o `harness github protect [--yes]` exige
  el check `sdd:validate` en la rama por defecto vía `gh api`; nunca se activa sola.
- US-3 — Rama y PR por ciclo. CA: `pnpm sdd:branch <spec> cycle-XX` crea o cambia a
  `feat/<spec-slug>-cycle-XX` si la política lo indica (team ⇒ on, solo ⇒ off, override
  `global.json → github.branch_per_cycle`); en off informa y no toca nada salvo `--force`.
  `pnpm sdd:pr <spec> cycle-XX` arma título y cuerpo desde `cycle.json` (objetivos, CA del
  reviewer, tests) y sin `--yes` solo muestra el plan; con `--yes` pushea la rama y corre
  `gh pr create`. Orquestador y reviewer los usan.

## Tasks
- TASK-001 — Librería y CI del kit: `sdd/scripts/lib/github.mjs` (pura: nombre de rama, política,
  título/cuerpo del PR, parseo de remoto), workflow `sdd/templates/github/workflows/sdd-validate.yml`,
  bloque `github` opcional en `global.schema.json` (`branch_per_cycle`: on|off, `default_branch`);
  tests.
- TASK-002 — `pnpm sdd:branch` y `pnpm sdd:pr` (scripts del kit, `--json`, exit 0/1/2), registrados
  donde están los demás `sdd:*`; tests de integración con un repo git temporal y un `gh` simulado en
  el PATH.
- TASK-003 — CLI `harness github connect | status | protect` con `utils/github.ts` (execFile sin
  shell, runner inyectable); `--json` en status y connect; tests.
- TASK-004 — Agentes y docs: orquestador (rama al abrir), reviewer (PR al cerrar, con confirmación
  del dev), `sdd-gates.md` § Ramas y PRs, steward, data-schemas, documentación es/en, CHANGELOG,
  `catalog.json`; espejo en el `sdd/` del repo.
- TASK-005 — Verificación y cierre: `pnpm build && pnpm typecheck && pnpm test`, generación real en
  `examples/` con `github status`, `connect` en modo plan y `sdd:branch`/`sdd:pr` en modo plan;
  `sdd:validate`.

## Decisiones técnicas
- `gh` y `git` se invocan con execFile/spawn sin shell. Nada guarda tokens.
- El workflow del kit solo necesita Node (el validador no tiene dependencias): job `sdd:validate`,
  nombre que usa la protección como check requerido.
- Flow lite por perfil `solo`, como en spec 017: los contratos nuevos (comandos, scripts y bloque
  opcional del schema) los consume esta misma spec (el puente en el cycle-02).
- Compatibilidad: bloque `github` opcional; sin `gh`, `sdd:branch` funciona (es git local) y
  `sdd:pr` explica qué falta.
