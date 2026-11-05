# Planner — Cycle 1: studio-project-wizard

> **Input:** functional.md, brief.yaml y architect.md de este ciclo (el architect manda: sus desvíos X-1 a X-9 corrigen al funcional)
> **Output:** sdd/specs/spec-e-burgos-013-studio-project-wizard/cycles/cycle-01/planner.md
> **Generado por:** sdd-planner (claude/sonnet, effort medium)

## Sprint Plan — Ciclo 1 — studio-project-wizard

**Duración estimada:** 1 semana (flujo secuencial por capas; varias tasks son paralelizables entre CLI, protocolo y Studio puro)
**Story points totales:** 117
**Tasks:** 23 · **Horas estimadas:** 156

Las tareas se corren con `pnpm --filter <paquete> <script>` o `pnpm build|test|typecheck` (este repo no es Nx). Código sin comentarios.

## Camino crítico

TASK-001 → TASK-002 → TASK-003 → TASK-006 → TASK-009 → TASK-010 → TASK-011 → TASK-019 → TASK-023.
En paralelo: protocolo (TASK-004) y la lógica pura de Studio (TASK-012, TASK-013) no esperan a la CLI; TASK-007 y TASK-008 corren en paralelo tras TASK-005.

---

## Tasks CLI

### TASK-001: Refactor sin cambio de comportamiento: opciones movidas, patrones con nombre y topología estructurada

**Historias:** US-5-001, US-5-002
**App:** apps/cli
**Descripción:** Mover APP_TYPE_OPTIONS, SERVICE_OPTIONS y DEFAULT_APP_NAMES a config/app-options.ts (init.ts los importa). Exportar KEBAB_NAME_PATTERN, PACKAGE_SCOPE_PATTERN, AUTHOR_PATTERN y PORT_RANGE desde config/schema.ts. Crear collectAppTopologyIssues() estructurado en app-types.ts y dejar validateAppTopology como envoltorio con los mismos mensajes. Exportar TOLERATED_ENTRIES en workspace.generator.ts.
**Estimación:** 6h · **Story points:** 5
**Dependencias:** ninguna
**Archivos:**
- `apps/cli/src/config/app-options.ts`
- `apps/cli/src/config/schema.ts`
- `apps/cli/src/generators/app-types.ts`
- `apps/cli/src/generators/workspace.generator.ts`
- `apps/cli/src/commands/init.ts`
- `apps/cli/src/generators/__tests__/app-types.spec.ts`
**Criterio de done:**
- [ ] Snapshot de mensajes de validateAppTopology idéntico al previo
- [ ] `pnpm --filter @e-burgos/sdd-harness test` y typecheck verdes sin tocar los tests existentes
- [ ] `harness init` sigue idéntico (sin diff en la generación de ejemplo)

### TASK-002: Subcomando harness config catalog: opciones, flags, patrones, puertos y tolerated

**Historias:** US-5-001, US-1-020, US-1-032, US-1-033, US-1-050, US-2-003
**App:** apps/cli
**Descripción:** Implementar buildConfigCatalog() según el contrato ConfigCatalog del architect (D-04): tipos de app por familia y modo, flags por tipo, patrones regex, rango de puertos, entradas tolerated del directorio destino y versión de la CLI. Sin conocimiento de Studio.
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-001
**Archivos:**
- `apps/cli/src/config/catalog.ts`
- `apps/cli/src/config/__tests__/catalog.spec.ts`
**Criterio de done:**
- [ ] El catálogo cubre todos los tipos de app de init.ts (test de cobertura contra APP_TYPE_OPTIONS)
- [ ] Los patrones y el rango de puertos salen de las constantes exportadas en TASK-001
- [ ] Tests de config/catalog verdes

### TASK-003: Subcomando harness config validate con topología estructurada, precondiciones y vista previa resuelta

