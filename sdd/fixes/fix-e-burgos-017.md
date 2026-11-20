# FIX-e-burgos-017 — Dos tests inestables de Studio

## Problema
`apps/studio-bridge` `watcher.spec` («.claude catalog watching») falla a veces por timeout en la suite completa, y el spec de códigos de salida del panel de verify de `apps/studio` falló de forma intermitente (estabilizado con findByText sin causa conocida).

## Solución aplicada
- `watcher.spec`: el rescan periódico del catálogo (300 ms) corre en todas las plataformas y no solo en Windows; en macOS bajo carga chokidar puede no emitir el evento de un `rename` de directorio en `.claude/skills`, y el rescan es el respaldo. Se quitó `{ retry: 2 }`.
- Spec de exit codes del panel de verify (`kit-execution.spec.tsx`): no reproducible (27/27 verdes aislado, con carga y en suite). Cerrado sin cambios.
- Verificación: `watcher.spec` 10/10 aislado y la suite de `@e-burgos/sdd-studio` 2/2 verde (1192 tests).

### Archivos modificados
- `apps/studio-bridge/src/workspace/watcher.spec.ts`
