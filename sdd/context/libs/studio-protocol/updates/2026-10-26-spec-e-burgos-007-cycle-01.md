# spec-e-burgos-007 cycle-01 — 2026-10-26

## Estado
El protocolo transporta el título de sesión, las asociaciones múltiples con origen y el evento estructurado de documentos tocados. Todo es aditivo: `PROTOCOL_VERSION` sigue en 2 y webs y puentes de versiones distintas siguen conectando.

## Estructura
- `domain.ts`: `LinkOrigin` (`detected | manual`), `ThreadLinkRef` (spec, ciclo o fix), `ThreadLinkEntry` (ref + `origin`), `ThreadLink.targets` opcional con `.catch(undefined)` y `ThreadInfo.sessionTitle` (`string | null`, opcional, `.catch(null)`, máximo 300). `link.target` conserva su unión vieja (`cycle | fix | none`) como compatibilidad y el puente lo deriva de `targets`.
- `events.ts`: miembro `document.touched` de `ThreadEvent` (`path` 1..1024, `op` `created | modified | deleted`, `author`; sin `seq` propio, rige el del sobre) y `tool.start.summaryTruncated` opcional.
- `commands.ts`: `thread.updateLinks` (`add`/`remove` de `ThreadLinkRef`, máximo 8 cada uno, por defecto `[]`) y `thread.history.includeDocumentTouched` (por defecto `false`).
- `limits.ts`: `MAX_LINK_TARGETS = 32`; `BRIDGE_FEATURES` agrega `session-title`, `link-targets` y `document-touched` al final.
- Un puente que no filtrara `document.touched` del historial rompería a una web vieja (`bootstrap.ts` parsea el historial completo): por eso `includeDocumentTouched` es opt-in.

## Dependencias
Sin dependencias nuevas.

## Qué sigue
- Todo comando nuevo se usa solo si `client.supports(feature)`: un puente viejo ignora el comando y la petición vence a los 15 s.
- Volver obligatorio cualquiera de estos campos exige bump de `PROTOCOL_VERSION`.
