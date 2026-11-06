# spec-e-burgos-017-parallel-sessions — cycle-01 — 2026-11-06

## Estado
El kit sabe qué sesión trabaja en qué unidad. Cada sesión (Claude Code, Studio, otro arnés) queda atada a un ciclo o fix en `sdd/.sessions/`; GATE B ata la sesión sola (línea marcadora `SDD-BIND`), `pnpm sdd:use` la ata a mano y el mod de Claude Code muestra todas las unidades abiertas y aplica el gate por sesión: con varias unidades abiertas, una sesión sin atar recibe «hay N unidades abiertas … pnpm sdd:use …». Con el mod apagado nada cambia.

## Estructura
- `templates/sdd/scripts/lib/session-registry.mjs` (registro), `scripts/sdd-use.mjs`, `schemas/session-binding.schema.json`; `spec-gate.mjs` emite `SDD-BIND`.
- `skills/sdd-mod/hooks/.src/` (`sdd.ts`, `register.tsx`, copia de `session-registry.mjs` + `.d.mts` protegida por test de identidad de bytes).
- Agentes orquestador e implementadores, `sdd-gates.md`, `dual-harness/CLAUDE.md`, skills `sdd-orchestrator`, `sdd-steward`, `sdd-data-schemas`, `sdd-file-structure` y README es/en actualizados; `catalog.json` regenerado.

## Dependencias
- Ninguna nueva.

## Qué sigue
- cycle-02: reservas de archivo con aviso entre sesiones.
- El CLI de Claude Code de terminal 2.1.123 no carga mods (formato «modules» de hooks.json); el motor de escritorio 2.1.317 sí. `claude -p` solo carga el mod con `--plugin-dir`.
