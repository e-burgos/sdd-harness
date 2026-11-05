# spec-e-burgos-013 cycle-01 — 2026-11-05

## Qué pasó

- La cola de `wizard.validate` del puente fusionaba pedidos pendientes con configs distintas
  para ahorrar lanzamientos de la CLI. La generación usaba la misma cola, así que podía generar
  una config que nunca se había validado. Tuvo que salir `validateExact` en el fix de revisión.
- La CLI (`harness config validate`) y `libs/studio-protocol` tenían topes de largo y cantidad
  distintos, y el protocolo medía el tope del config en caracteres en vez de bytes. Configs que
  la web aceptaba, la CLI las rechazaba (y al revés), y el exit 2 no tenía salida JSON.
- Dos specs del wizard en `apps/studio` pasaban solos y fallaban con la suite completa: la
  espera async por defecto de Testing Library (1 s) no alcanzaba bajo carga. Hizo falta un
  commit aparte (10d3cfc) después de dar la verificación por cerrada.

## Lección

- Una cola o caché que fusiona pedidos es solo para vistas previas: lo que habilita una acción
  irreversible (generar, escribir, publicar) se valida sobre el payload exacto, sin fusionar.
- Cuando un subproyecto consume el contrato de otro, los límites los publica el productor (en el
  catálogo) y un spec de contrato corre el binario real: nunca duplicar topes a mano en el consumidor.
- Una task de UI async no está cerrada hasta que sus specs pasan con la suite completa del
  paquete, no solo filtrados: subir el timeout de `findBy`/`waitFor` en los specs con mucho render.

## Costo evitable

Un ciclo de fix de revisión back+front (~363K tokens sonnet) y un commit de tests extra. Las
dos primeras se detectaban en el architect al definir el contrato CLI↔protocolo y el uso de la
cola; la tercera, corriendo `pnpm --filter sdd-studio-web test` completo en cada task de front.
