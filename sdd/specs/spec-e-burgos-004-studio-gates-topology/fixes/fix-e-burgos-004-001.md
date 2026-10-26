# FIX-e-burgos-004-001 — RETROACTIVO: trabajo de Mission Control fuera del SPEC GATE y atribuciones de proveedor inventadas

| Campo         | Valor                                                   |
| ------------- | ------------------------------------------------------- |
| **ID**        | FIX-e-burgos-004-001                                    |
| **Tipo**      | IMPROVEMENT                                             |
| **Severidad** | medium                                                  |
| **Keyword**   | [IMPROVEMENT]                                           |
| **Fecha**     | 2026-10-25                                              |
| **Autor**     | e-burgos                                                |
| **Estado**    | absorbed (cerrado a pedido explícito del dev)           |
| **Spec**      | spec-e-burgos-004-studio-gates-topology                 |

> **Este registro es RETROACTIVO.** El código ya estaba escrito cuando se registró: se
> trabajó en `apps/studio` sin ciclo `in-progress` ni fix abierto (spec-e-burgos-004 ya
> estaba `completed`). Es una violación del FIX GATE y queda documentada como tal. Además el
> alcance supera la elegibilidad del FIX GATE (más de 5 archivos): correspondía un ciclo SDD.

## Problema

1. **Trabajo sin gate.** Después del cierre de spec-e-burgos-004 se implementó en el working
   tree (sin commitear): visor de documentos por agente, tarjetas de diálogo, selectores de
   spec/fix y filtro de fixes en el inspector, sincronización de selección canvas ↔ panel,
   guiones de diálogo por spec/fix, badge de proveedor/sesión, avatar de usuario y scripts
   `dev:studio`/`studio:bridge`. Antes de spec-004 ya había cuatro commits sin ciclo ni fix:
   `9bfa00e`, `2fbf4f2`, `f2e7032`, `5658283` (telemetría dinámica, tipos para build,
   ecosistema genérico con `SubprojectIcon`, diálogos/burbujas/consola del enjambre).
2. **Registros SDD con datos inventados.** Todos los hilos reales del proyecto corrieron con
   Claude (`.sdd-studio/threads.json`: 7 hilos, agentes `sdd-orchestrator`/`sdd-steward`,
   modelo `kit`/`opus`, motor único `claude-sdk-engine.ts`). Aun así varios registros
   atribuían el trabajo a Gemini.
3. **Código con guiones ficticios** que presenta como reales sesiones y proveedores que nunca
   existieron.

## Cobertura: qué ya estaba registrado y qué cubre este fix

Verificado con `git status`, `git log` y los `tasks.json`/`cycle.json` de las specs.

**Ya cubierto por spec-e-burgos-004 cycle-01** (no lo cubre este fix): `lib/gates.ts`,
`lib/gates.spec.ts`, `GateCard.tsx`, `GateInspectorDrawer.tsx`, `LiveAgentChatFeed.tsx`,
`lib/i18n/es.ts`, `lib/i18n/en.ts`, y la parte de gates/Split-View de `AgentMapCanvas.tsx`,
`AgentInspectorDrawer.tsx`, `agentmap.spec.tsx`, `inspectordrawer.spec.tsx`, `swarm-dialogue.ts`.
Nota: spec-004 entera (spec, ciclo y entradas en `index.json`/`global.json`) también está sin
commitear; no se puede separar por hunk en git lo de spec-004 de lo posterior en esos cinco archivos.

**Cubierto por este fix** (sin registro previo):

| Archivo | Qué |
| --- | --- |
| `lib/agent-documents.ts` (+ `.spec.ts`) | Documentos de cada agente para una spec/fix |
| `mission-control/DocumentViewerModal.tsx` (+ spec) | Visor modal de documentos |
| `mission-control/ChatDialogueCard.tsx` (+ spec) | Tarjeta de diálogo con badge de proveedor |
| `mission-control/AgentInspectorDrawer.tsx` | Hunks posteriores: selectores spec/fix, filtro de fixes, badge proveedor/sesión, visor |
| `mission-control/inspectordrawer.spec.tsx` | Tests de esos hunks (incluye el que exige "Google Gemini") |
| `mission-control/AgentMapCanvas.tsx` (+ `agentmap.spec.tsx`) | Sincronización canvas ↔ panel, spec seleccionada por defecto |
| `mission-control/swarm-dialogue.ts` | `SPEC_00X_SCRIPT`, `FIX_*_SCRIPT`, `HarnessProvider`, `detectHarnessProvider` |
| `mission-control/LiveSwarmComms.tsx` | Commit `5658283` + cambios del working tree |
| `mission-control/LiveTelemetryHUD.tsx`, `workspaceapp.spec.tsx` | Commits `9bfa00e`, `2fbf4f2` |
| `mission-control/EcosystemDashboard.tsx`, `SubprojectIcon.tsx`, `ecosystem.spec.tsx` | Commit `f2e7032` |
| `workspace/AgentFace.tsx`, `lib/agents.ts` | Avatar y metadata del agente `user` |
| `package.json` | Scripts `studio:bridge` y `dev:studio` (bridge en 4330 + web en 3100) |