**Historias:** US-5-001, US-5-003, US-5-004, US-1-034, US-1-035, US-1-051, US-1-052, US-1-053, US-1-054, US-1-055, US-1-056, US-1-057, US-2-001, US-2-002, US-2-003
**App:** apps/cli
**Descripción:** Implementar validateConfig() (schema, topología con collectAppTopologyIssues, precondiciones de init, warnings, resolved) y registrar `config catalog [--json]` y `config validate <file|-> [--json]` con exit 0/1/2 (architect, CLI — subcomandos nuevos). Lectura por stdin con tope MAX_CONFIG_BYTES.
**Estimación:** 8h · **Story points:** 8
**Dependencias:** TASK-001, TASK-002
**Archivos:**
- `apps/cli/src/config/validate.ts`
- `apps/cli/src/commands/config/index.ts`
- `apps/cli/src/config/__tests__/validate.spec.ts`
- `apps/cli/src/commands/config/__tests__/config.command.spec.ts`
**Criterio de done:**
- [ ] Exit 0 sin errores, 1 con errores, 2 ilegible o uso inválido, verificado por tests del comando
- [ ] Los issues llevan code, step y field; los códigos sin traducción llevan texto en inglés
- [ ] La CLI no importa @sdd-studio/protocol
- [ ] Tests de config/validate y commands/config verdes; build de la CLI verde

## Tasks Protocolo

### TASK-004: Tipos, comandos, eventos, handshake y límites del wizard (PROTOCOL_VERSION 2)

**Historias:** US-1-001, US-3-011, US-3-012, US-3-013, US-4-005, US-5-001
**App:** libs/studio-protocol
**Descripción:** Crear wizard.ts con todos los tipos de «Contratos» del architect (ConfigCatalog, ConfigValidation, TargetCheck, GenerationState, etc.); unir los comandos nuevos a ClientCommand y los 3 eventos a ServerEvent; hacer workspace nullable en el handshake; agregar features, MAX_CONFIG_BYTES, GENERATION_CHUNK_MAX, GENERATION_BUFFER_BYTES, MAX_DIR_ENTRIES y WS_CLOSE_WORKSPACE_SWITCHED; subir PROTOCOL_VERSION a 2 de forma aditiva.
**Estimación:** 6h · **Story points:** 5
**Dependencias:** ninguna
**Archivos:**
- `libs/studio-protocol/src/wizard.ts`
- `libs/studio-protocol/src/commands.ts`
- `libs/studio-protocol/src/events.ts`
- `libs/studio-protocol/src/handshake.ts`
- `libs/studio-protocol/src/limits.ts`
- `libs/studio-protocol/src/index.ts`
- `libs/studio-protocol/src/__tests__/wizard.spec.ts`
**Criterio de done:**
- [ ] Specs de parseo válido e inválido por cada comando y evento nuevo
- [ ] El Welcome acepta workspace null y el anterior sigue parseando
- [ ] `pnpm --filter @sdd-studio/protocol test` y typecheck verdes; los consumidores (bridge y studio) siguen compilando

## Tasks Puente

### TASK-005: Refactor host/runtime, modo launcher sin sdd/ y cierre 4010

**Historias:** US-1-001, US-4-005, US-4-010
**App:** apps/studio-bridge
**Descripción:** Extraer el cableado de proyecto a project/runtime.ts y crear BridgeHost en main.ts; sin sdd/ en --root arrancar en launcher (welcome.workspace null) en lugar de BridgeStartError; despacho host/runtime en el router; closeAll(4010) en ws-server; flag --allow-target en cli-options y mensaje de launcher. BridgeStartError queda para puerto ocupado y UI local ausente.
**Estimación:** 8h · **Story points:** 8
**Dependencias:** TASK-004
**Archivos:**
- `apps/studio-bridge/src/main.ts`
- `apps/studio-bridge/src/project/runtime.ts`
- `apps/studio-bridge/src/server/router.ts`
- `apps/studio-bridge/src/server/ws-server.ts`
- `apps/studio-bridge/src/cli.ts`
- `apps/studio-bridge/src/cli-options.ts`
**Criterio de done:**
- [ ] Todos los tests existentes del puente siguen verdes sin modificarlos
- [ ] Test de launcher: arranca sin sdd/, handshake con workspace null, comandos de proyecto responden not-found o bad-request
- [ ] close() idempotente y sin handles abiertos (test de R-5)
- [ ] typecheck y build del puente verdes

