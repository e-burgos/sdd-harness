# apps/cli — spec-e-burgos-025 cycle-02 (agent-context, paquetes)

## Estado
Cada agente del ciclo recibe un paquete de contexto determinista en vez de leer los documentos
enteros: `sdd/packs.json` declara por rol los selectores (ciclo, tasks y plan de la unidad,
secciones de `architect.md`/`functional.md` que la unidad referencia, contexto del subproyecto,
registros, verify) y `pnpm sdd:pack` los resuelve. El orquestador lo genera antes de cada despacho
y cae al flujo anterior si el rol no tiene entrada (exit 3).

## Estructura
- `templates/sdd/packs.json` + `schemas/packs.schema.json` (archivo del kit, gobernado por hash).
- `templates/sdd/scripts/sdd-pack.mjs` + `lib/pack.mjs`: secciones por id de encabezado (palabra
  entera, sin acentos, fallback al encabezado padre `US-1-020` → `US-1`), refs derivadas del plan y
  de la task, rangos `D-01..D-03` y `US-2-001..003`, rutas confinadas a `sdd/` y `--app` a
  `apps|libs|tools/<nombre>`. Paquetes en `artifacts/packs/` con `.gitignore` propio; `--stats`
  compara bytes de paquete y fuentes.
- `sdd:task --pack-miss` acepta listas con coma; el validador avisa por refs explícitas sin resolver.
- `agents/sdd-<rol>.agent.md`: el paquete reemplaza la lista de documentos (una línea de fallback).

## Dependencias
Sin dependencias nuevas.

## Qué sigue
Encabezados setext y fences indentados dentro de listas no se reconocen (no bloqueante). Medir el
consumo real del primer ciclo despachado con paquetes. El bump a 0.23.0 es del release.
