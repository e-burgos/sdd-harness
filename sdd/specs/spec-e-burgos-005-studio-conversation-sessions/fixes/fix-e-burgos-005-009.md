# FIX-e-burgos-005-009 — Header: al tocar el chip de gate se abre un modal con el resumen del estado del enjambre

| Campo         | Valor |
| ------------- | ----- |
| **ID**        | FIX-e-burgos-005-009 |
| **Tipo**      | IMPROVEMENT |
| **Severidad** | low |
| **Fecha**     | 2026-10-26 |
| **Autor**     | e-burgos |
| **Estado**    | pending |
| **Spec**      | spec-e-burgos-005-studio-conversation-sessions |

## Problema

El chip del header no es interactivo; el dev no tiene un lugar donde ver gate, spec/ciclo/fix activos, tasks/fixes con estado, agentes participantes y ultimo evento de la conversacion seleccionada.

## Solucion propuesta

- GateStatusModal (dialogo accesible, mismo patron que DocumentViewerModal): conversacion (titulo, agente, estado, proveedor/sesion), gate derivado (FIX-e-burgos-005-008), spec/ciclo/fix activos, tasks del ciclo (CycleSummary.tasks) y fixes relacionados con status, agentes participantes con conteo de eventos, ultimo evento (dialogo mas reciente).
- El chip pasa a ser `button` que abre el modal; Escape cierra.
- Solo datos ya disponibles (ThreadState, snapshot, presence).

## Archivos esperados

- `apps/studio/src/components/GateStatusModal.tsx`
- `apps/studio/src/components/GateStatusModal.spec.tsx`
- `apps/studio/src/components/StudioHeader.tsx`
- `apps/studio/src/lib/i18n/es.ts`
- `apps/studio/src/lib/i18n/en.ts`

## Verificacion

- GateStatusModal.spec.tsx: render con view de hilo con fix + ciclo, cierre con Escape, estado idle.