### TASK-006: Localizador y entorno de la CLI fijada, config-cli y test de contrato contra la CLI real

**Historias:** US-5-001, US-5-002, US-5-007, US-1-032, US-1-034
**App:** apps/studio-bridge
**Descripción:** Agregar @e-burgos/sdd-harness workspace:* al puente; resolver el binario del paquete instalado (opción harnessCli solo para tests); construir el env saneado (sin credenciales, NX_DAEMON=false); wrappers de `config catalog --json` y `config validate - --json` por spawn sin shell. Crear fake-harness.mjs para los tests.
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-003, TASK-005
**Archivos:**
- `apps/studio-bridge/package.json`
- `apps/studio-bridge/src/wizard/cli-locator.ts`
- `apps/studio-bridge/src/wizard/cli-env.ts`
- `apps/studio-bridge/src/wizard/config-cli.ts`
- `apps/studio-bridge/src/wizard/__tests__/config-cli.contract.spec.ts`
- `apps/studio-bridge/src/test-utils/fake-harness.mjs`
**Criterio de done:**
- [ ] Test de contrato: la salida de la CLI compilada parsea con los schemas zod de @sdd-studio/protocol (catálogo y validación)
- [ ] El env pasado al hijo no incluye variables de credenciales (test)
- [ ] Spawn sin shell, con timeout y tope de salida
- [ ] Tests del puente verdes; el bundle esbuild no incluye la CLI

### TASK-007: Destino seguro: target.ts, dirs.ts y wizard.checkTarget / wizard.listDirs

**Historias:** US-3-001, US-3-002, US-3-003, US-3-004, US-3-005, US-3-006, US-3-007, US-3-008, US-3-009, US-3-010, US-3-041
**App:** apps/studio-bridge
**Descripción:** Implementar validación del destino con realpath, bases permitidas (home y --allow-target), estados de TargetCheck (vacía, inexistente, tolerada con confirmación, bloqueada), fingerprint para re-chequear al generar, insideProject solo en modo proyecto, nombres reservados y rutas de Windows. dirs.ts: listado de directorios con tope MAX_DIR_ENTRIES.
**Estimación:** 8h · **Story points:** 5
**Dependencias:** TASK-005
**Archivos:**
- `apps/studio-bridge/src/wizard/target.ts`
- `apps/studio-bridge/src/wizard/dirs.ts`
- `apps/studio-bridge/src/wizard/__tests__/target.spec.ts`
- `apps/studio-bridge/src/wizard/__tests__/dirs.spec.ts`
**Criterio de done:**
- [ ] Tests parametrizados por plataforma (POSIX y win32) de target.ts
- [ ] Fuera de las bases permitidas se rechaza con bad-path; symlinks y .. se resuelven por realpath
- [ ] Contenido no tolerado (incluido sdd/) bloquea; harness.config.json idéntico continúa, distinto bloquea (X-2, X-7)
- [ ] Tests del puente verdes

### TASK-008: Preflight de pnpm y registry, y reveal en el explorador

**Historias:** US-3-014, US-3-015, US-3-031, US-3-037
**App:** apps/studio-bridge
**Descripción:** wizard.preflight verifica pnpm (pnpm.cmd en Windows, strings constantes) y alcance del registry; informa git opcional. wizard.reveal reutiliza openCommand con la ruta validada.
**Estimación:** 4h · **Story points:** 3
**Dependencias:** TASK-005
**Archivos:**
- `apps/studio-bridge/src/wizard/preflight.ts`
- `apps/studio-bridge/src/wizard/reveal.ts`
- `apps/studio-bridge/src/wizard/__tests__/preflight.spec.ts`
**Criterio de done:**
- [ ] Preflight bloqueante con pnpm ausente (test con binario falso)
- [ ] Registry inalcanzable produce aviso accionable, no excepción
- [ ] reveal solo acepta rutas dentro de las bases permitidas
- [ ] Tests del puente verdes

