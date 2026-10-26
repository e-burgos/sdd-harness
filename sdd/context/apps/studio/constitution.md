# Constitución — apps/studio

> Versión 1.3 | Última actualización: cycle-01 (spec-e-burgos-004-studio-gates-topology) + FIX-e-burgos-004-001 | Fecha: 2026-10-25

## 1. Propósito y Alcance

- **Tipo:** app (Aplicación web frontend SPA / Static Export)
- **Paquete:** `sdd-studio-web`
- **Rol en el sistema:** Interfaz gráfica estilo Slack para operar y supervisar los agentes del kit SDD en tiempo real. Proporciona canales por spec (`#spec:...`), canal de fixes (`#fixes`), canal `#general` y mensajes directos (`dm:...`) con cada agente especializado. Permite interactuar con hilos de ejecución, ver el progreso de herramientas con diffs en vivo, conceder o denegar permisos de modificación de archivos mediante tarjetas de aprobación interactivas, y monitorizar el tablero global de specs, tareas y costos.
- **Topología de red:** Se ejecuta en el navegador (producción: `studio.sdd.estebanburgos.com.ar` desplegado en Cloudflare Pages, o servido localmente por el puente con `--local-ui`). Se conecta exclusivamente mediante WebSocket a `127.0.0.1` (el bridge local). La web app es completamente estática y agnóstica de credenciales: nunca maneja claves API en sus servidores.

## 2. Stack Tecnológico

- **Framework:** Next.js 16 (`next` 16.4.3, App Router, static export con `STUDIO_EXPORT=1`).
- **Librería UI:** React 19, Tailwind CSS (PostCSS), `@phosphor-icons/react` (iconografía del kit).
- **Tipografía:** `@fontsource-variable/space-grotesk` y `@fontsource-variable/jetbrains-mono`.
- **Estado Global:** `zustand` estructurado en slices modulares (`activity`, `timeline`, `state`, `selectors`).
- **Contrato de Red:** `@sdd-studio/protocol` y `zod`.
- **Renderizado Markdown:** `react-markdown` y `remark-gfm` con soporte para syntax highlighting, diffs y badges de herramientas.
- **Testing:**
  - `vitest` + `@testing-library/react` + `jsdom` para componentes unitarios y stores.
  - `playwright` (`playwright.config.ts`) para tests E2E levantando el bridge en modo `--engine fake --local-ui`.

## 3. Arquitectura y Componentes Clave

### 3.1 Rutas y Conexión (`src/app/`)
- `layout.tsx`: Layout raíz con configuración de fuentes y temas oscuros.
- `page.tsx`: Redirección hacia `/w` (workspace).
- `w/page.tsx`: Pantalla principal del workspace que procesa el hash `#bridge=...&token=...`.
- `BridgeProvider.tsx`: Contexto de React que gestiona el ciclo de vida de la conexión WebSocket con `client.ts` (`connected`, `connecting`, `disconnected`, `error`).
- `ConnectScreen.tsx`: Pantalla de bienvenida y emparejamiento cuando no hay conexión activa con el puente local.

