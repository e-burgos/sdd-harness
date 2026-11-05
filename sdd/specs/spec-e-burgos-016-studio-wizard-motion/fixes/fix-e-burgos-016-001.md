# FIX-e-burgos-016-001 — Hallazgos de la prueba del wizard contra la CLI 0.17.0 publicada

| Campo         | Valor |
| ------------- | ----- |
| **ID**        | FIX-e-burgos-016-001 |
| **Tipo**      | IMPROVEMENT |
| **Severidad** | low |
| **Fecha**     | 2026-11-05 |
| **Autor**     | e-burgos |
| **Estado**    | implemented |
| **Spec**      | spec-e-burgos-016-studio-wizard-motion |

## Problema

La prueba de punta a punta (puente empaquetado como en un release, CLI `@e-burgos/sdd-harness@0.17.0` bajada de npm, generación real en `examples/wiz-017` con el gate en verde y apertura en Studio) dejó tres detalles:

1. Las puertas del paso Alcance se anunciaban con todo su texto junto (eyebrow, título, descripción y mockup) como nombre accesible.
2. El header mostraba `v0.16` fijo en el código, aunque el proyecto abierto tenía el kit 0.17.0.
3. Sin módulo inicial en Extras, el borrador para Hermes era una pregunta genérica e ignoraba la descripción que el wizard ya pidió.

Un cuarto hallazgo (la etiqueta del nombre del proyecto) resultó un falso positivo de la herramienta del navegador: los specs encuentran esos campos por su etiqueta.

## Solución

- `ScopeDoors.tsx`: cada radio lleva `aria-label` con su título y `aria-describedby` con la descripción.
- `StudioHeader.tsx`: el badge muestra `snapshot.kitVersion` del proyecto abierto y no aparece sin proyecto (launcher).
- `hermes-idea.ts`: sin módulo pero con descripción, el borrador nombra el proyecto, su descripción y las apps; el texto genérico queda para cuando no hay ninguno.

- Specs con dos aperturas del mismo `Select` de tucu-ui: esperan su cierre de 100 ms entre una y otra (`waitForSelectToClose`); bajo la carga de la suite completa el segundo click caía en esa ventana y el select no abría.

## Archivos

- `apps/studio/src/components/modules/new-project/steps/scope/ScopeDoors.tsx`
- `apps/studio/src/components/StudioHeader.tsx`
- `apps/studio/src/lib/i18n/modules/shell.ts`
- `apps/studio/src/lib/wizard/hermes-idea.ts`
- `apps/studio/src/lib/wizard/__tests__/hermes-idea.spec.ts`
- `apps/studio/src/components/studioheader.spec.tsx`
- `apps/studio/src/components/modules/new-project/__tests__/wizard-motion.spec.tsx`
- `apps/studio/e2e/new-project.e2e.ts`
- `apps/studio/src/components/helpselect.spec.tsx`
- `apps/studio/src/components/workspace/modes.spec.tsx`
- `apps/studio/src/components/workspace/threadlink.spec.tsx`

## Validación

Specs de Studio y e2e del wizard en verde (ver el commit del fix).
