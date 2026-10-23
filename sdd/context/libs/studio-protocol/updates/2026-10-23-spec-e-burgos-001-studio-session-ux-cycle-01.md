# spec-e-burgos-001-studio-session-ux cycle-01 — 2026-10-23

## Estado

- `PROTOCOL_VERSION = 2` (resuelve: `version.ts` del base, que dice 1). Un único bump cubre los contratos de toda la spec, incluidos los de cycle-02 (adjuntos, `@archivo`, skills/agentes), que ya están definidos pero el puente responde `unsupported` hasta cycle-02.
- Handshake: `Welcome.features` (opcional, lista de `BRIDGE_FEATURES`) para que la web detecte capacidades sin otro bump.

## Estructura

- `limits.ts` (nuevo): `MAX_FRAME_BYTES` (1 MiB), `FRAME_BUDGET_BYTES`, `MAX_ATTACHMENTS`, `IMAGE_MAX_SIDE`, `MAX_PROMPT_REFS`, `FILE_SEARCH_MAX`, `MAX_PENDING_PER_THREAD` (10), `BRIDGE_FEATURES`.
- `attachments.ts` (nuevo, solo contrato para cycle-02): mimes de imagen/PDF/texto, `TEXT_ATTACHMENT_EXTENSIONS`.
- `domain.ts`: `ThreadLink` / `ThreadLinkTarget` (`cycle` | `fix` | `none`, `source` auto/manual/legacy), `ThreadInfo.link` y `ThreadInfo.pendingCount`, `AlwaysOffer` / `AlwaysRule` (`tool` | `mcp` | `bash-prefix`, `none` con motivo), `SendResult` (`started` | `pending`).
- `commands.ts`: `thread.send` acepta `MessageBody`; nuevos `thread.pending.edit|remove|flush`, `thread.setLink` y `link` opcional en `thread.create`; `workspace.searchFiles`, `attachment.get`.
- `events.ts`: `pending.added|edited|removed|reverted`; `user.message` con `pendingId` y `delivery` (`cut-point` | `next-turn`); `approval.requested.always` y `approval.resolved.remembered`.
- `snapshot.ts`: agentes con `source`/`path`, `skills[]`, fixes con `createdAt`/`closedAt`.

## Qué sigue

- cycle-02 implementa del lado puente/web los contratos ya publicados (adjuntos, `workspace.searchFiles`, skills/agentes) sin nuevo bump de versión.
