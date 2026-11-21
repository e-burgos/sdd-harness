# spec-e-burgos-032-studio-gate-parity — cycle-01 · plan (lite)

> Módulo: studio-gate-parity | Subproyectos: libs/studio-protocol, apps/studio-bridge, apps/studio | 2026-11-20 · Rama `feat/studio-claude-tools`.
> Objetivo: la regla de código y los gates de Studio coinciden con el kit. Fuera de alcance: cambiar el mod o `spec-gate.mjs`, reescribir la vista de gates del Mapa.

## Historias
- US-1 — Regla de código igual al mod. CA: tabla de paridad con los casos del mod (exentas, `.md`/`.mdx` en raíz y en `docs/`, código en apps/libs/tools, globs `exempt`).
- US-2 — Gate en vivo. CA: `kit.gate.check {spec, cycle?}` ⇒ resultado de `spec-gate --json`; panel en la spec con condiciones y estado.
- US-3 — Documentos por flow. CA: `expectedPlanDocuments` igual a `DOCS_BY_FLOW` del kit (full: brief/functional/planner/architect; reduced: brief; lite: plan).

## Tasks (detalle en tasks.json)
- TASK-001 — Protocolo: `kit.gate.check {spec, cycle?}` → `KitGateResult {gate: 'A'|'B', passed, checks: {id, label, ok, detail}[], next?: {cycle, flow, profile}, flow?, cycle?}`; feature `kit-gate`; specs.
- TASK-002 — Puente: `isCodePath(rel, exempt)` con la semántica del mod (EXEMPT_DIRS, globs `claude_mod.exempt` desde `snapshot.tools`, CODE_ROOTS apps/libs/tools, `.md`/`.mdx` fuera de code roots) y tabla de paridad; handler `kit.gate.check` (`spec-gate.mjs <spec> [cycle] --json`, exit 0/1 válidos, 2 ⇒ error); specs.
- TASK-003 — Studio: panel «SPEC GATE» en la spec (A sin ciclo en curso, B con ciclo) con «Comprobar», condiciones ✔/✘ y detalle; `expectedPlanDocuments` alineado al kit; i18n; specs.
- TASK-004 — Verificación real y cierre.

## Decisiones técnicas
- D-01 La regla del mod vive solo en TypeScript del hook (no hay `.mjs` reusable): se porta al puente con una tabla de paridad que documenta cada caso del mod.
- D-02 `exempt` llega del snapshot (`tools.claude_mod.exempt`), sin leer `tools.json` en cada juicio.
