# spec-e-burgos-022-studio-kit-integrations — cycle-01 — 2026-11-13

## Estado
El módulo Kit (vista Herramientas) tiene la sección «Integraciones»: una tarjeta por integración (tucu-ui, video-maker) con descripción, requisitos, interruptor, estado y chips por arnés, versión, «actualización disponible», «Reparar» si está incompleta y la salida del último intento fallido. Oculta sin la feature `kit-integrations`. Verificado en el navegador con `--local-ui` (prender, apagar, reparar, 375 px).

## Estructura
- `components/modules/kit/KitIntegrations.tsx` (COMP-134) y `use-kit-integrations.ts`, montados en `KitToolsView.tsx`; i18n en `lib/i18n/modules/kit.ts`; `lib/format.ts` y `activity-model.ts` muestran `integration.changed`.

## Dependencias
- Ninguna nueva.

## Qué sigue
- Las tarjetas no se refrescan si la integración cambia desde la terminal con Studio abierto (se actualizan al montar y tras cada acción propia).
