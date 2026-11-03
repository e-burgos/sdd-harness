# Constitución — apps/studio

> Versión 1.6 | Última actualización: consolida los fragmentos de spec-e-burgos-009 cycle-03..06 y spec-e-burgos-010 cycle-01 (tucu-ui 3.9.1, shell con riel de módulos) | Fecha: 2026-11-02

## 1. Propósito y Alcance

- **Tipo:** app (Aplicación web frontend SPA / Static Export)
- **Paquete:** `sdd-studio-web`
- **Rol en el sistema:** Interfaz gráfica estilo Slack para operar y supervisar los agentes del kit SDD en tiempo real. Proporciona canales por spec (`#spec:...`), canal de fixes (`#fixes`), canal `#general` y mensajes directos (`dm:...`) con cada agente especializado. Permite interactuar con hilos de ejecución, ver el progreso de herramientas con diffs en vivo, conceder o denegar permisos de modificación de archivos mediante tarjetas de aprobación interactivas, y monitorizar el tablero global de specs, tareas y costos.
- **Topología de red:** Se ejecuta en el navegador (producción: `studio.sdd.estebanburgos.com.ar` desplegado en Cloudflare Pages, o servido localmente por el puente con `--local-ui`). Se conecta exclusivamente mediante WebSocket a `127.0.0.1` (el bridge local). La web app es completamente estática y agnóstica de credenciales: nunca maneja claves API en sus servidores.

## 2. Stack Tecnológico

- **Framework:** Next.js 16 (`next` 16.4.3, App Router, static export con `STUDIO_EXPORT=1`).
- **Librería UI:** React 19, Tailwind CSS (PostCSS), `@e-burgos/tucu-ui` 3.9.1 (exacta, vía `@e-burgos/tucu-ui/next`; `Button`, `Input`/`Textarea`/`Checkbox`/`Radio`, `Select`, `Tooltip` (`lazy`), `Badge` (`size="micro"`), `Alert` (`density="compact"`), `Modal`/`SplitModal`, `BasicTable` (`density="snug"`), skeletons y tarjetas; sin wrappers propios salvo `HelpSelect` y `SegmentedControl`), `lucide-react` (iconografía única: sin emojis ni glifos decorativos; `GateIcon.tsx` mapea `gateId` a icono; los componentes nuevos usan solo lucide).
- **Tipografía y tema:** Inter y JetBrains Mono de `@e-burgos/tucu-ui/fonts`. `globals.css` importa `@e-burgos/tucu-ui/theme` (+ `@source` al paquete) y su `@theme inline` puentea `ink-*`, `accent-*`, `amberish`, `roseish`, `emerald-*`, `sky`, `purple`, `amber`, `rose` y `yellow` a variables mode-aware del tema (`--color-body`, `--color-light-dark`, `--color-secondary`, `--color-foreground`, `--color-muted`, `--color-brand`, `--color-success`, `--color-warning`, `--color-error`). Un color nuevo se pide al tema, no se hardcodea; no se usan `text-white`, `bg-white` ni `border-white`. Escala tipográfica única: `text-micro` 10 · `text-meta` 11 · `text-ui` 12 · `text-small` 13 · `text-copy` 14 · `text-title` 16 (sin `text-[Npx]`; `text-body` no existe porque tucu-ui define `--color-body` y generaba un color). `lib/typography-tokens.ts` registra la escala con `extendClassMergeTokens`, así que `cn` de tucu-ui no confunde `text-meta`/`text-ui` con colores. Las tablas fijan su densidad con `--tucu-table-cell-px/-py/-font-size/-header-font-size` en `:root`.
- **Estado Global:** `zustand` estructurado en slices modulares (`activity`, `timeline`, `state`, `selectors`).
- **Contrato de Red:** `@sdd-studio/protocol` y `zod`.
- **Renderizado Markdown:** `react-markdown` y `remark-gfm` con soporte para syntax highlighting, diffs y badges de herramientas.
- **Testing:**
  - `vitest` + `@testing-library/react` + `jsdom` para componentes unitarios y stores.
  - `playwright` (`playwright.config.ts`) para tests E2E levantando el bridge en modo `--engine fake --local-ui`.

