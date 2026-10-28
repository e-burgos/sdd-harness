# spec-e-burgos-010-studio-dual-sidebar · cycle-01

## Qué pasó
La task de limpieza borró componentes del sidebar viejo pero dejó `sdd/components.json` apuntando a archivos inexistentes; el módulo Arquitectura de Studio lee ese registro y los mostraba como implementados. Lo detectó el reviewer.

## Lección
Toda task que borra o mueve componentes deprecia o reapunta su entrada en `sdd/components.json` en el mismo cambio.

## Costo evitable
Una pasada extra de fix (~60k tokens sonnet) y una ronda de review.
