# spec-e-burgos-005-studio-conversation-sessions cycle-01 — 2026-10-26

## Estado
Cada hilo nace con `engineSessionId: null` y `provider` del motor; la sesión nace en el primer turno y pertenece a un solo hilo (`sessionOwnedByAnotherThread` rechaza un id ya usado por otro hilo). `thread.updated` publica el id de sesión al conocerse. `toThreadInfo` ya no oculta `engineSessionId`. Cada turno recibe el prefijo de sistema estable del proyecto para prompt caching de Claude; el efecto real del cache no se midió (spike pendiente).

## Estructura
- `engine/stable-prefix.ts`: `STABLE_PREFIX_SOURCES` (context_prompt, constitution, lessons, en ese orden), `composeStablePrefix`, `createStablePrefixLoader`; límite 256 KiB, CRLF normalizado, archivos faltantes omitidos con un aviso por archivo.
- `AgentEngine.provider` (`KnownProvider`) obligatorio y `EngineTurnInput.systemPrefix?`; `ClaudeAgentSdkEngine` lo inyecta como `systemPrompt: { preset: 'claude_code', append, excludeDynamicSections: true, snapshot: true }`; `FakeEngine` registra `receivedSystemPrefixes`.
- `SessionManagerDeps.stablePrefix?`; `onSessionId` usa `publishThread` (difunde y persiste).
- `store.ts`: `StoredThread.provider`; migración de `threads.json` legado (`provider` por defecto `claude`, sesión inválida a `null`).

## Dependencias
Sin dependencias nuevas.

## Qué sigue
- Soporte de un segundo proveedor: reemplazar `deps.engine` por selección según `thread.provider`.
- Correr el spike de cache real (`cache_read_input_tokens > 0` en la segunda sesión; `append` con `options.agent`).