## 3. Arquitectura y Componentes Clave

### 3.1 Rutas y Conexión (`src/app/`)
- `layout.tsx`: Layout raíz; `<ThemeModeScript defaultMode="system" />` en el `<head>` fija el modo inicial antes de hidratar. `components/StudioThemeProvider.tsx` (cliente) monta `NextThemeProvider layout="clean"` con `defaultMode="system"` y carga `lib/typography-tokens`. Modo claro y oscuro persistido en el store de tucu-ui.
- `page.tsx`: Redirección hacia `/w` (workspace).
- `w/page.tsx`: Pantalla principal que procesa el hash `#bridge=...&token=...` y monta `WorkspaceApp` → `AppShell` → `StudioShell`.
- `BridgeProvider.tsx`: Contexto de React que gestiona el ciclo de vida de la conexión WebSocket con `client.ts` (`connected`, `connecting`, `disconnected`, `error`).
- `ConnectScreen.tsx`: Pantalla de bienvenida y emparejamiento cuando no hay conexión activa con el puente local.

### 3.2 Shell y módulos (`src/components/shell/`, `src/components/modules/`)
- `shell/StudioShell.tsx`: shell estilo Slack anclado al viewport (sin scroll del documento): `ModuleRail` (riel de módulos personalizable con `RailCustomizeMenu`: Inicio, Specs, Fixes, Agentes, Actividad, Mapa, Kit, Arquitectura, Métricas, Más), `ModulePanel` (panel de lista por módulo con `PanelGroup`/`PanelRow`/`SectionListPanel`/`SidebarSearch`), contenido central y `RightPanelFrame`, que solo existe en Inicio, Specs, Fixes, Agentes y Mapa. `PanelRail` + `lib/use-panel-state.ts` colapsan paneles (preferencia en `localStorage`); `ModuleBoundary` aísla errores por módulo; `use-viewport-tier.ts` adapta el layout. `NewConversationIconButton` deja un borrador vacío seleccionado; el hilo nace con el primer `thread.create`.
- `components/{AppShell,WorkspaceApp}.tsx` y `ErrorBoundary.tsx`: raíz del workspace y boundary de nivel superior con fallback i18n.
- `modules/{home,specs,fixes,agents,activity,map,kit,architecture,metrics}` con su i18n en `lib/i18n/modules/*`. Inicio: #general, #specs y #fixes con resumen. Specs: ficha con pestañas. Mapa: nodos del enjambre y `AgentInspectorDrawer` embebido, con chat directo en tarjeta flotante. Kit: prender/apagar rtk y el mod y cambiar el modo del gate con confirmación y `expectedRevision`.
- `lib/nav/*`: navegación y riel persistidos por proyecto (`sdd-studio.nav.v1:<project>`, `sdd-studio.rail.v1:<project>`). `lib/sdd-status.ts`: estados de specs, ciclos y fixes compartidos por Inicio, Specs, Fixes y la conversación.