### 3.2 Componentes del Workspace (`src/components/workspace/`)
- `AppShell.tsx`, `WorkspaceApp.tsx` & `Workspace.tsx`: shell anclado al viewport (sin scroll del documento ni saltos al enfocar el composer), enrutamiento por vistas (`workspace`, `agent-map`, `ecosystem`, `telemetry`) preservando el estado y columnas Sidebar, ChannelView / ThreadView, RightPanel.
- `PanelRail.tsx` + `lib/use-panel-state.ts`: sidebar y panel derecho colapsables, preferencia en `localStorage`.
- `ErrorBoundary.tsx`: boundary de nivel superior con fallback i18n y botón de recarga.
- `Sidebar.tsx` (`SidebarView`): header y pie fijos con un único árbol con scroll entre ambos.
- `NavTree.tsx` (`SectionView`, `NavNodeView`, `ActiveThreads`): árbol colapsable con teclado y estado persistido. Secciones: HILOS ACTIVOS (waiting-approval primero, badge de pendientes, aviso de estado desactualizado sin conexión), CANALES (sistema; sin canales `spec:*`), SPECS (spec → ciclo → hilos, nodo "Sin ciclo"), FIXES (abiertos + 5 cerrados + "anteriores") y AGENTES (DMs con presencia). El caret colapsa; el nombre abre el canal.
- `ChannelView.tsx`: Vista del canal con flujo de hilos y actividad automatizada de bots.
- `Timeline.tsx`: Secuencia cronológica de mensajes, ejecuciones de subagentes y llamadas a herramientas (agrupadas con diffs desplegables); subtítulo `{role} · {title}` bajo el nombre del agente.
- `AgentFace.tsx` + `AgentAvatar.tsx`: caras SVG dibujadas por agente (9 del enjambre + `user`), con indicador de presencia y halo; el rol se muestra bajo el nombre en Timeline, NavTree, RightPanel y nodos del mapa.
- `Composer.tsx`: Input con selector de modelo (`kit`, `haiku`, `sonnet`, `opus`, `fable`), effort y modo de permiso (`ask`, `acceptEdits`, `plan`); altura acotada a 200 px con scroll interno y atajos visibles. Borrador por hilo con adjuntos (solo en memoria); botón Queue mientras la sesión trabaja y "Send pending" tras un interrupt. Adjuntos: elegir, pegar o arrastrar (máx. 5, preview con quitar).
- `AttachmentTray` (COMP-007), `AttachmentView` (COMP-008, reserva caja por width/height, marcador «Adjunto no disponible») y `MentionMenu` (COMP-009, ARIA combobox/listbox). Menú `@` (agentes primero, luego archivos) y `/` (comandos + skills/prompts); Enter/Tab eligen, un comando escrito completo se envía con un solo Enter, Esc cierra. Sin `file-search` ni `catalog` en `Welcome.features` no se abre ningún menú.
- `PendingMessages.tsx`: bandeja "Pending messages" del hilo con editar/quitar; el mensaje entregado se rotula "Delivered as the next turn" cuando no entró en un punto de corte.
- `ThreadLinkPicker.tsx`: selector "Linked to" para reasignar el hilo a un ciclo o fix.
- `ActivityIndicator.tsx`: indicadores animados (running / waiting-approval / queued) en hilo, fila y avatar; estáticos con `prefers-reduced-motion`.
- `ApprovalCard.tsx`: Widget de decisión que aparece cuando un agente solicita ejecutar una herramienta protegida. Muestra el comando o diff exacto (argumentos largos colapsables), advertencias del SPEC GATE y Aprobar / Denegar. "Always (thread)" muestra la regla que recordaría (herramienta, tool MCP o prefijo Bash) y se oculta cuando no es segura (aviso del gate o comando no calculable).
- `RightPanel.tsx`: Panel lateral con resumen del repo: estado del kit, specs en vuelo, avance de tareas del ciclo activo, métricas de tokens y costos acumulados en la sesión.

### 3.3 Gestión de Estado y Red (`src/lib/`)
- `bridge/client.ts`: Cliente WebSocket reactivo. Reconexión automática, cola de mensajes pendientes, promesas de petición-respuesta, despacho de `ServerEvent` al store y guarda de tamaño de frame (`FRAME_BUDGET_BYTES`). `error-text.ts` traduce los errores de versión de protocolo.
- `attachments/`: `classify.ts` (mime + magic bytes, texto UTF-8 estricto), `encode-image.ts` (re-encode SIEMPRE a ≤1568 px sin EXIF; PNG→webp con fallback png; si el re-encode falla la imagen se rechaza), `frame-budget.ts` (`commandFrameBytes` + escalera de recompresión hasta `FRAME_BUDGET_BYTES`), `build-draft.ts`, `draft-attachment.ts`, `bytes.ts`.
- Hooks: `use-attachment-draft.ts`, `use-attachment-content.ts` (caché LRU de object URLs por sha256, verificación de hash; `primeAttachmentContent` best-effort), `use-mention-menu.ts` (debounce 120 ms con descarte por secuencia, grupos files/agents/commands/skills). `mention.ts` detecta el trigger activo; `composer-refs.ts` extrae refs `@agente`/`/skill` (`FIXED_COMMANDS`).
- `use-collapsed-state.ts`: colapso del árbol en `localStorage` (`sdd-studio.sidebar.v1:<project>`, overrides podados). `use-stick-to-bottom.ts`: auto-scroll con ResizeObserver (umbral 48 px). Los hooks viven en `src/lib/`, no en `src/hooks/`.
- `store/`:
  - `timeline.ts`: Hilos, deltas de streaming, tool calls en vuelo, aprobaciones pendientes, mensajes pendientes y reglas `remembered`.
  - `activity.ts`: Registra eventos generales del workspace y actividad de bots.
  - `state.ts`: Estado de conexión, snapshot (`WorkspaceSnapshot`), presencia, canal activo, dedupe de eventos de bot consecutivos idénticos y slice `drafts` (`ComposerDraft = { text, attachments }` por `threadId` o `new:<channel>`; revoca las object URLs de adjuntos quitados).
  - `selectors.ts`: Selectores memoizados (incluye `activeThreads`).
  - `nav-tree.ts`: `buildNavTree(snapshot, threads, view)` puro; los ids de nodo son las claves de colapso.