### TASK-009: Generación: generation.ts, clasificador init-output y fixtures grabados

**Historias:** US-3-011, US-3-012, US-3-013, US-3-017, US-3-018, US-3-019, US-3-030, US-3-033, US-3-036, US-5-007
**App:** apps/studio-bridge
**Descripción:** Escribir harness.config.json en el destino y lanzar `node <bin> init --config harness.config.json --here -y` con cwd en el destino, sin shell y en grupo de procesos; clasificar etapas (instalando, generar, validar SDD, lint test build) desde la salida real con fixtures grabados con la versión fijada (X-1, R-1); emitir eventos generation.* con seq, chunks acotados y ring buffer de 4 MiB.
**Estimación:** 8h · **Story points:** 8
**Dependencias:** TASK-006, TASK-007, TASK-008
**Archivos:**
- `apps/studio-bridge/src/wizard/generation.ts`
- `apps/studio-bridge/src/wizard/init-output.ts`
- `apps/studio-bridge/src/wizard/__fixtures__/init-output/`
- `apps/studio-bridge/src/wizard/__tests__/generation.spec.ts`
- `apps/studio-bridge/src/wizard/__tests__/init-output.spec.ts`
**Criterio de done:**
- [ ] Fixtures grabados con la CLI real fijada y clasificador cubierto por tests
- [ ] Éxito, gate en rojo («Generado con errores») y fallo previo cubiertos con fake-harness
- [ ] El config del destino se conserva tras generar (H-3)
- [ ] Tests del puente verdes

### TASK-010: Cancelación, registry de generaciones, wizard.generation.get y servicio del wizard en el router

**Historias:** US-3-016, US-3-032, US-3-034, US-3-035, US-3-038, US-3-040, US-3-042
**App:** apps/studio-bridge
**Descripción:** Cancelar matando el grupo de procesos (taskkill /T en Windows); estado de la activa y la última en memoria del BridgeHost; wizard.generation.get para resincronizar con seq; detección de interrupted y not-found tras reinicio; cableado de todos los comandos wizard.* en service.ts y el router.
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-009
**Archivos:**
- `apps/studio-bridge/src/wizard/generation.ts`
- `apps/studio-bridge/src/wizard/service.ts`
- `apps/studio-bridge/src/server/router.ts`
- `apps/studio-bridge/src/wizard/__tests__/service.spec.ts`
**Criterio de done:**
- [ ] Cancelación deja la generación en estado cancelled sin procesos huérfanos (test con fake-harness)
- [ ] Una sola generación activa: la segunda se rechaza con conflict
- [ ] generation.get devuelve el estado y los chunks desde un seq dado
- [ ] Tests del puente verdes

### TASK-011: workspace.open con cambio de proyecto en caliente y evento workspace.switched

**Historias:** US-4-001, US-4-005, US-4-009, US-4-010, US-4-011
**App:** apps/studio-bridge
**Descripción:** workspace.open { generationId } valida que la generación terminó con sdd/, emite workspace.switched, cierra con 4010, cierra el runtime anterior y levanta el nuevo en el mismo proceso con el mismo token. En modo proyecto rechaza si hay agentes trabajando (X-9).
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-010
**Archivos:**
- `apps/studio-bridge/src/main.ts`
- `apps/studio-bridge/src/wizard/service.ts`
- `apps/studio-bridge/src/server/ws-server.ts`
- `apps/studio-bridge/src/wizard/__tests__/open.spec.ts`
**Criterio de done:**
- [ ] Switch repetido N veces sin crecimiento de handles ni watchers (R-5)
- [ ] Rechazo con conflict si hay agentes trabajando en modo proyecto
- [ ] Welcome posterior trae el nuevo root
- [ ] Tests del puente verdes

## Tasks Studio

### TASK-012: lib/wizard puro: state, to-config, catalog, field-checks, issues y recommendations