### 3.2b Componentes del Workspace (`src/components/workspace/`)
- `AuthPanel.tsx` + `ApiKeyField.tsx` (cuerpo de la solapa API key): tablist accesible Suscripción / API key; la solapa elegida se aplica al bridge y se recuerda en `localStorage` (`sdd-studio.authPreference`). `lib/use-subscription.ts` (polling de `auth.status` cada 2 s mientras hay login pendiente), `lib/auth-preference.ts`, `lib/usage-limit.ts` (`Timeline` sugiere cambiar de cuenta ante el límite de uso). `BridgeProvider` expone `authPreference` y `setAuthPreference`.
- `ThreadView.tsx` + `Timeline.tsx`: Secuencia cronológica de mensajes, ejecuciones de subagentes y llamadas a herramientas (agrupadas con diffs desplegables); subtítulo `{role} · {title}` bajo el nombre del agente.
- `AgentFace.tsx` + `AgentAvatar.tsx`: caras SVG dibujadas por agente (9 del enjambre + `user`), con indicador de presencia y halo; el rol se muestra bajo el nombre en Timeline, paneles y nodos del mapa.
- `Composer.tsx`: Input con selector de modelo (`kit`, `haiku`, `sonnet`, `opus`, `fable`), effort y modo de permiso (`ask`, `acceptEdits`, `plan`); altura acotada a 200 px con scroll interno y atajos visibles. Borrador por hilo con adjuntos (solo en memoria); botón Queue mientras la sesión trabaja y "Send pending" tras un interrupt. Adjuntos: elegir, pegar o arrastrar (máx. 5, preview con quitar).
- `AttachmentTray` (COMP-007), `AttachmentView` (COMP-008, reserva caja por width/height, marcador «Adjunto no disponible») y `MentionMenu` (COMP-009, ARIA combobox/listbox). Menú `@` (agentes primero, luego archivos) y `/` (comandos + skills/prompts); Enter/Tab eligen, un comando escrito completo se envía con un solo Enter, Esc cierra. Sin `file-search` ni `catalog` en `Welcome.features` no se abre ningún menú.
- `PendingMessages.tsx`: bandeja "Pending messages" del hilo con editar/quitar; el mensaje entregado se rotula "Delivered as the next turn" cuando no entró en un punto de corte.
- `ThreadLinkPicker.tsx`: con `link-targets` es una lista de chips con origen, estado «no disponible» y quitar, más un selector para agregar spec, ciclo o fix aún no asociados (`thread.updateLinks`); sin `link-targets` conserva el selector único con `thread.setLink`. Sin asociaciones, muestra la detectada por menciones de la web en solo lectura hasta que el puente persista alguna.
- `QuestionForm.tsx`: formulario de las preguntas del proveedor dentro del chat (ítem `question` de `timeline.ts`; `question.answer`; `bootstrap` pide `includeQuestions` solo con la feature `questions`).
- `ContextMeter.tsx` + `lib/context-meter.ts`: contexto restante en la cabecera de la conversación (`CONTEXT_WARN_PERCENT` 70, `CONTEXT_CRITICAL_PERCENT` 90; feature `context-usage`).
- `ModeSelectors.tsx` + `lib/flow-choice.ts`: elección de modo de desarrollo (`solo`/`team`, `profile-set`) y de implementación (`automática`/`lite`/`full`) antes de arrancar una spec; `applyFlowChoice` antepone `[LITE]`/`[FULL]` y `fullExceptionOf` avisa si la spec tiene `depends_on` en cualquier sentido.
- `PreparedConversations.tsx` + `lib/auto-conversation.ts` (`prepareFromBotEvent`, `briefingFor`): conversación nueva preparada y asociada por cada spec, ciclo o fix creado (`StudioState.prepared`, `openPrepared`/`dismissPrepared`); no se envía sola y el `Composer` asocia el hilo solo si el texto conserva el encabezado del briefing.
- `lib/use-bridge-features.ts` + `mission-control/CapabilityNotice.tsx`: `supports` sobre `client.supports` y aviso no bloqueante de capacidades que el puente no anuncia (`session-title`, `link-targets`, `document-touched`, `questions`, `context-usage`, `profile-set`); claves `caps.*` en i18n. Un puente anterior sigue funcionando.
- `ActivityIndicator.tsx`: indicadores animados (running / waiting-approval / queued) en hilo, fila y avatar; estáticos con `prefers-reduced-motion`.
- `ApprovalCard.tsx`: Widget de decisión que aparece cuando un agente solicita ejecutar una herramienta protegida. Muestra el comando o diff exacto (argumentos largos colapsables), advertencias del SPEC GATE y Aprobar / Denegar. "Always (thread)" muestra la regla que recordaría (herramienta, tool MCP o prefijo Bash) y se oculta cuando no es segura (aviso del gate o comando no calculable).

