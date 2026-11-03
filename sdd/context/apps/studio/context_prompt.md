# Context prompt — apps/studio

> Última actualización: consolida los fragmentos de spec-e-burgos-009 cycle-03..06 y spec-e-burgos-010 cycle-01 (tucu-ui 3.9.1, shell con riel de módulos) | Fecha: 2026-11-02

> Entry point para agentes y desarrolladores trabajando en `sdd-studio-web`.
> Leer este documento antes de realizar cambios en la UI, componentes de workspace o stores de Zustand.

## Qué es este subproyecto

Es la aplicación web frontend de **SDD Studio**: una interfaz tipo Slack que se comunica con el daemon local `studio-bridge` para chatear con los agentes, seguir el progreso de las tareas del ciclo en curso y autorizar cambios de código en tiempo real.

## Mapa de navegación rápido

- **Página principal y emparejamiento:** `src/app/w/page.tsx` y `src/components/ConnectScreen.tsx`.
- **Proveedor de WebSocket:** `src/components/BridgeProvider.tsx` y cliente en `src/lib/bridge/client.ts`.
- **Shell y módulos:** `src/components/shell/` (`StudioShell`, `ModuleRail`, `ModulePanel`, `RightPanelFrame`), `src/components/modules/{home,specs,fixes,agents,activity,map,kit,architecture,metrics}` y navegación persistida en `src/lib/nav/`; estados SDD compartidos en `src/lib/sdd-status.ts`.
- **Hilos y Streaming:** `src/components/workspace/ThreadView.tsx`, `Timeline.tsx`, `Composer.tsx`, `PendingMessages.tsx` y `ThreadLinkPicker.tsx`.
- **Aprobaciones de herramientas:** `src/components/workspace/ApprovalCard.tsx`.
- **Autenticación:** `src/components/workspace/AuthPanel.tsx`, `ApiKeyField.tsx`, `src/lib/use-subscription.ts`, `auth-preference.ts`, `usage-limit.ts`.
- **Panel derecho:** `src/components/shell/RightPanelFrame.tsx` (solo en Inicio, Specs, Fixes, Agentes y Mapa).
- **Adjuntos y menú `@`/`/`:** `src/lib/attachments/`, `use-attachment-*.ts`, `use-mention-menu.ts`, `AttachmentTray`, `AttachmentView`, `MentionMenu`.
- **Mission Control:** `src/components/StudioHeader.tsx` (idioma, tema, chip de gate) y `src/components/mission-control/` (mapa del enjambre, Gates, inspector, visor de documentos, ecosistema, telemetría); modelos en `src/lib/agents.ts`, `gates.ts`, `agent-documents.ts` y `conversation.ts` (conversación elegida, sesión/proveedor reales, documentos y specs/fixes derivados de eventos; sin guiones ficticios).
- **Tema y UI kit:** `@e-burgos/tucu-ui` 3.9.1 (`app/layout.tsx` con `ThemeModeScript`, `StudioThemeProvider.tsx`, `app/globals.css`, `lib/typography-tokens.ts`); envoltorios `HelpSelect` y `SegmentedControl`, el resto de componentes de tucu-ui directo; modo claro/oscuro desde `StudioHeader`; escala `text-micro|meta|ui|small|copy|title`.
- **Capacidades del puente y flujo de spec:** `src/lib/use-bridge-features.ts`, `CapabilityNotice.tsx`, `QuestionForm.tsx`, `ContextMeter.tsx`, `ModeSelectors.tsx` + `lib/flow-choice.ts`, `PreparedConversations.tsx` + `lib/auto-conversation.ts`, `lib/link-targets.ts`, `lib/conversation-gate.ts`, `GateStatusModal`.
- **Stores de Zustand:** `src/lib/store/` (`timeline.ts`, `state.ts`, `activity.ts`, `selectors.ts`); hooks en `src/lib/` (`use-collapsed-state.ts`, `use-stick-to-bottom.ts`, `use-panel-state.ts`).

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
- **Tema:** colores y tamaños salen de los tokens del tema de tucu-ui y de la escala tipográfica de `globals.css`; nada de `text-[Npx]`, `text-white` ni hex sueltos. Cero `<select>` nativos (`HelpSelect`).
- **Puentes anteriores:** cada capacidad nueva se activa con su feature de `Welcome.features`; sin ella se muestra un aviso no bloqueante.
- **E2E:** sirve `apps/studio-bridge/dist/web`; tras cambiar UI, `build:local` → build del bridge → `e2e`.
- **Iconografía:** solo `lucide-react`; nada de emojis ni glifos decorativos.
- **Tipos sincronizados:** Todo cambio en la estructura de mensajes debe coordinarse con `libs/studio-protocol`.
- **Protocolo en `next dev`:** una rama que cambia el protocolo rompe el handshake con el puente publicado vía HMR; no usarla para el Studio de uso diario.
