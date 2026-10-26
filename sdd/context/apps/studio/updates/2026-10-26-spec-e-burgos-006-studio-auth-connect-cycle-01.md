# spec-e-burgos-006-studio-auth-connect cycle-01 — 2026-10-26

## Estado
La sidebar tiene `AuthPanel` con solapas Suscripción / API key (tablist accesible); la solapa elegida se aplica al bridge y se recuerda en localStorage (`sdd-studio.authPreference`).

## Estructura
- `components/workspace/AuthPanel.tsx`, `ApiKeyField.tsx` (cuerpo de la solapa), `lib/use-subscription.ts` (polling de `auth.status` cada 2 s mientras hay login pendiente), `lib/auth-preference.ts`, `lib/usage-limit.ts`.
- `BridgeProvider`: `authPreference` y `setAuthPreference`.
- `Timeline`: pista de cambio de cuenta ante el error de límite de uso.

## Dependencias
Sin dependencias nuevas.

## Qué sigue
Probar a mano el login real contra claude.ai.