**Historias:** US-1-002, US-1-003, US-1-010, US-1-011, US-1-012, US-1-025, US-1-027, US-1-036, US-1-040, US-5-004, US-5-006
**App:** apps/studio
**Descripción:** Implementar la lógica pura de D-06: reducer y planDiscards con stash, toHarnessConfig que emite solo lo decidido, selectores sobre ConfigCatalog, chequeos instantáneos con patrones del catálogo, mapeo ConfigIssue a step/field/text y etiquetas «Recomendado».
**Estimación:** 8h · **Story points:** 5
**Dependencias:** TASK-004
**Archivos:**
- `apps/studio/src/lib/wizard/state.ts`
- `apps/studio/src/lib/wizard/to-config.ts`
- `apps/studio/src/lib/wizard/catalog.ts`
- `apps/studio/src/lib/wizard/field-checks.ts`
- `apps/studio/src/lib/wizard/issues.ts`
- `apps/studio/src/lib/wizard/recommendations.ts`
- `apps/studio/src/lib/wizard/__tests__/`
**Criterio de done:**
- [ ] Tests de la matriz de alcance por modo y de planDiscards
- [ ] toHarnessConfig: tucuUi false solo si se apagó, port solo si se editó, ml solo en python, shell solo con más de un mfe-shell, sdd.profile siempre
- [ ] Sin React en estos archivos
- [ ] `pnpm --filter` de studio test y typecheck verdes

### TASK-013: Persistencia, idea para Hermes y hooks sobre el cliente del puente

**Historias:** US-1-041, US-4-006, US-4-007, US-1-032, US-1-034, US-3-002, US-3-013, US-3-032
**App:** apps/studio
**Descripción:** persist.ts sobre sessionStorage (estado, puntero a la generación e idea pendiente; nunca el fingerprint); hermes-idea.ts con el texto de US-4-007; hooks con debounce de 400 ms, cola de uno con reemplazo, contador de secuencia y resincronización por generation.get.
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-004, TASK-012
**Archivos:**
- `apps/studio/src/lib/wizard/persist.ts`
- `apps/studio/src/lib/wizard/hermes-idea.ts`
- `apps/studio/src/lib/wizard/use-catalog.ts`
- `apps/studio/src/lib/wizard/use-wizard-validation.ts`
- `apps/studio/src/lib/wizard/use-target-check.ts`
- `apps/studio/src/lib/wizard/use-generation.ts`
- `apps/studio/src/lib/wizard/__tests__/`
**Criterio de done:**
- [ ] Tests de hooks con un cliente falso: debounce, reemplazo y orden por seq
- [ ] persist.ts no guarda el fingerprint de confirmación (test)
- [ ] Tests de studio verdes

### TASK-014: Módulo new-project: ids de navegación, slots Panel/Center/Right, stepper y textos i18n

**Historias:** US-1-001, US-1-002, US-1-003, US-1-004, US-1-005, US-1-011, US-1-041, US-2-005, US-2-008
**App:** apps/studio
**Descripción:** Sumar new-project a MODULE_IDS (ícono FolderPlus, hideable) y registrar newProjectModule; stepper de 6 pasos con «No aplica por el alcance» y «Empezar de nuevo»; Center con Siguiente/Atrás y razón de bloqueo; Right con árbol, config de solo lectura y lista de issues con enlace al campo. Textos es/en.
**Estimación:** 8h · **Story points:** 5
**Dependencias:** TASK-012, TASK-013
**Archivos:**
- `apps/studio/src/lib/nav/module-ids.ts`
- `apps/studio/src/lib/nav/modules.ts`
- `apps/studio/src/lib/nav/module-labels.ts`
- `apps/studio/src/lib/i18n/`
- `apps/studio/src/components/modules/new-project/index.ts`
- `apps/studio/src/components/modules/new-project/NewProjectPanel.tsx`
- `apps/studio/src/components/modules/new-project/NewProjectCenter.tsx`
- `apps/studio/src/components/modules/new-project/NewProjectRight.tsx`
**Criterio de done:**
- [ ] RTL: stepper marca paso actual, completados y no aplicables
- [ ] Siguiente deshabilitado muestra la razón
- [ ] Sin <select> nativo (no-native-select.spec.ts verde) y tipografía de Studio
- [ ] Tests y typecheck de studio verdes

