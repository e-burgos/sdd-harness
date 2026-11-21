# SPEC-e-burgos-031: Las sesiones de Studio usan el contexto del kit — paquete por unidad, núcleo y reglas

> Estado: **completed** (2026-11-20). cycle-01 cerrado (flow lite, 4/4 tasks). Auditoría kit ↔ Studio, brechas 3 y 4:
> paquetes de contexto (`sdd:pack`) y núcleo de 5 KB con reglas bajo demanda y `project.md`.

## Resumen ejecutivo
El kit 0.23 arma el contexto mínimo de cada rol y unidad con `sdd:pack` y reduce los arneses a un núcleo de
~5 KB con reglas que se leen bajo demanda (`sdd/dual-harness/rules/*.md`, `trigger:`) y las instrucciones del
proyecto en `project.md`. Studio, en cambio, inyecta en cada turno `context_prompt.md` + `constitution.md` +
`lessons.md` (~37 KB) sin importar la unidad ni el rol, no usa paquetes y no muestra el núcleo, las reglas ni
si el repo está migrado (`harness update sdd --split-project`).

## Historias de usuario
- US-1 — Paquete en la sesión. Una conversación atada a un ciclo con un agente que tiene rol en `packs.json` recibe el paquete de su unidad en vez del contexto completo; si no hay paquete, el contexto de hoy.
- US-2 — Ver qué contexto cargó. La conversación muestra qué contexto se inyectó (paquete de qué unidad/rol, o base).
- US-3 — Arnés en Kit. El módulo Kit muestra el núcleo (tamaños), `project.md` y las reglas con su disparador, y avisa si conviene `--split-project`.
- US-4 — Paquetes por ciclo. El ciclo muestra el tamaño de los paquetes frente a las fuentes y los pack-miss.

## Restricciones
- El puente corre solo `sdd/scripts/sdd-pack.mjs` con argumentos validados; sin shell; timeout corto; caché.
- Contrato aditivo; sin bump de `PROTOCOL_VERSION`.

## Ciclos propuestos
- cycle-01 — Contrato, puente (prefijo por paquete, índice del arnés, stats) y UI.
