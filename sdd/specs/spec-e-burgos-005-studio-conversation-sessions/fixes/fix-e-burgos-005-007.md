# FIX-e-burgos-005-007 — Mission Control: Specs y fixes relacionados agrupa spec -> ciclo -> archivo y fix -> documento

| Campo         | Valor |
| ------------- | ----- |
| **ID**        | FIX-e-burgos-005-007 |
| **Tipo**      | IMPROVEMENT |
| **Severidad** | low |
| **Fecha**     | 2026-10-26 |
| **Autor**     | e-burgos |
| **Estado**    | pending |
| **Spec**      | spec-e-burgos-005-studio-conversation-sessions |

## Problema

RelatedDocuments.tsx (L89-L91) lista los documentos de una spec en plano filtrando `fixId === null` y muestra un solo ciclo; no agrupa por ciclo y los docs de fix quedan separados de su spec. Consume el modelo agrupado de FIX-e-burgos-005-006.

## Solucion propuesta

- Spec -> subgrupo por ciclo (orden cycle-01..N; documentos sin ciclo en 'Spec / raiz') -> archivos (abre el visor, muestra agente autor).
- Fix -> sus documentos, con enlace a su spec; contador de documentos por grupo.
- i18n: titulos de grupo ('Raiz de la spec', 'Ciclo {cycle}').

## Archivos esperados

- `apps/studio/src/components/mission-control/RelatedDocuments.tsx`
- `apps/studio/src/components/mission-control/RelatedDocuments.spec.tsx`
- `apps/studio/src/lib/i18n/es.ts`
- `apps/studio/src/lib/i18n/en.ts`

## Verificacion

- RelatedDocuments.spec.tsx: spec con 2 ciclos + raiz, fix con doc, spec solo mencionada sin documentos.
