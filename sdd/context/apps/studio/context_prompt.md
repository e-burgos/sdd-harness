# Context prompt — apps/studio

> Entry point para agentes y desarrolladores trabajando en `sdd-studio-web`.
> Leer este documento antes de realizar cambios en la UI, componentes de workspace o stores de Zustand.

## Qué es este subproyecto

Es la aplicación web frontend de **SDD Studio**: una interfaz tipo Slack que se comunica con el daemon local `studio-bridge` para chatear con los agentes, seguir el progreso de las tareas del ciclo en curso y autorizar cambios de código en tiempo real.

## Mapa de navegación rápido

- **Página principal y emparejamiento:** `src/app/w/page.tsx` y `src/components/ConnectScreen.tsx`.
- **Proveedor de WebSocket:** `src/components/BridgeProvider.tsx` y cliente en `src/lib/bridge/client.ts`.
- **Layout del Workspace:** `src/components/workspace/WorkspaceApp.tsx` y `Sidebar.tsx`.
- **Hilos y Streaming:** `src/components/workspace/Timeline.tsx` y `ChannelView.tsx`.
- **Aprobaciones de herramientas:** `src/components/workspace/ApprovalCard.tsx`.
- **Panel derecho (Snapshot):** `src/components/workspace/RightPanel.tsx`.
- **Stores de Zustand:** `src/lib/store/` (`timeline.ts`, `state.ts`, `activity.ts`, `selectors.ts`).

## Cómo desarrollar y testear localmente

Para desarrollar con el backend completo conectado:
1. En una terminal, levanta el bridge en modo fake:
   ```bash
   node apps/studio-bridge/bin/sdd-studio.mjs --engine fake --no-open --root apps/studio-bridge/test/fixtures/workspace --web-url http://localhost:3100
   ```
2. En otra terminal, corre Next.js:
   ```bash
   pnpm dev:studio
   ```
3. Abre en el navegador la URL que imprimió el bridge con el token (`http://localhost:3100/w#bridge=...&token=...`).

Comandos de verificación:
- Tests: `pnpm --filter sdd-studio-web test`
- Typecheck: `pnpm --filter sdd-studio-web typecheck`
- E2E Playwright: `pnpm --filter sdd-studio-web e2e`

## Consideraciones críticas

- **Modo exportación estática:** Recuerda que la build de producción (`STUDIO_EXPORT=1`) genera HTML/JS puro en `out/` para desplegarse en Cloudflare Pages o servirse mediante el bridge. Evita APIs de Node server en rutas de frontend.
- **Tipos sincronizados:** Todo cambio en la estructura de mensajes debe coordinarse con `libs/studio-protocol`.
