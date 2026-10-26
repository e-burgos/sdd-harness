# spec-e-burgos-006-studio-auth-connect cycle-01 — 2026-10-26

## Estado
Comandos `auth.status`, `auth.login`, `auth.logout`; `auth.set` acepta `mode` opcional (`subscription`|`api-key`). `AuthMode` no cambia.

## Estructura
- `domain.ts`: `AuthPreference`, `AuthAccountState`, `AuthAccount` (state, email, method, plan, loginUrl, error).
- `limits.ts`: feature `auth-subscription` en `BRIDGE_FEATURES`.

## Dependencias
Sin cambios.

## Qué sigue
Todo campo nuevo del protocolo entra opcional; la web detecta bridges viejos por `features`.
