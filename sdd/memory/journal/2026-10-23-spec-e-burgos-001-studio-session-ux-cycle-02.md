# spec-e-burgos-001-studio-session-ux cycle-02 — 2026-10-23

## Qué pasó

Una skill creada en `.claude/skills` con el Studio abierto no aparecía en el menú `/`, ni siquiera al
recargar la web: chokidar sobre FSEvents (macOS) perdió el evento bajo carga y `workspace.snapshot`
devolvía el snapshot en memoria del watcher. El test del watcher de `.claude` también fallaba de forma
intermitente por la misma latencia. Se resolvió con un re-escaneo a pedido en `workspace.snapshot`
(FIX-e-burgos-001-001), escritura atómica en los tests y `retry: 2`.

## Lección

Los eventos fs no son una fuente confiable (FSEvents pierde entregas bajo carga): toda vista derivada del fs debe poder re-escanearse a pedido, y sus tests no pueden depender de la latencia de un evento.

## Costo evitable

Una investigación de "bug de UI" durante la verificación visual y re-ejecuciones de la suite del puente por
un test intermitente.