### TASK-015: Pasos 1 a 3 (alcance, forma, frontend) con AppRow y PortField

**Historias:** US-1-010, US-1-011, US-1-012, US-1-013, US-1-014, US-1-015, US-1-016, US-1-017, US-1-018, US-1-019, US-1-020, US-1-021, US-1-022, US-1-053, US-1-054, US-1-055
**App:** apps/studio
**Descripción:** Implementar los pasos de alcance, forma y frontend con opciones filtradas por el catálogo, recomendaciones, filas editables de apps con nombre y puerto, y errores en el campo.
**Estimación:** 8h · **Story points:** 5
**Dependencias:** TASK-014
**Archivos:**
- `apps/studio/src/components/modules/new-project/steps/ScopeStep.tsx`
- `apps/studio/src/components/modules/new-project/steps/ShapeStep.tsx`
- `apps/studio/src/components/modules/new-project/steps/FrontStep.tsx`
- `apps/studio/src/components/modules/new-project/AppRow.tsx`
- `apps/studio/src/components/modules/new-project/PortField.tsx`
- `apps/studio/src/components/modules/new-project/__tests__/`
**Criterio de done:**
- [ ] RTL: las opciones aparecen según lo elegido antes
- [ ] Validación de nombre y puerto con error en el campo
- [ ] Recomendado visible donde corresponde
- [ ] Tests de studio verdes

### TASK-016: Pasos 4 a 6 parte A: backend, extras y resumen, con ServiceRow y descartes

**Historias:** US-1-023, US-1-024, US-1-026, US-1-028, US-1-029, US-1-030, US-1-031, US-1-056, US-1-057, US-2-004, US-2-006, US-2-007, US-2-009, US-1-036
**App:** apps/studio
**Descripción:** Pasos de backend, extras (servicios Docker Compose con puerto de solo lectura, X-4) y resumen con comandos que se ejecutarán; diálogo de descartes ante cambios de alcance o modo.
**Estimación:** 8h · **Story points:** 5
**Dependencias:** TASK-015
**Archivos:**
- `apps/studio/src/components/modules/new-project/steps/BackStep.tsx`
- `apps/studio/src/components/modules/new-project/steps/ExtrasStep.tsx`
- `apps/studio/src/components/modules/new-project/steps/SummaryStep.tsx`
- `apps/studio/src/components/modules/new-project/ServiceRow.tsx`
- `apps/studio/src/components/modules/new-project/DiscardChangesDialog.tsx`
- `apps/studio/src/components/modules/new-project/__tests__/`
**Criterio de done:**
- [ ] RTL: puerto de servicio de solo lectura
- [ ] El diálogo lista exactamente lo que planDiscards descarta
- [ ] El resumen muestra el config y los comandos resueltos
- [ ] Tests de studio verdes

### TASK-017: Destino: TargetPicker, explorador de directorios, estado, confirmación y preflight

**Historias:** US-3-001, US-3-002, US-3-003, US-3-004, US-3-005, US-3-006, US-3-007, US-3-008, US-3-009, US-3-010, US-3-014, US-3-015
**App:** apps/studio
**Descripción:** Campo de ruta y explorador por wizard.listDirs que muestra la ruta normalizada; TargetStatus con los estados de TargetCheck; confirmación con ruta, cantidad y primeros nombres, y botón «Generar en esta carpeta con contenido» sin foco inicial; aviso de preflight bloqueante.
**Estimación:** 8h · **Story points:** 5
**Dependencias:** TASK-014, TASK-008, TASK-007
**Archivos:**
- `apps/studio/src/components/modules/new-project/TargetPicker.tsx`
- `apps/studio/src/components/modules/new-project/DirectoryBrowserModal.tsx`
- `apps/studio/src/components/modules/new-project/TargetStatus.tsx`
- `apps/studio/src/components/modules/new-project/ConfirmTargetDialog.tsx`
- `apps/studio/src/components/modules/new-project/PreflightNotice.tsx`
- `apps/studio/src/components/modules/new-project/__tests__/`
**Criterio de done:**
- [ ] RTL: cada estado de TargetCheck con su texto
- [ ] El botón de confirmación no es el foco inicial
- [ ] Contenido no tolerado bloquea sin opción de confirmar
- [ ] Tests de studio verdes

