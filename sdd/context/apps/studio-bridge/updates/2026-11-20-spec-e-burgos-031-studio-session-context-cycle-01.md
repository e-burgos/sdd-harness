# spec-e-burgos-031-studio-session-context · cycle-01 — 2026-11-20

## Estructura
- Prefijo por paquete: rol del agente (D-01) + unidad del hilo ⇒ `sdd-pack.mjs … --stdout` (precalculado en `warmContext`, caché por unidad e invalidación por mtime de tasks.json/packs.json); prefijo = lessons + línea de unidad + paquete; sin paquete ⇒ base (context_prompt + constitution + lessons). `contextSource` en la info del hilo.
- `KitIndexer` sección `harness` (núcleo con bytes de la copia de la raíz, project.md, reglas con frontmatter). `kit.pack.stats` = `--stats --json` (primera app del ciclo si es multi-app).

## Qué sigue
- Roles de ciclo en ciclos multi-app caen a base: falta elegir `--app`.
