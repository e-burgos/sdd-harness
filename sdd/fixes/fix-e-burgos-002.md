# FIX-e-burgos-002 — SDD Studio: modo de permisos bypassPermissions

| Campo         | Valor                |
| ------------- | -------------------- |
| **ID**        | FIX-e-burgos-002     |
| **Tipo**      | IMPROVEMENT          |
| **Severidad** | medium               |
| **Keyword**   | [IMPROVEMENT]        |
| **Fecha**     | 2026-10-23           |
| **Autor**     | e-burgos             |
| **Estado**    | implemented          |
| **Spec**      | N/A (repo-level)     |

## Problema

El Studio solo ofrece `default | acceptEdits | plan`: toda llamada a Bash/MCP y todo `warn` del SPEC GATE pide aprobación manual, incluso en `acceptEdits`.

## Justificación del bypass

Valor aditivo en un enum del protocolo y pocas líneas en bridge y composer; sin entidades nuevas. Bloquea el uso diario del Studio.

## Solución aplicada

- `PermissionModeChoice` suma `bypassPermissions`.
- El bridge pasa `allowDangerouslySkipPermissions: true` solo en ese modo y no convierte los `warn` del gate en `ask`; los `deny` del gate se mantienen.
- El Composer ofrece el modo "automático (sin preguntar)".

### Archivos modificados

- `libs/studio-protocol/src/domain.ts`
- `apps/studio-bridge/src/engine/claude-sdk-engine.ts` (+ spec)
- `apps/studio/src/components/workspace/Composer.tsx`
- `apps/studio/src/lib/i18n/{es,en}.ts`

### Test de validación

- **Referencia:** `apps/studio-bridge/src/engine/claude-sdk-engine.spec.ts`

### Validación en uso real

- 2026-10-23: el dev confirmó en el Studio local (web :3100 + bridge) que el modo automático no pide aprobación y los deny del SPEC GATE siguen bloqueando.