### TASK-018: Progreso y resultado: GenerationProgress, OutputLog y GenerationResult

**Historias:** US-3-011, US-3-012, US-3-013, US-3-016, US-3-017, US-3-018, US-3-019, US-3-030, US-3-031, US-3-032, US-3-033, US-3-034, US-3-035, US-3-036, US-3-037, US-3-038, US-5-007, US-4-001, US-4-002, US-4-003, US-4-004, US-4-008
**App:** apps/studio
**Descripción:** Etapas con log en vivo (autoscroll salvo que el usuario haya subido), cancelación con confirmación, «Conexión perdida» y las tres variantes de resultado (éxito, «Generado con errores», fallo previo) con versión de la CLI y las acciones de D-06.
**Estimación:** 8h · **Story points:** 5
**Dependencias:** TASK-013, TASK-014, TASK-017
**Archivos:**
- `apps/studio/src/components/modules/new-project/GenerationProgress.tsx`
- `apps/studio/src/components/modules/new-project/OutputLog.tsx`
- `apps/studio/src/components/modules/new-project/GenerationResult.tsx`
- `apps/studio/src/components/modules/new-project/__tests__/`
**Criterio de done:**
- [ ] RTL: las tres variantes de resultado y sus acciones
- [ ] OutputLog no autoscrollea si el usuario subió
- [ ] «Abrir en Studio» solo si hasSdd
- [ ] Tests de studio verdes

### TASK-019: LauncherShell, cambio de proyecto en BridgeProvider, ConnectionBanner y ConnectScreen

**Historias:** US-1-001, US-4-005, US-4-006, US-4-007, US-4-009, US-4-010, US-4-011
**App:** apps/studio
**Descripción:** Con welcome.workspace null mostrar LauncherShell (solo new-project, «Sin proyecto abierto»); ante workspace.switched mostrar «Abriendo <project>…», resetear el store al cambiar root, navegar a #general y dejar la idea para Hermes como borrador del composer sin enviarla; error accionable a los 15 s; línea de ayuda en ConnectScreen.
**Estimación:** 8h · **Story points:** 5
**Dependencias:** TASK-011, TASK-014, TASK-018
**Archivos:**
- `apps/studio/src/components/shell/LauncherShell.tsx`
- `apps/studio/src/components/WorkspaceApp.tsx`
- `apps/studio/src/components/BridgeProvider.tsx`
- `apps/studio/src/components/ConnectionBanner.tsx`
- `apps/studio/src/components/ConnectScreen.tsx`
- `apps/studio/src/components/__tests__/`
**Criterio de done:**
- [ ] RTL: LauncherShell en lugar de StudioShell con workspace null
- [ ] El store se resetea al cambiar root y se navega a #general
- [ ] La idea queda como borrador, sin enviarse
- [ ] Tests y typecheck de studio verdes

## Tasks Docs y contexto

### TASK-020: Documentación bilingüe de la CLI (config catalog/validate) y de Studio (Nuevo proyecto)

**Historias:** US-5-001, US-5-002, US-1-001, US-3-001
**App:** sdd
**Descripción:** Documentar en es y en los subcomandos config catalog y config validate, el modo launcher del puente (--allow-target, npx @e-burgos/sdd-studio) y el módulo Nuevo proyecto, con el orden de release CLI, web, puente (R-4).
**Estimación:** 5h · **Story points:** 3
**Dependencias:** TASK-003, TASK-019
**Archivos:**
- `sdd/documentation/es/`
- `sdd/documentation/en/`
**Criterio de done:**
- [ ] Mismo contenido en es y en
- [ ] Sin enlaces rotos (pnpm sdd:validate sin errores nuevos)
- [ ] Documentadas limitaciones: sin reanudar instalación, toolchains de python y Java

