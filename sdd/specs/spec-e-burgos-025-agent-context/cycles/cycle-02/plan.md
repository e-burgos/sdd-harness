# spec-e-burgos-025-agent-context — cycle-02 · plan (lite)

> Módulo: agent-context | Subproyecto: apps/cli | 2026-11-17 · Rama `feat/sdd-session-where`.
> Contrato: `artifacts/interfaces.md`. Diseño: `../cycle-01/artifacts/design.md` §3, §4, §14.

## Diseño
- `sdd/packs.json` (+ `schemas/packs.schema.json`) declara por rol qué selectores recibe y la unidad
  (bloque o ciclo); es archivo del kit gobernado por hash.
- `scripts/sdd-pack.mjs` + `scripts/lib/pack.mjs`: arma un paquete determinista por unidad en
  `artifacts/packs/` (ignorado), resuelve secciones por id de encabezado, refs explícitas y
  derivadas, recorta `constitution.md` grande a índice + secciones obligatorias; `--stats` mide.
- Validador: valida `packs.json` y avisa por refs explícitas no resueltas.
- Agentes: el orquestador corre `sdd:pack` antes de despachar; los `agent.md` reemplazan su lista
  de documentos por el paquete, con fallback a las fuentes en una línea.

## Bloques de ejecución
- B-01 (implementor-back, un agente continuado): TASK-001 → TASK-002.
- Orquestador: TASK-003.

## Tasks
- TASK-001 — `packs.json`, schema, `sdd:pack` y `--stats`, validador (+ tests).
- TASK-002 — Orquestador y `agent.md` consumen el paquete; sección de protocolo; docs.
- TASK-003 — Verificación, auditoría de la extracción, medición antes/después y cierre.
