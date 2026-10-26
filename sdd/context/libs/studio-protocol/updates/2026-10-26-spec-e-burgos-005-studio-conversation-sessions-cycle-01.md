# spec-e-burgos-005-studio-conversation-sessions cycle-01 — 2026-10-26

## Estado
`ThreadInfo` suma `engineSessionId` (`EngineSessionId` nullable) y `provider` (`ProviderId`), ambos opcionales: sin bump de `PROTOCOL_VERSION` (sigue en 2); un puente o web antiguos no fallan. `BRIDGE_FEATURES` anuncia `conversation-sessions`.

## Estructura
- `domain.ts`: `KNOWN_PROVIDERS` (`claude`), `KnownProvider`, `DEFAULT_PROVIDER`, `ProviderId` (string con regex, extensible: un proveedor nuevo solo amplía `KNOWN_PROVIDERS`), `isKnownProvider`, `EngineSessionId` (1..128).

## Dependencias
Sin dependencias nuevas.

## Qué sigue
Si un cambio futuro vuelve obligatorios los campos nuevos, requiere bump de `PROTOCOL_VERSION`.
