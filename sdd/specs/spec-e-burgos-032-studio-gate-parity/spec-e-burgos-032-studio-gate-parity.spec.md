# SPEC-e-burgos-032: Studio aplica y muestra los gates del kit sin copias desactualizadas

> Estado: **in-progress** (2026-11-20). cycle-01 abierto (flow lite). Auditoría kit ↔ Studio, brecha 5: paridad de gates.

## Resumen ejecutivo
El juez del puente (`gate/judge.ts`) copia la regla de código del mod de Claude Code y ya se desvió de la
0.23: no aplica los globs `claude_mod.exempt` y trata como código cualquier `.md` fuera de las carpetas
exentas (el mod exime `.md`/`.mdx` fuera de `apps/libs/tools`). Studio tampoco corre `sdd:gate` (que ya tiene
`--json`): las reglas A/B están escritas a mano en la web y la lista de documentos por flow difiere de
`spec-gate.mjs` (falta `brief.yaml` en full y `reduced` se trata distinto).

## Historias de usuario
- US-1 — Misma regla. Una edición en Studio se juzga como en el mod: `.md`/`.mdx` fuera de apps/libs/tools y los globs `claude_mod.exempt` no son código.
- US-2 — Gate en vivo. Desde una spec corro el SPEC GATE (A, o B si hay ciclo en curso) y veo cada condición con ✔/✘ y su detalle, tal como lo responde el kit.
- US-3 — Documentos por flow correctos. Studio espera los mismos documentos por flow que el kit.

## Restricciones
- El puente ejecuta solo `sdd/scripts/spec-gate.mjs --json` con argumentos validados; sin shell.
- Contrato aditivo; sin bump de `PROTOCOL_VERSION`.

## Ciclos propuestos
- cycle-01 — Contrato, puente (regla de código + runner del gate) y UI.
