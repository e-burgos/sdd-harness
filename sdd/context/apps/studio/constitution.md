# Constitución — apps/studio

> Versión 1.0 | Última actualización: 2026-10-23 (profundización de contexto)

## 1. Propósito y Alcance

- **Tipo:** app (Aplicación web frontend SPA / Static Export)
- **Paquete:** `sdd-studio-web`
- **Rol en el sistema:** Interfaz gráfica estilo Slack para operar y supervisar los agentes del kit SDD en tiempo real. Proporciona canales por spec (`#spec:...`), canal de fixes (`#fixes`), canal `#general` y mensajes directos (`dm:...`) con cada agente especializado. Permite interactuar con hilos de ejecución, ver el progreso de herramientas con diffs en vivo, conceder o denegar permisos de modificación de archivos mediante tarjetas de aprobación interactivas, y monitorizar el tablero global de specs, tareas y costos.
- **Topología de red:** Se ejecuta en el navegador (producción: `studio.sdd.estebanburgos.com.ar` desplegado en Cloudflare Pages, o servido localmente por el puente con `--local-ui`). Se conecta exclusivamente mediante WebSocket a `127.0.0.1` (el bridge local). La web app es completamente estática y agnóstica de credenciales: nunca maneja claves API en sus servidores.

## 2. Stack Tecnológico

- **Framework:** Next.js (App Router, versión 15 con static export `STUDIO_EXPORT=1`).
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
- `Sidebar.tsx`: Lista de canales organizados por: canales del sistema (`#general`, `#fixes`), canales de especificaciones activas (`#spec:...`) y DMs con agentes (`Orquestador`, `Funcional`, `Planner`, `Arquitecto`, `Implementadores`, `Reviewer`, `Steward`). Incluye avatares con estados de presencia en vivo.
- `ChannelView.tsx`: Vista del canal con flujo de hilos y actividad automatizada de bots.
- `Timeline.tsx`: Secuencia cronológica de mensajes, ejecuciones de subagentes y llamadas a herramientas (agrupadas con diffs desplegables).
- `Composer.tsx`: Input de texto para el desarrollador con selector dinámico de modelo (`kit`, `haiku`, `sonnet`, `opus`, `fable`), nivel de pensamiento/effort y modo de permiso (`ask`, `acceptEdits`, `plan`).
- `ApprovalCard.tsx`: Widget de decisión que aparece cuando un agente solicita ejecutar una herramienta protegida. Muestra el comando o diff de código exacto, advertencias del SPEC GATE y botones para Aprobar / Denegar (con opción de recordar para el hilo).
- `RightPanel.tsx`: Panel lateral con resumen del repo: estado del kit, specs en vuelo, avance de tareas del ciclo activo, métricas de tokens y costos acumulados en la sesión.

### 3.3 Gestión de Estado y Red (`src/lib/`)
- `bridge/client.ts`: Cliente WebSocket reactivo. Maneja reconexión automática, cola de mensajes pendientes, promesas asociadas a comandos de petición-respuesta y despacho de `ServerEvent` hacia el store.
- `store/`:
  - `timeline.ts`: Almacena hilos de mensajes, deltas de streaming, llamadas a herramientas en vuelo y aprobaciones pendientes.
  - `activity.ts`: Registra eventos generales del workspace y actividad de bots.
  - `state.ts`: Estado de conexión, snapshot del workspace (`WorkspaceSnapshot`), presencia y canal activo.
  - `selectors.ts`: Selectores memoizados para UI limpia.

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