### TASK-021: Fragmentos de contexto aditivos de apps/cli, apps/studio, apps/studio-bridge y libs/studio-protocol

**Historias:** US-5-002
**App:** sdd
**Descripción:** Escribir un fragmento 2026-11-04-spec-e-burgos-013-studio-project-wizard-cycle-01.md por subproyecto con Estado, Estructura, Dependencias y Qué sigue; incluir la regrabación de fixtures al subir la CLI (R-1). La fila de los contextos globales la toca el cierre del ciclo.
**Estimación:** 3h · **Story points:** 2
**Dependencias:** TASK-019
**Archivos:**
- `sdd/context/apps/cli/updates/`
- `sdd/context/apps/studio/updates/`
- `sdd/context/apps/studio-bridge/updates/`
- `sdd/context/libs/studio-protocol/updates/`
**Criterio de done:**
- [ ] Un fragmento por subproyecto con las cuatro secciones
- [ ] Los archivos base no se editan
- [ ] pnpm sdd:validate sin errores de contexto

## Tasks E2E y verificación real

### TASK-022: Generación real de punta a punta en examples/ y equivalencia con harness init --config

**Historias:** US-3-011, US-3-012, US-3-030, US-5-005, US-5-006, US-5-007
**App:** apps/studio
**Descripción:** Con la CLI y el puente compilados, generar un proyecto real en examples/ desde un config armado como el wizard (install, sdd:validate, lint test build en verde) y comprobar que el árbol es equivalente al de harness init --config con el mismo archivo.
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-011, TASK-003
**Archivos:**
- `apps/studio-bridge/src/wizard/__e2e__/generation.e2e.spec.ts`
- `examples/`
**Criterio de done:**
- [ ] Generación real con gate verde y harness.config.json conservado
- [ ] Árbol equivalente al de la CLI directa (US-5-005)
- [ ] Corrida protegida por variable de entorno como init.e2e.spec.ts
- [ ] pnpm build && pnpm typecheck && pnpm test verdes

### TASK-023: e2e de Studio en el puerto 4417: wizard completo con bridge launcher y apertura del proyecto

**Historias:** US-1-001, US-1-003, US-2-005, US-3-012, US-3-037, US-4-001, US-4-005, US-4-006
**App:** apps/studio
**Descripción:** Playwright en el puerto 4417 contra un puente launcher con fake-harness: recorrer los 6 pasos, elegir destino, ver progreso, resultado y abrir el proyecto con #general y la idea como borrador.
**Estimación:** 8h · **Story points:** 5
**Dependencias:** TASK-019, TASK-011
**Archivos:**
- `apps/studio/e2e/new-project.e2e.ts`
- `apps/studio/e2e/start-bridge.mjs`
**Criterio de done:**
- [ ] Flujo completo verde en 4417
- [ ] Caso de destino con contenido pide confirmación
- [ ] Caso de gate rojo muestra «Generado con errores»
- [ ] Los e2e existentes siguen verdes

---

## Orden de ejecución

TASK-001 → TASK-002 → TASK-003 → TASK-004 → TASK-005 → TASK-006 → TASK-007 → TASK-008 → TASK-009 → TASK-010 → TASK-011 → TASK-012 → TASK-013 → TASK-014 → TASK-015 → TASK-016 → TASK-017 → TASK-018 → TASK-019 → TASK-020 → TASK-021 → TASK-022 → TASK-023 (respetando dependencias; TASK-004, TASK-012 y TASK-013 pueden adelantarse en paralelo a la CLI).

## Notas

- Las tasks de Studio que consumen comandos del puente (TASK-017, TASK-018, TASK-019) no empiezan antes de que el comando exista en el puente (TASK-007, TASK-008, TASK-010, TASK-011).
- Cierre: `pnpm build && pnpm typecheck && pnpm test`, `pnpm sdd:validate` y `pnpm sdd:rebuild-tasks-index`.
