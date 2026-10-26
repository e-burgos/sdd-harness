# Context prompt — apps/studio

> Última actualización: cycle-01 (spec-e-burgos-004-studio-gates-topology) + FIX-e-burgos-004-001 | Fecha: 2026-10-25

> Entry point para agentes y desarrolladores trabajando en `sdd-studio-web`.
> Leer este documento antes de realizar cambios en la UI, componentes de workspace o stores de Zustand.

## Qué es este subproyecto

Es la aplicación web frontend de **SDD Studio**: una interfaz tipo Slack que se comunica con el daemon local `studio-bridge` para chatear con los agentes, seguir el progreso de las tareas del ciclo en curso y autorizar cambios de código en tiempo real.

## Mapa de navegación rápido

- **Página principal y emparejamiento:** `src/app/w/page.tsx` y `src/components/ConnectScreen.tsx`.
- **Proveedor de WebSocket:** `src/components/BridgeProvider.tsx` y cliente en `src/lib/bridge/client.ts`.
- **Layout del Workspace:** `src/components/workspace/WorkspaceApp.tsx`, `Sidebar.tsx` y el árbol `NavTree.tsx` (modelo puro en `src/lib/store/nav-tree.ts`).
- **Hilos y Streaming:** `src/components/workspace/Timeline.tsx`, `ChannelView.tsx`, `Composer.tsx`, `PendingMessages.tsx` y `ThreadLinkPicker.tsx`.
- **Aprobaciones de herramientas:** `src/components/workspace/ApprovalCard.tsx`.
- **Panel derecho (Snapshot):** `src/components/workspace/RightPanel.tsx`.
- **Adjuntos y menú `@`/`/`:** `src/lib/attachments/`, `use-attachment-*.ts`, `use-mention-menu.ts`, `AttachmentTray`, `AttachmentView`, `MentionMenu`.
- **Mission Control:** `src/components/StudioHeader.tsx` (vistas) y `src/components/mission-control/` (mapa del enjambre, Gates, inspector, visor de documentos, ecosistema, telemetría); modelos en `src/lib/agents.ts`, `gates.ts`, `agent-documents.ts`. Los diálogos de `swarm-dialogue.ts` son guiones ficticios hasta spec-e-burgos-005.
- **Stores de Zustand:** `src/lib/store/` (`timeline.ts`, `state.ts`, `activity.ts`, `selectors.ts`, `nav-tree.ts`); hooks en `src/lib/` (`use-collapsed-state.ts`, `use-stick-to-bottom.ts`, `use-panel-state.ts`).

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
- **Protocolo en `next dev`:** una rama que cambia el protocolo rompe el handshake con el puente publicado vía HMR; no usarla para el Studio de uso diario.
