# FIX-e-burgos-005-006 — Mission Control: documentos y relaciones de la conversacion derivados tambien de Bash y menciones, agrupados por ciclo

| Campo         | Valor |
| ------------- | ----- |
| **ID**        | FIX-e-burgos-005-006 |
| **Tipo**      | IMPROVEMENT |
| **Severidad** | low |
| **Fecha**     | 2026-10-26 |
| **Autor**     | e-burgos |
| **Estado**    | implemented |
| **Spec**      | spec-e-burgos-005-studio-conversation-sessions |

## Problema

El panel 'Specs y fixes relacionados' omite casi todos los documentos de la conversacion y colapsa los ciclos en uno solo. Diagnostico con datos reales (hilo bf119c6c, .sdd-studio/threads/bf119c6c-9a6a-4c78-9f83-a99ef37c2cf2.jsonl, 1086 eventos): los eventos de subagentes SI se persisten y llegan (author.agent = sdd-functional/planner/architect/implementor-*/reviewer, parentToolUseId presente). Pero solo 6 tool.start son Write/Edit (5 sobre sdd/: fix-004-001.md, spec-005.spec.md, brief.yaml, architect.md + context update); todo el resto se escribio con Bash (heredocs `cat > $D/cycle.json`, `cat > functional.md` tras `cd`, script /tmp/gen-planner.mjs para planner.md/tasks.json, `sed -i`, `cat >>` a fix-005-004.md, addfix.mjs para fixes.json). conversation.ts documentOf (L127-L130) solo acepta Write/Edit/MultiEdit y exige ruta sdd/specs/<spec>/ literal en item.summary; Bash queda descartado. Ademas el summary de Bash se trunca a 160 chars (apps/studio-bridge/src/engine/tool-summary.ts:8), asi que parte de los destinos es irrecuperable en el front. Ademas relatedFromDocuments (conversation.ts L156-L171) guarda un unico `cycle` por spec (el ultimo gana), sin agrupar por ciclo.

## Solucion propuesta

- Nuevo helper puro `conversation-bash-paths.ts`: dado el summary de un tool Bash extrae destinos de escritura (`> `, `>>`, `tee`, `sed -i`, `cp/mv` destino) bajo sdd/specs/** y sdd/fixes*/**, resolviendo `cd <dir>;`, `D=<dir> &&` + `$D/`, y rutas absolutas o relativas. Best effort: lo truncado o generado por scripts no se inventa.
- conversation.ts: documentOf acepta tambien Bash via ese helper; documentos nuevos con `cycle` (extraido de /cycles/cycle-XX/) y `touchedBy` (agentes). Se agregan relaciones por mencion: ids de spec y de fix presentes en snapshot, citados en tool summaries/mensajes de la conversacion, entran a specs/fixes aunque no tengan documento (`documents` solo contiene escrituras reales).
- Modelo agrupado: `RelatedSpec` gana `cycles: string[]` (se mantiene `cycle` por compatibilidad = ultimo); `ConversationDocument` gana `cycle: string|null`.
- Fuera de alcance: persistir un evento estructurado de documento tocado y subir el cap de 160 chars (toca bridge/protocolo) -> propuesta cycle-02.

## Archivos esperados

- `apps/studio/src/lib/conversation.ts`
- `apps/studio/src/lib/conversation.spec.ts`
- `apps/studio/src/lib/conversation-bash-paths.ts`

## Verificacion

- conversation.spec.ts con fixtures del hilo real: Bash `cat > $D/cycle.json`, `cd X; cat > functional.md`, `sed -i`; ruta absoluta y relativa; multiples ciclos de una spec; mencion sin documento.

## Ajuste del coordinador (prevalece sobre la solucion propuesta)

- Las menciones de spec/fix en texto NO crean entradas en 'Specs y fixes relacionados' ni documentos: solo se listan specs/fixes con al menos un documento generado.
- Las menciones, validadas contra el snapshot (nunca ids truncados), se exponen en `ConversationView.mentions` y solo alimentan `deriveConversationGate` (FIX-e-burgos-005-008) y el 'Detectado: ...' del ThreadLinkPicker (FIX-e-burgos-005-010).
- Derivacion desde Bash: parser puro y conservador; si el summary esta truncado y la ruta no se resuelve con certeza, se descarta.
- `touchedBy` no se agrega: el campo existente `agents` ya cumple ese rol. Documentos de `sdd/fixes*/` fuera de una spec no se derivan (`ConversationDocument.specId` es obligatorio).
