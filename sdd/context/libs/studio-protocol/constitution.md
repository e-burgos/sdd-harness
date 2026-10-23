# Constitución — libs/studio-protocol

> Versión 1.0 | Última actualización: 2026-10-23 (profundización de contexto)

## 1. Propósito y Alcance

- **Tipo:** lib (librería compartida interna del monorepo)
- **Paquete:** `@sdd-studio/protocol`
- **Rol en el sistema:** Define el contrato formal y tipado de extremo a extremo entre el puente local (`@e-burgos/sdd-studio`) y la interfaz web (`sdd-studio-web`). Garantiza la compatibilidad de mensajes, eventos, comandos y snapshots que fluyen por WebSocket local (127.0.0.1).
- **Consumidores:** `apps/studio` (frontend) y `apps/studio-bridge` (backend/daemon).

## 2. Stack Tecnológico

- **Runtime:** TypeScript estricto (ESM). No requiere paso de compilación previo para desarrollo: exporta directamente `src/index.ts`.
- **Esquemas y Validación en Runtime:** `zod` (^4.0.0). Todos los mensajes recibidos o enviados se validan contra esquemas Zod con parsing estricto.
- **Testing:** `vitest`. Pruebas exhaustivas al lado de cada módulo (`*.spec.ts`).

## 3. Estructura y Módulos del Contrato

- `version.ts`: Constante `PROTOCOL_VERSION = 1`. El handshake valida coincidencia exacta de versión de protocolo.
- `domain.ts`: Tipos base y entidades de dominio:
  - `ChannelId`: `general`, `fixes`, `spec:<id>` o `dm:<agentId>`.
  - `AgentId`: Roles SDD (`orchestrator`, `functional`, `planner`, `architect`, `implementor-back`, `implementor-front`, `reviewer`, `steward`).
  - `ModelChoice`: Tiers simbólicos (`kit`, `haiku`, `sonnet`, `opus`, `fable`, o proveedor explícito).
  - `Effort`: `low`, `medium`, `high`, `xhigh`, `max`.
  - `PermissionModeChoice`: `ask` (aprobación en UI para cada herramienta sensible), `acceptEdits` (edición permitida si pasa el SPEC GATE), `plan` (modo solo lectura).
  - `Presence`, `SessionStatus`, `ThreadOptions`, `Author`.
- `commands.ts`: Comandos enviados desde la web al puente local (`ClientCommand` - discriminated union por `cmd`):
  - `workspace.snapshot`: Pide estado completo del repo.
  - `thread.create`, `thread.send`, `thread.interrupt`, `thread.setOptions`, `thread.list`, `thread.history`.
  - `approval.respond`: Aprobación o rechazo (`allow` | `deny`) de un tool call con alcance `once` o `thread`.
  - `command.run`: Ejecución segura de comandos del kit (`gate`, `validate`, `rebuild-tasks-index`, `rebuild-catalog`).
  - `auth.set`: Configuración en memoria de API key de Anthropic (nunca persistida en disco).
- `events.ts`: Eventos emitidos desde el puente hacia la web:
  - `ThreadEvent` (mensajes, streaming de texto `message.delta`, tool call start/end con diff y resumen, subagentes `subagent.start|stop`, solicitud de aprobación `approval.requested` con warnings del SPEC GATE).
  - `ServerEvent` (`thread.event`, `channel.event`, `bot.activity`, `workspace.changed`, `presence.changed`).
- `handshake.ts`: Mensajes de conexión inicial `hello` (envía token del hash de la URL y versión) y `welcome` (devuelve ruta del workspace, proyecto, versión del kit y modo de autenticación `AuthMode`). Errores: `handshake.error`.
- `snapshot.ts`: Esquema `WorkspaceSnapshot` que modela en memoria el estado completo del kit: módulos en `global.json`, `specs` (`SpecSummary`), `cycles` (`CycleSummary` con tareas y estado), `fixes` (`FixSummary`), configuración de agentes, herramientas (`tools.json`) y pricing.
- `codec.ts`: Encoders y decoders seguros (`decodeClientMessage`, `decodeServerMessage`, `encodeMessage`).

## 4. Comandos de Trabajo

- **Tests unitarios:** `pnpm --filter @sdd-studio/protocol test`
- **Verificación de tipos:** `pnpm --filter @sdd-studio/protocol typecheck` (`tsc --noEmit -p tsconfig.json`)

## 5. Reglas Inviolables y Versionado

1. **Invariante de sincronización:** Cualquier cambio en este paquete impacta simultáneamente a `apps/studio` y `apps/studio-bridge`. Modificaciones en comandos o eventos deben ser retrocompatibles o requerir incremento de `PROTOCOL_VERSION` en `version.ts`.
2. **Sin dependencias pesadas:** Debe mantenerse ultra liviano (solo `zod`). No debe depender de Node.js nativo (fs, path, child_process) para permitir su ejecución sin problemas en entornos navegador (Next.js / browser).
3. **Flujo SDD:** Cambios estructurales en `libs/studio-protocol` deben correr bajo un ciclo SDD completo (`flow: full`), ya que es un contrato consumido por dos subproyectos distintos.