### 3.3 Gestión de Estado y Red (`src/lib/`)
- `bridge/client.ts`: Cliente WebSocket reactivo. Reconexión automática, cola de mensajes pendientes, promesas de petición-respuesta, despacho de `ServerEvent` al store y guarda de tamaño de frame (`FRAME_BUDGET_BYTES`). `error-text.ts` traduce los errores de versión de protocolo.
- `attachments/`: `classify.ts` (mime + magic bytes, texto UTF-8 estricto), `encode-image.ts` (re-encode SIEMPRE a ≤1568 px sin EXIF; PNG→webp con fallback png; si el re-encode falla la imagen se rechaza), `frame-budget.ts` (`commandFrameBytes` + escalera de recompresión hasta `FRAME_BUDGET_BYTES`), `build-draft.ts`, `draft-attachment.ts`, `bytes.ts`.
- Hooks: `use-attachment-draft.ts`, `use-attachment-content.ts` (caché LRU de object URLs por sha256, verificación de hash; `primeAttachmentContent` best-effort), `use-mention-menu.ts` (debounce 120 ms con descarte por secuencia, grupos files/agents/commands/skills). `mention.ts` detecta el trigger activo; `composer-refs.ts` extrae refs `@agente`/`/skill` (`FIXED_COMMANDS`).
- `use-collapsed-state.ts`: colapso de secciones en `localStorage` con overrides podados. `use-stick-to-bottom.ts`: auto-scroll con ResizeObserver (umbral 48 px). Los hooks viven en `src/lib/`, no en `src/hooks/`.
- `store/`:
  - `timeline.ts`: Hilos, deltas de streaming, tool calls en vuelo, aprobaciones pendientes, mensajes pendientes y reglas `remembered`.
  - `activity.ts`: Registra eventos generales del workspace y actividad de bots.
  - `state.ts`: Estado de conexión, snapshot (`WorkspaceSnapshot`), presencia, canal activo, dedupe de eventos de bot consecutivos idénticos, `sameInfo` (compara `engineSessionId` y `provider`) y slice `drafts` (`ComposerDraft = { text, attachments }` por `threadId` o `new:<channel>`; revoca las object URLs de adjuntos quitados).
  - `selectors.ts`: Selectores memoizados (incluye `activeThreads`).

