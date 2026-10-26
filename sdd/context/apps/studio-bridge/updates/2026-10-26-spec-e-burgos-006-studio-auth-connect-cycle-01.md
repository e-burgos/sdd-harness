# spec-e-burgos-006-studio-auth-connect cycle-01 — 2026-10-26

## Estado
El puente lanza el CLI de Claude (`claude auth login --claudeai`, `status --json`, `logout`) y reporta `AuthAccount`; `AuthState` guarda la preferencia de modo.

## Estructura
- `src/auth/claude-login.ts`: `ClaudeLogin` (spawn sin shell, captura de URL, estado pending, errores redactados).
- `auth-mode.ts`: `withoutCredentialEnv`, `cliEnv()`; en suscripción `env()` no lleva ANTHROPIC_API_KEY ni ANTHROPIC_AUTH_TOKEN; con key explícita se descarta el token heredado.
- `server/router.ts`: handlers de `auth.status|login|logout`.

## Dependencias
Requiere el binario `claude` en PATH para la solapa Suscripción.

## Qué sigue
El navegador lo abre el CLI; el puente no abre URLs por su cuenta.