Excluido: `apps/studio/next-env.d.ts` lo regenera `next dev` (`.next/dev/types`). No es trabajo
de nadie; se recomienda revertirlo antes de commitear.

## Falsedades encontradas

**En registros SDD (corregidas en este fix):** la tabla de abajo pasó de `gemini/*` a
`claude/*`. Los tokens eran y siguen siendo estimaciones declaradas (`approx: true`,
`source: declared-estimate`), no mediciones. El modelo Claude exacto de cada unidad no se puede
verificar: se usó el pin del kit para el rol (`sdd-orchestrator` → `opus`) y, para las unidades
de `implementor-front`, el equivalente por tier de la tabla canónica (Flash → `sonnet`,
Pro → `opus`). `by_tier` se recalculó.

| Registro | Antes | Después |
| --- | --- | --- |
| spec-002 `cycle.json` · orchestrator/solo | `gemini/flash` | `claude/opus` |
| spec-003 `cycle.json` · orchestrator/solo | `gemini/pro` | `claude/opus` |
| spec-003 `cycle.json` + `tasks.json` · TASK-001…006 | `gemini/flash` | `claude/sonnet` |
| spec-003 `cycle.json` + `tasks.json` · TASK-007 | `gemini/pro` | `claude/opus` |
| spec-004 `cycle.json` · orchestrator/solo | `gemini/pro` | `claude/opus` |
| spec-004 `cycle.json` + `tasks.json` · TASK-001…006 | `gemini/flash` | `claude/sonnet` |
| `fixes.json` · FIX-e-burgos-003-001 | `gemini/pro` | `claude/opus` |

No había IDs de sesión `session-spec-*` ni menciones "Copilot" en registros de `sdd/`. Lo que
encontré de Gemini/Copilot en `sdd/context` es legítimo (lista de arneses soportados).

**En código (documentadas, NO tocadas aquí — las elimina spec-e-burgos-005 US-5):**

- `swarm-dialogue.ts`: guiones `SPEC_004/003/002/001_SCRIPT`, `FIX_003_001_SCRIPT` y
  `FIX_001_SCRIPT` con conversaciones que nunca ocurrieron. Atribuyen spec-003 y FIX-001 a
  `provider: 'gemini'` y spec-002 a `'copilot'`, con IDs de sesión inventados
  (`session-spec-003-gemini`, `session-spec-002-copilot`, `session-fix-001-gemini`,
  `session-spec-004-gates`, `session-spec-001-session-ux`, `session-fix-003-001`).
- `AgentInspectorDrawer.tsx`: muestra "Google Gemini" / "GitHub Copilot" y arma IDs de sesión
  falsos (`session-${fixId}`, `session-spec-NNN`, `session-live-default`) cuando no hay sesión real.
- `inspectordrawer.spec.tsx`: un test exige "Google Gemini" y `session-spec-003-gemini`.
- `ChatDialogueCard.tsx`: badge de proveedor alimentado por los guiones.
- `AgentMapCanvas.tsx`: spec seleccionada por defecto fija en `spec-e-burgos-004-studio-gates-topology`.
- `LiveTelemetryHUD.tsx`: el fallback sin datos muestra cifras inventadas (6.6M tokens, filas
  Gemini Flash/Pro). Lo dejo como hallazgo para que spec-005 decida si entra en alcance.

## Justificación del bypass

No hubo decisión previa de bypass: el código se escribió sin gate. Este registro devuelve la
trazabilidad. Borrar el trabajo para rehacerlo con un ciclo no aporta nada, porque
spec-e-burgos-005 ya lo reemplaza: elimina guiones y selectores (US-5), reconstruye el enjambre
sobre conversaciones reales (US-4) y conserva el visor de documentos.

## Solución aplicada

- Registro retroactivo con alcance verificado (tabla de cobertura de arriba).
- Corrección de las atribuciones de proveedor inventadas en los registros SDD (tabla de falsedades).
- Fragmento de contexto `sdd/context/apps/studio/updates/2026-10-25-fix-e-burgos-004-001.md`,
  consolidado en la apertura de spec-e-burgos-005.

### Archivos modificados

Ver `affected_files` de FIX-e-burgos-004-001 en `sdd/fixes.json`.

### Test de validación

- **Referencia:** `pnpm --filter sdd-studio-web test`: 58 archivos y 439 tests en verde
  (2026-10-25). `pnpm --filter sdd-studio-web typecheck` limpio. Tests propios del fix:
  `lib/agent-documents.spec.ts`, `documentviewermodal.spec.tsx`, `chatdialoguecard.spec.tsx`.

### Decisión del Reviewer

> Cerrado por el orquestador a pedido explícito del dev (no pasó por el reviewer).
>
> - [ ] `validated`
> - [x] `absorbed`: se formaliza en spec-e-burgos-005-studio-conversation-sessions (US-4, US-5)
