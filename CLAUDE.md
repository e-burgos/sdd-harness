# CLAUDE.md — @e-burgos/sdd-harness

> **Fuente única de reglas: [AGENTS.md](AGENTS.md).** Leerlo antes de tocar cualquier cosa —
> ahí están las reglas duras del kit portable, los blueprints y el workflow de verificación.

Notas específicas para Claude Code:

- Este repo **no usa el ciclo SDD** (no hay `sdd/` en la raíz): es la CLI que lo instala.
  No aplicar SPEC GATE ni buscar specs acá.
- Verificación fuerte antes de cerrar: `npm run build && npm run typecheck && npx vitest run`,
  y para cambios en generadores o en `apps/cli/templates/sdd/`, una generación real en `examples/`
  (está gitignoreado — usarlo como banco de pruebas).
- El costo de equivocarse es alto en `apps/cli/templates/sdd/`: todo lo que está ahí se publica en npm
  y se copia verbatim a los repos de los usuarios. Ante la duda, correr
  `node <workspace-generado>/sdd/scripts/validate-sdd.mjs` sobre un ejemplo generado.
- Antes de encarar cualquier tarea: aplicar las secciones **⚙️ Selección de modelo y
  esfuerzo** (obligatoria — decidir tier propio y de cada subagente/workflow antes de
  ejecutar) y **🔎 graphify** (si `graphify-out/graph.json` existe, consultarlo antes de
  grep/Read a ciegas) de AGENTS.md.