### 3.4 Mission Control, Topología de Agentes y Gates (`src/components/mission-control/`)
- `StudioHeader.tsx`: Cabecera global con selector de idioma, botón Sol/Luna (`data-testid="mode-toggle"`) y el chip de gate (lee `snapshot.tools?.gate ?? snapshot.gateMode`); la navegación entre vistas vive en el riel de módulos. El chip refleja la conversación seleccionada (`lib/conversation-gate.ts`: `deriveConversationGate` puro → `spec | fix | idle`; gana lo más reciente por `seq` entre el último documento escrito y la última mención de un fix, o el ciclo `in-progress` de una spec relacionada) y es un `button` que abre `GateStatusModal` (conversación, gate, spec/ciclo/fix activos, tasks, fixes, agentes participantes, último evento). La conversación elegida vive en `selectedThreadId` del store (`selectThread`, `lib/use-selected-conversation.ts`), sin tocar el protocolo.
- `AgentMapCanvas.tsx`: Lienzo 2D SVG responsivo que visualiza el enjambre de 9 agentes, arcos SVG animados, ranuras de GATES (Ciclo, Transversales, Todas) y estado reactivo.
- `GateCard.tsx`: Tarjeta interactiva estilo puerta con iluminación reactiva, responsable y estado (`PASSING`, `ACTIVE`, `BLOCKED`, `IDLE`).
- `GateInspectorDrawer.tsx`: Panel de inspección técnica de Gates con checklist de reglas inviolables y comandos CLI (`pnpm sdd:gate`).
- El Mapa gira alrededor de la conversación (hilo) elegida (por defecto la de `lastActivity` más reciente; el chat directo envía con `thread.send` dirigido al agente). Agentes, diálogos y specs/fixes relacionados se derivan de los eventos de ese hilo; los nodos sin participación se atenúan, no se ocultan. No existen guiones ni datos ficticios (`lib/no-fabricated-data.spec.ts` busca en fuente `session-`, guiones, Gemini/Copilot fijos y spec por defecto fija).
- `ConversationSessionInfo.tsx`: título real de la sesión del proveedor (`sessionTitle`; tres estados: título, «sin título disponible», aviso de puente desactualizado), id de sesión completo con botón copiar (es el de `claude --resume <id>`) y proveedor; `engineSessionId`/`provider` `undefined` = bridge desactualizado (aviso de reinicio), `null` = "Sin sesión todavía".
- `RelatedDocuments.tsx`: agrupa spec → ciclo → archivo y fix → documento con contador por grupo, operación y fuente del documento; `min-w-0`/`truncate` + `title` completo. Las menciones textuales de spec/fix alimentan solo `mentions` y el gate, no crean entradas. `RightPanelFrame` y los paneles de módulo muestran «Dónde estás», documentos generados y últimas acciones del enjambre.
- Documentos de la conversación (`lib/conversation.ts`): `ThreadState.touched` (`{ seq, path, op, author }`, poblado por `document.touched`, fuera de `items`) manda desde `cutoffSeq` (menor `seq` de `touched`); antes del corte rige la heurística (`relatedDocuments(thread, snapshot, beforeSeq)`), que acepta Write/Edit/MultiEdit y Bash vía `lib/conversation-bash-paths.ts` (helper puro best effort: destinos bajo `sdd/specs/**` y `sdd/fixes*/**` de redirecciones, `tee`, `sed -i`, `cp`/`mv`, `cd`; lo truncado o generado por scripts no se inventa). Una ruta en ambos tramos se fusiona (`agents` unión, `op` y orden del último toque). `ConversationDocument.cycle/op?`, `RelatedSpec.cycles[]`, `ConversationView.documentSource` (`structured | heuristic | mixed`) y `sessionTitle`; un hilo sin toques usa solo la heurística.
- `lib/link-targets.ts` (puro): `linkEntriesOf` (con puente viejo deriva una entrada de `link.target`), `isLinkEntryAvailable`, `linkRefLabel`, `linkRefKey`, `toLinkRef`. Los módulos Specs y Fixes cuelgan cada hilo de sus asociaciones (`cycle`, `fix`, «Sin ciclo» para `spec`).
- `lib/conversation.ts` (puro): `listConversations`, `resolveSelectedThreadId`, `deriveConversation`, `inferGateFromText`, `providerLabel`, `documentsOfAgent`; `DOCUMENT_TOOLS` = Write/Edit/MultiEdit (sin `Read`); `ConversationDocument.agents: string[]` es el autor del tool call (`item.author.agent`; subagentes con su `subagent_type`). `lib/use-conversation-selection.ts` sincroniza el hilo elegido con `openThread`.
- Envoltorios sobre tucu-ui: `HelpSelect` (composición fina: `Select` con `appearance="neutral"`, `menuWidth="content"`, `wrapDescription`, `maxMenuHeight`, `triggerLabel`, opciones con `icon`/`description`, `searchable`, ícono de ayuda con `Tooltip` y descripción sr-only; `no-native-select.spec.ts` exige cero `<select>`) y `SegmentedControl` (propio: el de tucu-ui solo tiene semántica de radio, sin tabs ni nav). `Tip` y `StatusPill` ya no existen: se usan `Tooltip` y `Badge` directo. `lib/test-utils/pick-option.ts` maneja el combobox de tucu-ui en los specs y `vitest.setup.ts` stubea `scrollIntoView`.
- Excepciones nativas a propósito: `<button>` estructurales y colapsables (paneles del shell, RelatedDocuments, Timeline, ApprovalCard, tabs, filas de listas, chips de gate/agente), el `<input type=file>` del Composer, el `role="status"` de reconexión, `ActivityIndicator` y los `title` de texto truncado.
- `AgentInspectorDrawer.tsx`: Panel Split-View (embebido en el Mapa) con perfil del agente arriba y feed de diálogo en vivo abajo; la pestaña de agente muestra solo sus documentos (vacío: `mc.related.agentEmpty`) en una tarjeta contraíble persistida con `use-collapsed-state`; badge de proveedor/sesión. Selección sincronizada con el canvas.
- `DocumentViewerModal.tsx` + `lib/agent-documents.ts`: documentos SDD de la conversación en un `SplitModal` (contenido en el cuerpo; ruta, vista renderizado/fuente, "otros documentos" para navegar sin cerrar y copiar contenido/ruta en la barra lateral). `GateStatusModal` también usa `SplitModal` (Conversación, Gate, Tareas, Fixes, Agentes, Último evento); ambos siempre montados con `isOpen`.
- `ChatDialogueCard.tsx` y `LiveSwarmComms.tsx` (burbujas y consola): diálogos reales sobre `ConversationDialogue`.
- `LiveAgentChatFeed.tsx`: Feed de conversación en tiempo real con filtrado agéntico, indicador de streaming y entrada para respuestas rápidas.
- `EcosystemDashboard.tsx` + `SubprojectIcon.tsx`: Tablero de control de apps, libs, tools (genérico para cualquier repo), estado de módulos y semáforo del SPEC GATE.
- `LiveTelemetryHUD.tsx`: Monitor financiero con ticker de tokens, costos en USD (`sdd/pricing.json`) y métricas de `rtk`. Sin telemetría dice "Sin telemetría todavía" (sin cifras de relleno).
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
5. **E2E fuera de la verificación fuerte:** `pnpm build && pnpm typecheck && pnpm test` no corre Playwright. Si un cambio toca textos, personas o flujos de la UI, correr también `pnpm --filter sdd-studio-web e2e`.
6. **Selectores Playwright exactos:** usar `exact: true` en `getByRole(..., { name })`. Sin él, el nombre matchea por substring y toma controles cuyo `aria-label` contiene el mismo texto (p. ej. el caret de un canal).

