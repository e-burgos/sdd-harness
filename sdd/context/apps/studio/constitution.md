# Constitución — apps/studio

> Versión 1.1 | Última actualización: cycle-01 (spec-e-burgos-001-studio-session-ux) | Fecha: 2026-10-23

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
- `WorkspaceApp.tsx` & `Workspace.tsx`: Contenedor principal con división en columnas (Sidebar, ChannelView / ThreadView, RightPanel).
- `Sidebar.tsx` (`SidebarView`): header y pie fijos con un único árbol con scroll entre ambos.
- `NavTree.tsx` (`SectionView`, `NavNodeView`, `ActiveThreads`): árbol colapsable con teclado y estado persistido. Secciones: HILOS ACTIVOS (waiting-approval primero, badge de pendientes, aviso de estado desactualizado sin conexión), CANALES (sistema; sin canales `spec:*`), SPECS (spec → ciclo → hilos, nodo "Sin ciclo"), FIXES (abiertos + 5 cerrados + "anteriores") y AGENTES (DMs con presencia). El caret colapsa; el nombre abre el canal.
- `ChannelView.tsx`: Vista del canal con flujo de hilos y actividad automatizada de bots.
- `Timeline.tsx`: Secuencia cronológica de mensajes, ejecuciones de subagentes y llamadas a herramientas (agrupadas con diffs desplegables).
- `Composer.tsx`: Input de texto con selector de modelo (`kit`, `haiku`, `sonnet`, `opus`, `fable`), effort y modo de permiso (`ask`, `acceptEdits`, `plan`). Borrador de texto por hilo (se pierde al recargar); botón Queue mientras la sesión trabaja y "Send pending" tras un interrupt.
- `PendingMessages.tsx`: bandeja "Pending messages" del hilo con editar/quitar; el mensaje entregado se rotula "Delivered as the next turn" cuando no entró en un punto de corte.
- `ThreadLinkPicker.tsx`: selector "Linked to" para reasignar el hilo a un ciclo o fix.
- `ActivityIndicator.tsx`: indicadores animados (running / waiting-approval / queued) en hilo, fila y avatar; estáticos con `prefers-reduced-motion`.
- `ApprovalCard.tsx`: Widget de decisión que aparece cuando un agente solicita ejecutar una herramienta protegida. Muestra el comando o diff exacto, advertencias del SPEC GATE y Aprobar / Denegar. "Always (thread)" muestra la regla que recordaría (herramienta, tool MCP o prefijo Bash) y se oculta cuando no es segura (aviso del gate o comando no calculable).
- `RightPanel.tsx`: Panel lateral con resumen del repo: estado del kit, specs en vuelo, avance de tareas del ciclo activo, métricas de tokens y costos acumulados en la sesión.

### 3.3 Gestión de Estado y Red (`src/lib/`)
- `bridge/client.ts`: Cliente WebSocket reactivo. Reconexión automática, cola de mensajes pendientes, promesas de petición-respuesta, despacho de `ServerEvent` al store y guarda de tamaño de frame (`FRAME_BUDGET_BYTES`). `error-text.ts` traduce los errores de versión de protocolo.
- `use-collapsed-state.ts`: colapso del árbol en `localStorage` (`sdd-studio.sidebar.v1:<project>`, overrides podados). `use-stick-to-bottom.ts`: auto-scroll con ResizeObserver (umbral 48 px). Los hooks viven en `src/lib/`, no en `src/hooks/`.
- `store/`:
  - `timeline.ts`: Hilos, deltas de streaming, tool calls en vuelo, aprobaciones pendientes, mensajes pendientes y reglas `remembered`.
  - `activity.ts`: Registra eventos generales del workspace y actividad de bots.
  - `state.ts`: Estado de conexión, snapshot (`WorkspaceSnapshot`), presencia, canal activo y slice `drafts` (`draftKey`/`setDraft`).
  - `selectors.ts`: Selectores memoizados (incluye `activeThreads`).
  - `nav-tree.ts`: `buildNavTree(snapshot, threads, view)` puro; los ids de nodo son las claves de colapso.

## 4. Comandos de Trabajo

- **Servidor de desarrollo:** `pnpm dev:studio` (o `pnpm --filter sdd-studio-web dev`, puerto 3100).
- **Tests unitarios:** `pnpm --filter sdd-studio-web test` (vitest con jsdom).
- **Verificación de tipos:** `pnpm --filter sdd-studio-web typecheck` (`tsc --noEmit`).
- **Pruebas End-to-End (Playwright):** `pnpm --filter sdd-studio-web e2e`.
- **Compilación para export estático:** `pnpm --filter sdd-studio-web build:local` (genera `out/`).
- **Deploy a Cloudflare Pages:** `pnpm --filter sdd-studio-web deploy` (Wrangler direct upload al proyecto `sdd-studio`).

## 5. Reglas Inviolables y Restricciones

1. **Arquitectura Zero-Credentials:** La aplicación web NUNCA debe almacenar ni enviar credenciales de Anthropic o de proveedores LLM. Todas las solicitudes viajan exclusivamente a la IP local `127.0.0.1` del bridge.
2. **Exportación Estática Obligatoria:** La aplicación web debe mantenerse compatible con `next export` (`output: 'export'`). No utilizar Server Components que dependan de runtime de servidor Node.js dinámico en runtime de producción.
3. **Consistencia de Protocolo:** Toda interfaz de datos consumida desde el bridge debe provenir de `@sdd-studio/protocol`. Prohibido definir esquemas paralelos ad-hoc en el frontend.
4. **Protocolo y `next dev`:** no operar el Studio de uso diario con `next dev` desde una rama que cambia el protocolo: el HMR carga el protocolo nuevo y rompe el handshake con el puente publicado.

## 6. Qué sigue

- spec-e-burgos-001 cycle-02: adjuntos en el Composer, menú `@` (archivos y agentes) y `/` (skills/prompts), borrador con adjuntos por hilo.
