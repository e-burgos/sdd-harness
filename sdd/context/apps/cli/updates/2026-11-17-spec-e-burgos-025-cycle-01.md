# apps/cli — spec-e-burgos-025 cycle-01 (agent-context, ejecución)

## Estado
Los arneses del kit (`dual-harness/{CLAUDE,AGENTS,GEMINI}.md`) son un núcleo de ~5 KB (regla cero y
uno, reglas «Siempre», tabla de disparadores); el resto vive en reglas bajo demanda
(`rules/sdd-execution|context|tools|workspace.md`, `trigger: model_decision`). Las instrucciones
propias del repo van a `sdd/dual-harness/project.md` (dato del proyecto) y dejan de volver híbridos
los arneses desde el kit 0.23.0. Ciclos por bloques continuados, verificación en dos niveles con
lease de máquina, cierre de tasks por comando y gate que no trata como código a los `.md` fuera de
`apps|libs|tools`.

## Estructura
- `templates/sdd/scripts/sdd-verify.mjs` + `lib/verify.mjs` + `lib/verify-lease.mjs`:
  `sdd/verify.json` (quick/full/full_exclusive por subproyecto), resultados en
  `artifacts/verify/<kind>-<name>/<unidad>-<nivel>.json`, `--reuse`, `--init`, lease con latido en
  `~/.sdd-harness/locks/` (o `SDD_VERIFY_LOCK_DIR`), mata el árbol de procesos en SIGINT/TERM/HUP.
- `templates/sdd/scripts/sdd-task.mjs` + `lib/task-registry.mjs`: `start|done` con lock por archivo
  en el tmpdir, conserva indentación y EOL, `--commit` deriva `files`.
- Schemas: `verify.schema.json` nuevo; `cycle-tasks` suma `batches`, `refs`, `usage.allocation`,
  `usage.pack_misses`; `tools.schema` suma `claude_mod.exempt`. Todo opcional; el validador solo avisa.
- `src/generators/project-md.ts` (absorción por bloques, nunca por substring), `harness-history.ts`
  (hashes de cada versión publicada de los arneses), `kit-manifest.ts` (`HARNESS_CORE_SINCE`,
  `BASELINE_TRUSTED_SINCE`), `update.generator.ts` (`--split-project`, reemplazo in place que
  conserva hardlinks, limpieza de `.new` idénticos), `seedVerifyEntries` en init/configure/add.
- Mod: `isCodePath(rel, exempt)` y matcher de globs por segmento sin backtracking.

## Dependencias
Sin dependencias nuevas.

## Qué sigue
cycle-02: `sdd/packs.json` y `pnpm sdd:pack` (paquete determinista por unidad) y adelgazado final
de los `agent.md`. El bump a 0.23.0 es del release; hasta entonces `update sdd` imprime el aviso de
migración en cada corrida.