7. **tailwind-merge y tokens de fuente custom:** la escala está registrada en `lib/typography-tokens.ts` (importarlo antes de usar `cn` de tucu-ui); un token nuevo de tamaño no puede coincidir con el nombre de un color del tema (por eso `text-copy`, no `text-body`).
8. **Overrides sobre tucu-ui:** preferir las props del componente a utilidades `!`; `globals.css` ya no tiene reglas `[data-tucu='button']`, de select ni de tabla (solo los tokens `--tucu-table-*`). El layout (`ml-auto`, `absolute`) va en un wrapper propio porque `Button` envuelve en un `<div>`.
9. **i18n:** `lib/i18n/i18n.tsx` sincroniza el idioma de tucu-ui con `useTheme.setState({ lang: resolveTucuLang(lang) })`; los textos de interfaz pasan por el i18n es/en.
10. **vitest con tucu-ui:** desde 3.5.0 no hace falta `server.deps.inline`; `vitest.setup.ts` stubea `scrollIntoView` y `URL.createObjectURL`.
11. **El e2e sirve una copia:** usa `apps/studio-bridge/dist/web`, copia de `apps/studio/out` que solo se refresca con `pnpm --filter sdd-studio build`. Para probar UI nueva: `build:local` → build del bridge → `e2e`, en ese orden.
12. **Convivencia con puentes anteriores:** cada capacidad nueva se activa con su feature; lo que el puente no anuncia se degrada con aviso no bloqueante, nunca con datos vacíos. `next.config.ts` fija `devIndicators: { position: 'bottom-right' }`.

## 6. Qué sigue

- Tres colores de identidad de agentes (`#e2e8f0`, `#a1a1aa`, `#94a3b8`) quedan pálidos como texto en modo claro.
- Hilos anteriores activos con un puente nuevo quedan en época mixta (heurística hasta el primer toque, `document.touched` después); un `Write` denegado por el gate sigue listado por la heurística en hilos sin toques. Renombrar sesiones desde la web y otros proveedores siguen fuera de alcance.
- La conversación preparada no se envía sola. El aviso de excepción a full solo cubre `depends_on`; los contratos entre subproyectos no se detectan desde la web.
- Spike de cache real con credenciales sin correr. Probar a mano el login real contra claude.ai.
- Operativo: tras cambios en `toThreadInfo` del bridge, reiniciar el bridge o la UI muestra el aviso de desactualizado.
- Disparar comandos del kit (`sdd:gate`, `validate`, `rtk`) desde los drawers vía `command.run`.
- Refrescar el contenido de skills con `workspace.changed`; Arquitectura relee más de lo necesario.
- Actividad sin conversaciones; horas aproximadas de aprobaciones y preguntas.
- Vista diff del visor de documentos: requiere soporte del puente (no hay fuente de datos de diff).
