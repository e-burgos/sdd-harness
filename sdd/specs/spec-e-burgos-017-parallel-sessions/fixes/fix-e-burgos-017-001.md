# FIX-e-burgos-017-001 — Type-check real del mod y reservas legibles en Studio

> Tipo: IMPROVEMENT · Severidad: low · Spec: spec-e-burgos-017-parallel-sessions · 2026-11-07

## Problema
- El `tsconfig.json` del mod incluía `hooks/.src` en `include`, pero tsc saltea las carpetas que
  empiezan con punto: `tsc -p` sobre el mod no chequeaba ninguna fuente (hallazgo del cycle-02).
- En la lista «en curso» de Studio, la etiqueta «lo pide …» de una reserva compartía la línea con
  la ruta y, a 800 px, la ruta quedaba en «apps/ap…» (verificación visual pendiente del cycle-02).

## Solución
- El tsconfig del mod lista sus fuentes en `files` y deja en `include` solo
  `.claude-plugin/types` (los tipos que escribe el motor). Un test exige que cada fuente
  TypeScript de `hooks/.src` esté en `files`.
- La etiqueta del pedido pasa a su propia línea bajo la ruta, y la ruta lleva `title` con el valor
  completo. Verificado en el navegador con Studio local (`--local-ui`) sobre `examples/par-017`
  con dos sesiones atadas, dos archivos reservados y un pedido.

## Archivos
- `apps/cli/templates/sdd/skills/sdd-mod/tsconfig.json` (+ espejo `sdd/skills/sdd-mod/tsconfig.json`)
- `apps/cli/src/generators/__tests__/sdd-mod.spec.ts`
- `apps/studio/src/components/OpenUnitsList.tsx`
