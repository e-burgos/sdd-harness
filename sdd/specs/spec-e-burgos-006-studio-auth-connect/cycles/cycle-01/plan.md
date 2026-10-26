# spec-e-burgos-006-studio-auth-connect — cycle-01 · plan (lite)

> Módulo: studio-auth-connect | Subproyectos: apps/studio, apps/studio-bridge, libs/studio-protocol | Fecha: 2026-10-26
> Objetivo: la sidebar ofrece dos solapas (Suscripción / API key); el puente lanza `claude auth login` y reporta estado; el modo elegido define el env del SDK. Fuera de alcance: persistir tokens, OAuth propio, otros proveedores.

## Historias
- US-1 — Como dev quiero tocar «Conectar suscripción» y quedar logueado en Claude sin salir de Studio. CA: el puente lanza `claude auth login --claudeai`, la web recibe la URL de login y el estado conectado con email, método y plan.
- US-2 — Como dev quiero ver el estado de la cuenta y desconectarla. CA: `auth.status` devuelve connected/disconnected/pending/error; «Desconectar» pide confirmación y ejecuta `claude auth logout`.
- US-3 — Como dev quiero que elegir la solapa sea efectivo. CA: en suscripción el env del SDK no contiene ANTHROPIC_API_KEY ni ANTHROPIC_AUTH_TOKEN; en API key usa la key; clientes viejos siguen funcionando.
- US-4 — Como dev quiero una pista cuando la cuenta alcanzó su límite de uso. CA: ante el 400 de límite la UI sugiere cambiar de solapa o cuenta, sin cifras inventadas.

## Tasks (detalle en tasks.json)
- TASK-001 — Protocolo: `auth.status`, `auth.login`, `auth.logout`, `mode` opcional en `auth.set`, esquema `AuthAccount`, feature `auth-subscription`; tests en commands.spec.ts.
- TASK-002 — Puente: `ClaudeLogin` (spawn de `claude auth status|login|logout`, captura de URL, estado pending), `AuthState` con preferencia de modo y env limpio, handlers del router; tests.
- TASK-003 — Web: acciones de auth en BridgeProvider, `AuthPanel` con tablist, `SubscriptionTab`, `ApiKeyField` como solapa, i18n es/en, Sidebar; tests.
- TASK-004 — Pista de límite de uso: detección del 400 de límite y mensaje en el chat; tests.

## Decisiones técnicas (obligatoria si toca schema/api/components)
- `AuthMode` no cambia (`local-claude-login` | `api-key`): la suscripción es el login local; la preferencia viaja en `auth.set.mode` opcional → un cliente viejo nunca ve un valor de enum desconocido.
- Sin evento nuevo: `auth.login` devuelve `{state:'pending', loginUrl}` y la web consulta `auth.status` cada 2 s mientras haya login en curso → el flujo más simple que cumple «un botón y queda logueado».
- El puente no abre el navegador por su cuenta: el CLI ya lo abre; la web muestra el enlace como respaldo.
- Contratos nuevos de protocolo sin registro en api.json: el repo no versiona el protocolo de Studio ahí (aviso de validador, si aparece, se reporta).