### 3.4 Mission Control, Topología de Agentes y Gates (`src/components/mission-control/`)
- `StudioHeader.tsx`: Cabecera global con selector segmentado de vistas (`workspace`, `agent-map`, `ecosystem`, `telemetry`), píldora de ciclo activo y telemetría en tiempo real.
- `AgentMapCanvas.tsx`: Lienzo 2D SVG responsivo que visualiza el enjambre de 9 agentes, arcos SVG animados, ranuras de GATES (Ciclo, Transversales, Todas) y estado reactivo.
- `GateCard.tsx`: Tarjeta interactiva estilo puerta con iluminación reactiva, responsable y estado (`PASSING`, `ACTIVE`, `BLOCKED`, `IDLE`).
- `GateInspectorDrawer.tsx`: Panel de inspección técnica de Gates con checklist de reglas inviolables y comandos CLI (`pnpm sdd:gate`).
- `AgentInspectorDrawer.tsx`: Panel lateral Split-View con perfil resumido del agente arriba y feed de diálogo en vivo abajo; selectores de spec/fix, filtro de fixes, badge de proveedor/sesión y acceso al visor de documentos. Selección sincronizada con el canvas.
- `DocumentViewerModal.tsx` + `lib/agent-documents.ts`: documentos SDD que produjo cada agente para una spec/fix, en un visor modal.
- `ChatDialogueCard.tsx`, `LiveSwarmComms.tsx` (burbujas y consola) y `swarm-dialogue.ts`: diálogos del enjambre. **Hoy salen de guiones ficticios por spec/fix con proveedores y sesiones inventados** (FIX-e-burgos-004-001); spec-e-burgos-005 los reemplaza por la conversación real.
- `LiveAgentChatFeed.tsx`: Feed de conversación en tiempo real con filtrado agéntico, indicador de streaming y entrada para respuestas rápidas.
- `EcosystemDashboard.tsx` + `SubprojectIcon.tsx`: Tablero de control de apps, libs, tools (genérico para cualquier repo), estado de módulos y semáforo del SPEC GATE.
- `LiveTelemetryHUD.tsx`: Monitor financiero con ticker de tokens, costos en USD (`sdd/pricing.json`) y métricas de `rtk`. Sin datos cae a un fallback con cifras de ejemplo, no reales.
- `lib/gates.ts` & `lib/agents.ts`: Modelos canónicos para las 6 GATES del kit SDD y los 9 agentes del enjambre con Clara como líder.

## 4. Comandos de Trabajo

- **Servidor de desarrollo:** `pnpm dev:studio` levanta el bridge real (`studio:bridge`, puerto 4330) y la web en 3100; solo la web: `pnpm --filter sdd-studio-web dev`.
- **Tests unitarios:** `pnpm --filter sdd-studio-web test` (vitest con jsdom; `vitest.setup.ts` reemplaza `URL.createObjectURL`/`revokeObjectURL`).
- **Verificación de tipos:** `pnpm --filter sdd-studio-web typecheck` (`tsc --noEmit`).
- **Pruebas End-to-End (Playwright):** `pnpm --filter sdd-studio-web e2e` (`e2e/start-bridge.mjs` hace `git init` en `.e2e-workspace` y crea `.claude/skills`; usar un `E2E_PORT` libre, p. ej. 4415).
- **Compilación para export estático:** `pnpm --filter sdd-studio-web build:local` (genera `out/`).
- **Deploy a Cloudflare Pages:** `pnpm --filter sdd-studio-web deploy` (Wrangler direct upload al proyecto `sdd-studio`).

## 5. Reglas Inviolables y Restricciones

1. **Arquitectura Zero-Credentials:** La aplicación web NUNCA debe almacenar ni enviar credenciales de Anthropic o de proveedores LLM. Todas las solicitudes viajan exclusivamente a la IP local `127.0.0.1` del bridge.
2. **Exportación Estática Obligatoria:** La aplicación web debe mantenerse compatible con `next export` (`output: 'export'`). No utilizar Server Components que dependan de runtime de servidor Node.js dinámico en runtime de producción.
3. **Consistencia de Protocolo:** Toda interfaz de datos consumida desde el bridge debe provenir de `@sdd-studio/protocol`. Prohibido definir esquemas paralelos ad-hoc en el frontend.
4. **Protocolo y `next dev`:** no operar el Studio de uso diario con `next dev` desde una rama que cambia el protocolo: el HMR carga el protocolo nuevo y rompe el handshake con el puente publicado.

## 6. Qué sigue

- spec-e-burgos-005: una conversación = una sesión del proveedor, sesión real visible en la web, enjambre centrado en la conversación, eliminación de guiones ficticios y selectores spec/fix (el visor de documentos se conserva).
- Disparar comandos del kit (`sdd:gate`, `validate`, `rtk`) desde los drawers vía `command.run`.
