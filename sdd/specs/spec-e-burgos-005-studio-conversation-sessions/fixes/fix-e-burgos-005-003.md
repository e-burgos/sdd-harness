# FIX-e-burgos-005-003 — Studio Mission Control: Header del DocumentViewerModal

| Campo         | Valor                                          |
| ------------- | ---------------------------------------------- |
| **ID**        | FIX-e-burgos-005-003                               |
| **Tipo**      | IMPROVEMENT                                       |
| **Severidad** | low                                       |
| **Fecha**     | 2026-10-26                                     |
| **Autor**     | e-burgos                                       |
| **Estado**    | implemented                                        |
| **Spec**      | spec-e-burgos-005-studio-conversation-sessions         |

## Problema

1. Titulo, ruta truncada, 'Copiar ruta', toggle Renderizado/Crudo, Copiar y cerrar quedan apretados; 'Copiar ruta' se superpone y parte en dos lineas.

## Solucion propuesta

Header en dos zonas: izquierda columna (fila titulo+badges; fila ruta truncada con title completo); derecha grupo de acciones alineado (toggle Renderizado/Crudo, Copiar, Copiar ruta como icono-boton sin wrap, whitespace-nowrap/shrink-0) y cerrar separado por divisor. Header wrap-safe en anchos chicos.

## Archivos esperados

- `apps/studio/src/components/mission-control/DocumentViewerModal.tsx`
- `apps/studio/src/components/mission-control/documentviewermodal.spec.tsx`
