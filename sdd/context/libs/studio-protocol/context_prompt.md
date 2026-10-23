# Context prompt — libs/studio-protocol

> Última actualización: cycle-01 (spec-e-burgos-001-studio-session-ux) | Fecha: 2026-10-23

> Entry point para agentes y desarrolladores trabajando en `@sdd-studio/protocol`.
> Leer este documento antes de tocar tipos, esquemas o mensajes del protocolo.

## Qué es este subproyecto

Es la librería que define los tipos, esquemas Zod y códec binario/JSON para la comunicación en tiempo real entre el servidor local (`studio-bridge`) y la interfaz gráfica (`studio`).

## Estructura de archivos y contratos

- `src/domain.ts`: Enums y tipos de canales, agentes, modelos de IA, esfuerzo y niveles de permiso.
- `src/commands.ts`: Catálogo de comandos que el frontend puede enviar al backend.
- `src/events.ts`: Eventos en streaming (texto, deltas, diffs de herramientas, aprobaciones).
- `src/handshake.ts`: Validación de tokens de pairing y protocolo de conexión inicial.
- `src/snapshot.ts`: Definición del estado reactivo del workspace (specs, tasks, fixes, agentes, skills, global).
- `src/limits.ts`: límites compartidos (frame, adjuntos, refs, búsqueda, pendientes) y `BRIDGE_FEATURES`.
- `src/attachments.ts`: mimes y extensiones de adjuntos.
- `src/version.ts`: `PROTOCOL_VERSION = 2`.
- `src/codec.ts`: Funciones `decodeClientMessage` y `decodeServerMessage`.
- `src/index.ts`: Re-exportación completa de la API pública.

## Flujo de desarrollo y testing

Cada archivo `.ts` cuenta con su respectivo `.spec.ts`.
1. Al modificar un esquema en Zod, actualizar sus tests de deserialización:
   `pnpm --filter @sdd-studio/protocol test`
2. Correr verificación estricta de TypeScript:
   `pnpm --filter @sdd-studio/protocol typecheck`
3. Inmediatamente después, verificar que no rompa el typecheck de los subproyectos que lo consumen:
   `pnpm --filter @e-burgos/sdd-studio typecheck`
   `pnpm --filter sdd-studio-web typecheck`

## Precauciones

- **Cero APIs de Node.js:** Este paquete corre en el navegador de la web app. Prohibido importar `node:fs`, `node:path`, `node:crypto` o `process`.
- **Zod 4 compatibility:** Los esquemas utilizan Zod 4. Cuidar operadores y métodos deprecated.
