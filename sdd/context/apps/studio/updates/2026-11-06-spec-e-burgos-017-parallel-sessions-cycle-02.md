# spec-e-burgos-017-parallel-sessions — cycle-02 — 2026-11-06

## Estado
La lista «en curso» (popover del header y Mission Control) muestra bajo cada unidad los archivos reservados, quién los pide (`lo pide <unidad>`) y aparte las reservas sin unidad; hasta 5 archivos por unidad y «+N».

## Estructura
- `components/OpenUnitsList.tsx` (`LeasedFiles` interno); `lib/open-units.ts` suma `leasesOfUnit` y `unboundLeases`; i18n `units.leases*`, `units.requestedBy`, `units.moreLeases`, `units.unboundLeases`.

## Dependencias
- Ninguna nueva.

## Qué sigue
- Nada pendiente de esta spec; sin verificación visual en el navegador de las reservas.
