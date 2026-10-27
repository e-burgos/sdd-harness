## Sprint Plan — Ciclo 1 — studio-dual-sidebar

**Duración estimada:** 4.9 semanas (un dev, ~6 h efectivas/día)
**Story points totales:** 106  ·  **Horas totales:** 146

Orden: protocolo, puente, web. Las tasks que dependen de decisiones de contrato (datos del kit bajo demanda o en snapshot, escritura de tools.json, campos de snapshot, ubicación del estado de navegación y de la preferencia del riel) se redactan por resultado y se ajustan a architect.md, que se escribe en paralelo; el implementador lo lee antes de empezar cada una. Toda task de UI se valida con sus specs de vitest y con el chequeo visual en claro y oscuro a 1280×700 y 1440×860 más la escala tipográfica de RNF-1; el e2e de Studio se mantiene verde (se ajusta en TASK-011, TASK-020 y TASK-028). Verificación final: `pnpm build && pnpm typecheck && pnpm test` y `pnpm sdd:validate`.

**Camino crítico:** TASK-008 → TASK-010 → TASK-011 → TASK-013 → TASK-014 → TASK-024 → TASK-028 → TASK-029 (43 h).

**Paralelismo:** los grupos Protocolo (TASK-001..003) y estado de navegación web (TASK-008) arrancan sin dependencias; tras TASK-011 los módulos web (Specs, Fixes, Agentes, Actividad, Kit, Arquitectura, Métricas) son independientes entre sí salvo las dependencias indicadas.

## Tasks Protocolo

### TASK-001: Protocolo: pedido bajo demanda de datos del kit y feature

**Historia:** US-7-001, US-9-001
**App:** libs/studio-protocol
**Descripción:** Agregar al protocolo el contrato para que la web obtenga los datos del kit que hoy no están en el snapshot (documentación, schemas JSON, contexto con fragmentos updates, memoria, schema.json, api.json y components.json): comando de pedido, respuesta con estado por elemento (ok, error acotado, demasiado grande) y límites de tamaño, según architect.md. Sumar la feature al final de BRIDGE_FEATURES. Todo opcional/con degradación: un puente anterior no entrega nada y la web lo detecta por la feature.
**Archivos:** `libs/studio-protocol/src/commands.ts`, `libs/studio-protocol/src/events.ts`, `libs/studio-protocol/src/limits.ts`, `libs/studio-protocol/src/commands.spec.ts`, `libs/studio-protocol/src/events.spec.ts`, `libs/studio-protocol/src/handshake.spec.ts`
**CA cubiertos:** CA-091..CA-101, CA-114..CA-119, CA-132
**Estimación:** 4h · **Story points:** 3
**Dependencias:** ninguna
**Verificación:** `pnpm --filter @sdd-studio/protocol test && pnpm --filter @sdd-studio/protocol typecheck`
**Criterio de done:**

- [ ] Mensajes nuevos validan entradas válidas y rechazan rutas fuera de la forma permitida
- [ ] La feature queda al final de BRIDGE_FEATURES y handshake.spec.ts se actualiza
- [ ] Frames sin los campos nuevos siguen parseando (compatibilidad CA-132)
- [ ] Specs del protocolo verdes

### TASK-002: Protocolo: escritura de sdd/tools.json y evento de cambio

**Historia:** US-8-001
**App:** libs/studio-protocol
**Descripción:** Definir el comando de escritura acotado a los tres valores permitidos (rtk.enabled, claude_mod.enabled, claude_mod.gate), su respuesta (aplicado con valor previo y nuevo, o rechazado con motivo tipado: invalido, permiso, cambio externo, no soportado), el evento de cambio de herramienta que alimenta #general y la feature de escritura en BRIDGE_FEATURES, según architect.md. Sin campos libres: el schema no admite editar ningún otro campo.
**Archivos:** `libs/studio-protocol/src/commands.ts`, `libs/studio-protocol/src/events.ts`, `libs/studio-protocol/src/limits.ts`, `libs/studio-protocol/src/commands.spec.ts`, `libs/studio-protocol/src/events.spec.ts`, `libs/studio-protocol/src/handshake.spec.ts`
**CA cubiertos:** CA-102..CA-113
**Estimación:** 4h · **Story points:** 3
**Dependencias:** TASK-001
**Verificación:** `pnpm --filter @sdd-studio/protocol test && pnpm --filter @sdd-studio/protocol typecheck`
**Criterio de done:**

- [ ] El comando solo admite las tres claves y sus valores válidos (gate: block|warn)
- [ ] Respuesta y evento tipados con motivos de fallo distinguibles
- [ ] Feature agregada al final de BRIDGE_FEATURES; handshake.spec.ts verde
- [ ] Specs del protocolo verdes

### TASK-003: Protocolo: ampliación del snapshot para ciclo actual, documentos y actividad de hilos

**Historia:** US-3-001, US-3-002, US-4-001, US-4-002, US-5-001
**App:** libs/studio-protocol
**Descripción:** Ampliar de forma opcional el snapshot y el dominio según architect.md: lo que falte para flow y ciclo actual por spec, progreso de tareas, documentos existentes por ciclo (para Plan y Documentos), documentos de cada fix, fecha de creación y cierre del fix, y el dato de última actividad y archivada por hilo (RN-6). Todo opcional con .catch para que un snapshot anterior siga parseando.
**Archivos:** `libs/studio-protocol/src/snapshot.ts`, `libs/studio-protocol/src/domain.ts`, `libs/studio-protocol/src/snapshot.spec.ts`, `libs/studio-protocol/src/domain.spec.ts`
**CA cubiertos:** CA-029, CA-033, CA-039..CA-046, CA-055..CA-057, CA-060, CA-068
**Estimación:** 4h · **Story points:** 3
**Dependencias:** ninguna
**Verificación:** `pnpm --filter @sdd-studio/protocol test && pnpm --filter @sdd-studio/protocol typecheck`
**Criterio de done:**

- [ ] Snapshot y ThreadInfo sin los campos nuevos siguen parseando
- [ ] Campos malformados degradan con .catch sin tirar el frame
- [ ] Specs del protocolo verdes

## Tasks Puente

### TASK-004: Puente: lectura del kit con lista blanca y límites de tamaño

**Historia:** US-7-001, US-9-001
**App:** apps/studio-bridge
**Descripción:** Implementar el manejo del pedido de datos del kit: documentación (README, cómo usar, instalar y actualizar, en español e inglés), schemas de sdd/schemas, constitution y context_prompt global y por subproyecto con sus fragmentos updates en orden de nombre, memoria (lessons y journal) y los registros de arquitectura. Reutilizar la lista blanca del visor de documentos, límite de tamaño por elemento y error acotado por elemento (falta, ilegible, excede).
**Archivos:** `apps/studio-bridge/src/workspace/kit-reader.ts`, `apps/studio-bridge/src/workspace/kit-reader.spec.ts`, `apps/studio-bridge/src/workspace/paths.ts`, `apps/studio-bridge/src/commands/`
**CA cubiertos:** CA-091..CA-101, CA-114..CA-119, RNF-10
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-001
**Verificación:** `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck`
**Criterio de done:**

- [ ] Rutas fuera de la lista blanca se rechazan (sin traversal)
- [ ] Archivo ausente, ilegible o demasiado grande devuelve error acotado al elemento sin afectar al resto
- [ ] Fragmentos updates devueltos en orden de nombre y distinguidos del base
- [ ] kit-reader.spec.ts verde

### TASK-005: Puente: lógica pura de escritura de sdd/tools.json

**Historia:** US-8-001
**App:** apps/studio-bridge
**Descripción:** Implementar el módulo puro que aplica un cambio de herramienta sobre sdd/tools.json con la misma semántica que pnpm sdd:rtk y pnpm sdd:mod (RN-12): lee el archivo, detecta cambio externo respecto del valor esperado, valida el resultado contra sdd/schemas/tools.schema.json, escribe de forma atómica solo las tres claves permitidas y devuelve valor previo y nuevo. Contrastar el resultado con el que producen los scripts del kit.
**Archivos:** `apps/studio-bridge/src/workspace/tools-config.ts`, `apps/studio-bridge/src/workspace/tools-config.spec.ts`
**CA cubiertos:** CA-103..CA-113, RNF-10
**Estimación:** 5h · **Story points:** 3
**Dependencias:** TASK-002
**Verificación:** `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck`
**Criterio de done:**

- [ ] Las tres claves producen el mismo archivo que los scripts del kit
- [ ] Cambio externo previo, archivo inválido y permiso denegado devuelven motivo tipado sin escribir
- [ ] Ninguna otra clave ni archivo se modifica
- [ ] tools-config.spec.ts verde

### TASK-006: Puente: comandos de kit y herramientas, evento a #general y refresco por watcher

**Historia:** US-7-001, US-8-001, US-9-001
**App:** apps/studio-bridge
**Descripción:** Conectar al servidor los comandos de lectura del kit y de escritura de herramientas; anunciar las features en el handshake; emitir el evento de cambio de herramienta solo en cambios exitosos (el cambio fallido o cancelado no deja registro); y hacer que el watcher refleje en la web los cambios de sdd/tools.json hechos fuera de Studio sin recargar.
**Archivos:** `apps/studio-bridge/src/commands/`, `apps/studio-bridge/src/server/`, `apps/studio-bridge/src/workspace/watcher.ts`, `apps/studio-bridge/src/workspace/watcher.spec.ts`, `apps/studio-bridge/src/main.spec.ts`
**CA cubiertos:** CA-105..CA-110, CA-132
**Estimación:** 5h · **Story points:** 3
**Dependencias:** TASK-004, TASK-005
**Verificación:** `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck`
**Criterio de done:**

- [ ] Cambio exitoso emite el evento con herramienta, valor previo, valor nuevo y hora; el fallido no
- [ ] Edición externa de tools.json llega a la web sin recarga
- [ ] Handshake anuncia las features nuevas
- [ ] Specs del puente verdes

### TASK-007: Puente: snapshot ampliado y refresco de ciclos, documentos e hilos

**Historia:** US-3-001, US-3-002, US-4-002, US-5-001
**App:** apps/studio-bridge
**Descripción:** Poblar en el snapshot los campos nuevos del protocolo: flow y ciclo actual, tareas por ciclo, documentos existentes por ciclo y artefactos, documentos y fechas de cada fix, y última actividad y archivada de cada hilo. Mantener el watcher disparando snapshot al cambiar tasks.json, cycle.json o fixes.json.
**Archivos:** `apps/studio-bridge/src/workspace/snapshot.ts`, `apps/studio-bridge/src/workspace/watcher.ts`, `apps/studio-bridge/src/workspace/snapshot.spec.ts`, `apps/studio-bridge/src/workspace/watcher.spec.ts`, `apps/studio-bridge/src/sessions/`
**CA cubiertos:** CA-039..CA-046, CA-055..CA-057, CA-060, CA-065, CA-068
**Estimación:** 5h · **Story points:** 3
**Dependencias:** TASK-003
**Verificación:** `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck`
**Criterio de done:**

- [ ] Spec sin ciclo y fix sin severidad no rompen el snapshot
- [ ] Documentos pendientes (no existentes) no aparecen como existentes
- [ ] Una tarea que pasa a done actualiza el snapshot
- [ ] Specs del puente verdes

## Tasks Web

### TASK-008: Web: estado de navegación, selección persistente y preferencia del riel

**Historia:** US-1-001, US-2-001
**App:** apps/studio
**Descripción:** Crear el estado de navegación (módulo activo y elemento elegido) con selección recordada al recargar y respaldo a Inicio si el elemento no existe, y la preferencia del riel por proyecto (visibles, orden) con almacenamiento tolerante a fallas, validación de formato antiguo o inválido y alta de módulos nuevos al final o en Más. Lógica pura con hooks; sin UI todavía. Ubicación y clave de proyecto según architect.md.
**Archivos:** `apps/studio/src/lib/navigation/`, `apps/studio/src/lib/navigation/rail-preferences.spec.ts`, `apps/studio/src/lib/navigation/navigation-state.spec.ts`
**CA cubiertos:** CA-010, CA-022..CA-024, RN-4
**Estimación:** 5h · **Story points:** 3
**Dependencias:** ninguna
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`
**Criterio de done:**

- [ ] Selección inexistente cae en Inicio sin error
- [ ] Preferencia inválida, antigua o con almacenamiento caído devuelve el riel por defecto
- [ ] Dos proyectos conservan preferencias distintas
- [ ] Specs verdes

### TASK-009: Web: componente del riel de módulos

**Historia:** US-1-001
**App:** apps/studio
**Descripción:** Construir el riel: proyecto arriba, nueve módulos con ícono 16 y etiqueta 11, módulo activo con indicador más allá del color, Más, y al pie nueva conversación y cuenta con punto de estado de conexión. Navegación por teclado y nombre accesible en cada ítem. Textos en español e inglés.
**Archivos:** `apps/studio/src/components/shell/ModuleRail.tsx`, `apps/studio/src/components/shell/ModuleRail.spec.tsx`, `apps/studio/src/lib/i18n/`
**CA cubiertos:** CA-001, CA-002, CA-008
**Estimación:** 5h · **Story points:** 3
**Dependencias:** TASK-008
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`. Chequeo visual en el navegador: claro y oscuro a 1280×700 y 1440×860, escala tipográfica de RNF-1 (título de panel 16 semibold, grupos 13, ítems 14 en filas de 28px con ícono 16, metadatos 11, etiquetas del riel 11), sin scroll horizontal ni texto mayor que su contexto
**Criterio de done:**

- [ ] Orden de CA-001 y módulo activo distinguible por forma
- [ ] Recorrible por teclado con nombre accesible
- [ ] Specs verdes y chequeo visual hecho en claro y oscuro

### TASK-010: Web: marco del panel de lista (título, buscador ⌘K, grupos, estados)

**Historia:** US-1-001, US-1-002, US-X-001
**App:** apps/studio
**Descripción:** Construir el marco reutilizable del panel: título 16 semibold con acciones o menú, buscador con atajo ⌘K/Ctrl+K y Escape (limpia, segundo Escape vuelve la foco a la lista), grupos colapsables con línea fina, filas de 28px, filtro sin mayúsculas ni tildes, estados de carga, vacío (con limpiar filtro) y error compartidos, y texto del buscador por módulo con una sola conducta. Usar componentes de tucu-ui donde existan.
**Archivos:** `apps/studio/src/components/shell/ListPanel.tsx`, `apps/studio/src/components/shell/PanelGroup.tsx`, `apps/studio/src/components/shell/PanelSearch.tsx`, `apps/studio/src/components/shell/StateViews.tsx`, `apps/studio/src/lib/navigation/normalize-search.ts`, `apps/studio/src/components/shell/ListPanel.spec.tsx`
**CA cubiertos:** CA-004, CA-005, CA-011..CA-017, CA-128..CA-130
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-008
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`. Chequeo visual en el navegador: claro y oscuro a 1280×700 y 1440×860, escala tipográfica de RNF-1 (título de panel 16 semibold, grupos 13, ítems 14 en filas de 28px con ícono 16, metadatos 11, etiquetas del riel 11), sin scroll horizontal ni texto mayor que su contexto
**Criterio de done:**

- [ ] Con texto se ocultan grupos sin coincidencias y se expanden los demás, restaurando el colapso al borrar
- [ ] Colapsar no altera filtro ni selección y el estado se conserva entre módulos
- [ ] Specs verdes y chequeo visual hecho

### TASK-011: Web: shell de layout por módulo y header sin pestañas

**Historia:** US-1-001
**App:** apps/studio
**Descripción:** Reemplazar el layout de WorkspaceApp por riel + panel + centro + panel derecho opcional (presente en Inicio, Specs, Fixes, Agentes y Mapa; ausente en Kit, Arquitectura y Métricas), sin las pestañas de vistas en el header (conserva chip del SPEC GATE, estado del equipo, idioma y tema). Cada módulo entra como slot con su panel y centro; hasta que cada uno exista, el slot mantiene accesibles las vistas actuales para no perder nada (RN-3). Aviso de conexión y degradación con puente caído. Actualizar el e2e de Studio al nuevo layout.
**Archivos:** `apps/studio/src/components/WorkspaceApp.tsx`, `apps/studio/src/components/StudioHeader.tsx`, `apps/studio/src/components/shell/ModuleLayout.tsx`, `apps/studio/src/components/workspaceapp.spec.tsx`, `apps/studio/src/components/studioheader.spec.tsx`, `apps/studio/e2e/studio.e2e.ts`
**CA cubiertos:** CA-003, CA-006, CA-007, CA-009, CA-131, CA-133, RN-1..RN-3, RNF-3
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-009, TASK-010
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck && pnpm --filter sdd-studio-web e2e`. Chequeo visual en el navegador: claro y oscuro a 1280×700 y 1440×860, escala tipográfica de RNF-1 (título de panel 16 semibold, grupos 13, ítems 14 en filas de 28px con ícono 16, metadatos 11, etiquetas del riel 11), sin scroll horizontal ni texto mayor que su contexto
**Criterio de done:**

- [ ] Header sin pestañas y con chip del gate, equipo, idioma y tema
- [ ] Panel y centro siempre del mismo módulo; panel derecho solo en los cinco módulos
- [ ] Viewport angosto sin scroll horizontal de página
- [ ] e2e verde y chequeo visual hecho

### TASK-012: Web: personalización del riel (Más, ocultar, reordenar, restablecer)

**Historia:** US-2-001
**App:** apps/studio
**Descripción:** Agregar "Más" con indicador de módulos ocultos, modo de personalización con visibilidad y orden (reordenamiento con mouse y con teclado), restablecer por defecto con una acción, Inicio no ocultable y módulo activo oculto que sigue mostrándose. Usa la preferencia por proyecto de TASK-008.
**Archivos:** `apps/studio/src/components/shell/ModuleRail.tsx`, `apps/studio/src/components/shell/RailCustomizer.tsx`, `apps/studio/src/components/shell/RailCustomizer.spec.tsx`
**CA cubiertos:** CA-018..CA-027
**Estimación:** 5h · **Story points:** 3
**Dependencias:** TASK-009, TASK-011
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`. Chequeo visual en el navegador: claro y oscuro a 1280×700 y 1440×860, escala tipográfica de RNF-1 (título de panel 16 semibold, grupos 13, ítems 14 en filas de 28px con ícono 16, metadatos 11, etiquetas del riel 11), sin scroll horizontal ni texto mayor que su contexto
**Criterio de done:**

- [ ] Ocultar y reordenar con mouse y teclado persisten tras recargar por proyecto
- [ ] Restablecer vuelve al orden de CA-001; Inicio no se puede ocultar
- [ ] Specs verdes y chequeo visual hecho

### TASK-013: Web: Inicio, panel con En curso, Por aprobar, canales, conversaciones y agentes

**Historia:** US-3-001, US-1-002
**App:** apps/studio
**Descripción:** Panel de Inicio: accesos En curso y Por aprobar con contador y estado vacío, grupo Canales (#general, #specs, #fixes), Conversaciones con filtro Solo activas/Mostrar todo persistente (selector de actividad RN-6 con sus casos de error), grupo Agentes con presencia. Reutilizar el árbol de conversaciones existente. Nueva conversación desde riel y menú del panel.
**Archivos:** `apps/studio/src/components/shell/home/HomePanel.tsx`, `apps/studio/src/lib/navigation/active-conversations.ts`, `apps/studio/src/components/shell/home/HomePanel.spec.tsx`, `apps/studio/src/lib/navigation/active-conversations.spec.ts`
**CA cubiertos:** CA-028..CA-036
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-010, TASK-011, TASK-007
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`. Chequeo visual en el navegador: claro y oscuro a 1280×700 y 1440×860, escala tipográfica de RNF-1 (título de panel 16 semibold, grupos 13, ítems 14 en filas de 28px con ícono 16, metadatos 11, etiquetas del riel 11), sin scroll horizontal ni texto mayor que su contexto
**Criterio de done:**

- [ ] Conversación en curso o por aprobar nunca se oculta con Solo activas
- [ ] Filtro elegido sobrevive a la recarga
- [ ] Specs verdes y chequeo visual hecho

### TASK-014: Web: Inicio, centro de canales con resúmenes #specs y #fixes y panel derecho

**Historia:** US-3-001, US-3-002
**App:** apps/studio
**Descripción:** Centro de Inicio: #general con actividad del proyecto (incluidos los registros de cambios de herramientas que llegan por el evento), #specs y #fixes con tabla-resumen del proyecto completo (spec: título, estado, ciclo, flow, progreso; fix: título, severidad, estado; casos sin ciclo, sin tareas y sin severidad), filas accionables que abren la ficha, actividad reunida y conversaciones asociadas debajo. Panel derecho con actividad y detalles del elemento o estado vacío.
**Archivos:** `apps/studio/src/components/shell/home/ChannelView.tsx`, `apps/studio/src/components/shell/home/SpecsFixesSummary.tsx`, `apps/studio/src/components/shell/home/HomeRightPanel.tsx`, `apps/studio/src/components/shell/home/SpecsFixesSummary.spec.tsx`
**CA cubiertos:** CA-037..CA-046
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-013, TASK-007
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`. Chequeo visual en el navegador: claro y oscuro a 1280×700 y 1440×860, escala tipográfica de RNF-1 (título de panel 16 semibold, grupos 13, ítems 14 en filas de 28px con ícono 16, metadatos 11, etiquetas del riel 11), sin scroll horizontal ni texto mayor que su contexto
**Criterio de done:**

- [ ] Resumen se actualiza al cambiar el snapshot sin recargar
- [ ] Sin specs o sin fixes, estado vacío explicativo y el resto del canal funciona
- [ ] Specs verdes y chequeo visual hecho

### TASK-015: Web: módulo Specs, panel con filtros Activas/Todas/Cerradas y grupos por estado

**Historia:** US-4-001
**App:** apps/studio
**Descripción:** Panel de Specs: buscador por id, título, estado, módulo o app y ciclo; filtros Activas (RN-5), Todas y Cerradas persistentes; grupos por estado colapsables con cantidad; filas con título, ciclo, flow y progreso en tamaño meta; estados vacíos específicos por filtro. Elegir una spec la abre en el centro.
**Archivos:** `apps/studio/src/components/shell/specs/SpecsPanel.tsx`, `apps/studio/src/lib/navigation/spec-selectors.ts`, `apps/studio/src/components/shell/specs/SpecsPanel.spec.tsx`
**CA cubiertos:** CA-047..CA-053
**Estimación:** 4h · **Story points:** 3
**Dependencias:** TASK-010, TASK-011, TASK-007
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`. Chequeo visual en el navegador: claro y oscuro a 1280×700 y 1440×860, escala tipográfica de RNF-1 (título de panel 16 semibold, grupos 13, ítems 14 en filas de 28px con ícono 16, metadatos 11, etiquetas del riel 11), sin scroll horizontal ni texto mayor que su contexto
**Criterio de done:**

- [ ] Activa = in-progress o con ciclo in-progress; Cerradas = completed
- [ ] Filtro persiste al recargar
- [ ] Specs verdes y chequeo visual hecho

### TASK-016: Web: ficha de spec con pestañas Resumen y Tareas

**Historia:** US-4-002
**App:** apps/studio
**Descripción:** Ficha en el centro con encabezado (título, estado, ciclo) y pestañas Resumen · Plan · Tareas · Documentos · Conversaciones (pestaña por defecto Resumen, se mantiene al cambiar de spec si existe). Implementar Resumen (ciclo y flow, tareas, gate, lista de ciclos, dependencias navegables, subproyecto, fixes vinculados, tareas del ciclo actual) y Tareas (agrupadas por estado, selector de ciclo). Error acotado por pestaña.
**Archivos:** `apps/studio/src/components/shell/specs/SpecCard.tsx`, `apps/studio/src/components/shell/specs/SpecSummaryTab.tsx`, `apps/studio/src/components/shell/specs/SpecTasksTab.tsx`, `apps/studio/src/components/shell/specs/SpecCard.spec.tsx`
**CA cubiertos:** CA-054, CA-055, CA-059, CA-063..CA-065
**Estimación:** 5h · **Story points:** 3
**Dependencias:** TASK-015
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`. Chequeo visual en el navegador: claro y oscuro a 1280×700 y 1440×860, escala tipográfica de RNF-1 (título de panel 16 semibold, grupos 13, ítems 14 en filas de 28px con ícono 16, metadatos 11, etiquetas del riel 11), sin scroll horizontal ni texto mayor que su contexto
**Criterio de done:**

- [ ] Cambiar de spec conserva la pestaña si existe, y cae en Resumen si no
- [ ] Error en una pestaña no afecta a las demás
- [ ] Specs verdes y chequeo visual hecho

### TASK-017: Web: ficha de spec, pestañas Plan, Documentos y Conversaciones y panel derecho

**Historia:** US-4-002
**App:** apps/studio
**Descripción:** Plan según flow (plan.md en lite; functional, planner y architect en full/reduced, los inexistentes como "pendiente"), abrir cada documento en DocumentViewerModal sin cambiar pestaña ni selección; Documentos agrupados por ciclo y artefactos; Conversaciones asociadas con acceso a iniciar una. Panel derecho Actividad y Detalles.
**Archivos:** `apps/studio/src/components/shell/specs/SpecPlanTab.tsx`, `apps/studio/src/components/shell/specs/SpecDocumentsTab.tsx`, `apps/studio/src/components/shell/specs/SpecConversationsTab.tsx`, `apps/studio/src/components/shell/specs/SpecRightPanel.tsx`, `apps/studio/src/components/mission-control/DocumentViewerModal.tsx`
**CA cubiertos:** CA-056..CA-058, CA-060..CA-062
**Estimación:** 5h · **Story points:** 3
**Dependencias:** TASK-016, TASK-007
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`. Chequeo visual en el navegador: claro y oscuro a 1280×700 y 1440×860, escala tipográfica de RNF-1 (título de panel 16 semibold, grupos 13, ítems 14 en filas de 28px con ícono 16, metadatos 11, etiquetas del riel 11), sin scroll horizontal ni texto mayor que su contexto
**Criterio de done:**

- [ ] Documento pendiente se lista sin enlace roto ni error
- [ ] Abrir un documento no cambia la pestaña
- [ ] Specs verdes y chequeo visual hecho

### TASK-018: Web: módulo Fixes, panel, ficha y panel derecho

**Historia:** US-5-001
**App:** apps/studio
**Descripción:** Panel de Fixes agrupado por estado y ordenado por severidad y fecha; filas con id, título, severidad y estado; buscador por id, título, severidad, estado y spec. Ficha con spec vinculada (no disponible si ya no existe), fechas, documentos abribles y conversaciones asociadas; panel derecho con actividad y detalles; estado vacío.
**Archivos:** `apps/studio/src/components/shell/fixes/FixesPanel.tsx`, `apps/studio/src/components/shell/fixes/FixCard.tsx`, `apps/studio/src/components/shell/fixes/FixesPanel.spec.tsx`
**CA cubiertos:** CA-066..CA-070
**Estimación:** 4h · **Story points:** 3
**Dependencias:** TASK-010, TASK-011, TASK-007
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`. Chequeo visual en el navegador: claro y oscuro a 1280×700 y 1440×860, escala tipográfica de RNF-1 (título de panel 16 semibold, grupos 13, ítems 14 en filas de 28px con ícono 16, metadatos 11, etiquetas del riel 11), sin scroll horizontal ni texto mayor que su contexto
**Criterio de done:**

- [ ] Fix con spec inexistente muestra el vínculo como no disponible sin romper la ficha
- [ ] Orden por severidad y luego más reciente verificado
- [ ] Specs verdes y chequeo visual hecho

### TASK-019: Web: ficha de agente compartida y módulo Agentes

**Historia:** US-5-002
**App:** apps/studio
**Descripción:** Extraer la ficha de agente (presencia, descripción, modelo, origen, ruta y chat directo) de AgentInspectorDrawer a un componente único usado por Agentes y Mapa. Módulo Agentes: panel agrupado por origen (proyecto/kit) con presencia y buscador por nombre, descripción y modelo; centro con las conversaciones del agente; ficha en el panel derecho; chat deshabilitado con motivo si el puente no lo soporta. Verificar que la conducta en el mapa no cambia.
**Archivos:** `apps/studio/src/components/mission-control/AgentInspectorDrawer.tsx`, `apps/studio/src/components/shell/agents/AgentCard.tsx`, `apps/studio/src/components/shell/agents/AgentsPanel.tsx`, `apps/studio/src/components/mission-control/agentmap.spec.tsx`, `apps/studio/src/components/shell/agents/AgentsPanel.spec.tsx`
**CA cubiertos:** CA-071..CA-078
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-010, TASK-011
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`. Chequeo visual en el navegador: claro y oscuro a 1280×700 y 1440×860, escala tipográfica de RNF-1 (título de panel 16 semibold, grupos 13, ítems 14 en filas de 28px con ícono 16, metadatos 11, etiquetas del riel 11), sin scroll horizontal ni texto mayor que su contexto
**Criterio de done:**

- [ ] Una sola ficha funcional para Agentes y Mapa; una acción se refleja en ambos lados
- [ ] Sin soporte de chat directo: chat deshabilitado con motivo y datos visibles
- [ ] Specs verdes y chequeo visual hecho

### TASK-020: Web: Mapa en tres columnas con nodos intactos

**Historia:** US-6-001
**App:** apps/studio
**Descripción:** Panel del Mapa con nueva conversación, selector y filtros Todas, Transversal, Por ciclo, En ejecución y Listas con cantidades y estados vacíos; buscador por título y asociados; centro con AgentMapCanvas y AgentNode sin cambios de apariencia ni interacción; panel derecho con interacción del enjambre y, al seleccionar un agente, la ficha compartida con chat directo. Conservar inspección de compuertas y documentos. Los filtros actúan sobre la lista, nunca sobre los nodos.
**Archivos:** `apps/studio/src/components/shell/map/MapPanel.tsx`, `apps/studio/src/components/shell/map/MapRightPanel.tsx`, `apps/studio/src/components/mission-control/AgentMapCanvas.tsx`, `apps/studio/src/components/mission-control/ConversationSelector.tsx`, `apps/studio/src/components/mission-control/agentmap.spec.tsx`
**CA cubiertos:** CA-079..CA-087, RNF-2
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-019, TASK-007
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck && pnpm --filter sdd-studio-web e2e`. Chequeo visual en el navegador: claro y oscuro a 1280×700 y 1440×860, escala tipográfica de RNF-1 (título de panel 16 semibold, grupos 13, ítems 14 en filas de 28px con ícono 16, metadatos 11, etiquetas del riel 11), sin scroll horizontal ni texto mayor que su contexto; comparar los nodos con la captura previa
**Criterio de done:**

- [ ] AgentNode y AgentMapCanvas sin diferencias visuales ni de interacción
- [ ] Cada filtro muestra su cantidad y estado vacío propio
- [ ] Compuertas y documentos siguen disponibles; e2e verde
- [ ] Chequeo visual hecho

### TASK-021: Web: módulo Actividad, filtros por origen y línea de tiempo

**Historia:** US-1-001
**App:** apps/studio
**Descripción:** Panel de Actividad con filtros por origen (specs, fixes, agentes, herramientas) y buscador por texto y origen; centro con línea de tiempo del proyecto, sin panel derecho propio salvo que architect.md decida otra cosa. Estados de carga, vacío y error.
**Archivos:** `apps/studio/src/components/shell/activity/ActivityPanel.tsx`, `apps/studio/src/components/shell/activity/ActivityTimeline.tsx`, `apps/studio/src/components/shell/activity/ActivityPanel.spec.tsx`
**CA cubiertos:** CA-001, CA-012, CA-130, RN-2
**Estimación:** 4h · **Story points:** 3
**Dependencias:** TASK-010, TASK-011, TASK-007
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`. Chequeo visual en el navegador: claro y oscuro a 1280×700 y 1440×860, escala tipográfica de RNF-1 (título de panel 16 semibold, grupos 13, ítems 14 en filas de 28px con ícono 16, metadatos 11, etiquetas del riel 11), sin scroll horizontal ni texto mayor que su contexto
**Criterio de done:**

- [ ] Filtros por origen limitan la línea de tiempo
- [ ] Sin eventos, estado vacío explicativo
- [ ] Specs verdes y chequeo visual hecho

### TASK-022: Web: módulo Kit, secciones Skills, Prompts, Agentes del kit y Documentación

**Historia:** US-7-001
**App:** apps/studio
**Descripción:** Panel del Kit con las ocho secciones y cantidades, centro con contenido de solo lectura sin panel derecho y ancho completo. Implementar Skills, Prompts y Agentes del kit (desde el snapshot y contenido bajo demanda), y Documentación por idioma de la UI con aviso de idioma; reutilizar el render del visor de documentos. Carga, vacío y error por elemento; aviso de función no disponible con puente anterior conservando lo que el snapshot ya trae.
**Archivos:** `apps/studio/src/components/shell/kit/KitPanel.tsx`, `apps/studio/src/components/shell/kit/KitContentView.tsx`, `apps/studio/src/components/shell/kit/KitPanel.spec.tsx`
**CA cubiertos:** CA-088..CA-091, CA-095..CA-101
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-004, TASK-010, TASK-011
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`. Chequeo visual en el navegador: claro y oscuro a 1280×700 y 1440×860, escala tipográfica de RNF-1 (título de panel 16 semibold, grupos 13, ítems 14 en filas de 28px con ícono 16, metadatos 11, etiquetas del riel 11), sin scroll horizontal ni texto mayor que su contexto
**Criterio de done:**

- [ ] Sin controles de edición en ninguna sección
- [ ] Con puente anterior, aviso específico y secciones del snapshot disponibles
- [ ] Specs verdes y chequeo visual hecho

### TASK-023: Web: Kit, secciones Schemas JSON, Contexto y Memoria

**Historia:** US-7-001
**App:** apps/studio
**Descripción:** Schemas JSON con contenido formateado, Contexto con constitution y context_prompt globales y por subproyecto distinguiendo base y fragmentos updates en orden de nombre, y Memoria con lessons y entradas del journal. Buscador por nombre de archivo. Error acotado a un elemento ilegible o demasiado grande y estados vacíos.
**Archivos:** `apps/studio/src/components/shell/kit/KitSchemasSection.tsx`, `apps/studio/src/components/shell/kit/KitContextSection.tsx`, `apps/studio/src/components/shell/kit/KitMemorySection.tsx`, `apps/studio/src/components/shell/kit/KitSections.spec.tsx`
**CA cubiertos:** CA-092..CA-095, CA-098, CA-099
**Estimación:** 5h · **Story points:** 3
**Dependencias:** TASK-022
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`. Chequeo visual en el navegador: claro y oscuro a 1280×700 y 1440×860, escala tipográfica de RNF-1 (título de panel 16 semibold, grupos 13, ítems 14 en filas de 28px con ícono 16, metadatos 11, etiquetas del riel 11), sin scroll horizontal ni texto mayor que su contexto
**Criterio de done:**

- [ ] Base y fragmentos claramente diferenciados
- [ ] Journal vacío: estado vacío explicativo
- [ ] Specs verdes y chequeo visual hecho

### TASK-024: Web: Kit, Herramientas con confirmación, registro en #general y chip del gate

**Historia:** US-8-001
**App:** apps/studio
**Descripción:** Sección Herramientas con tres controles (rtk, mod de Claude Code, modo del SPEC GATE) con estado leído de tools.json, diálogo de confirmación (herramienta, valor actual y nuevo, archivo afectado, advertencia del efecto), control deshabilitado con progreso en curso, vuelta al valor anterior con motivo si falla, solo lectura con aviso si el puente no soporta escribir, reflejo de cambios externos y chip del SPEC GATE actualizado. El cambio exitoso se ve en #general.
**Archivos:** `apps/studio/src/components/shell/kit/KitToolsSection.tsx`, `apps/studio/src/components/shell/kit/ToolChangeDialog.tsx`, `apps/studio/src/components/StudioHeader.tsx`, `apps/studio/src/components/shell/kit/KitToolsSection.spec.tsx`
**CA cubiertos:** CA-102..CA-113
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-006, TASK-023, TASK-014
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`. Chequeo visual en el navegador: claro y oscuro a 1280×700 y 1440×860, escala tipográfica de RNF-1 (título de panel 16 semibold, grupos 13, ítems 14 en filas de 28px con ícono 16, metadatos 11, etiquetas del riel 11), sin scroll horizontal ni texto mayor que su contexto
**Criterio de done:**

- [ ] Sin confirmar no se escribe nada; Escape cancela y deja el valor previo
- [ ] Nuevo valor solo cuando el puente confirma; fallo restaura y no deja registro
- [ ] Puente sin la capacidad: controles en solo lectura con aviso
- [ ] Specs verdes y chequeo visual hecho

### TASK-025: Web: módulo Arquitectura

**Historia:** US-9-001
**App:** apps/studio
**Descripción:** Panel con Base de datos, API y Componentes y sus cantidades; centro de solo lectura con tablas y columnas, endpoints agrupados con método y ruta, y componentes con subproyecto. Buscador por tabla, ruta o método y componente. Sin panel derecho, estados de carga, vacío y error acotado, y aviso de puente anterior.
**Archivos:** `apps/studio/src/components/shell/architecture/ArchitecturePanel.tsx`, `apps/studio/src/components/shell/architecture/ArchitectureViews.tsx`, `apps/studio/src/components/shell/architecture/ArchitecturePanel.spec.tsx`
**CA cubiertos:** CA-114..CA-119
**Estimación:** 5h · **Story points:** 3
**Dependencias:** TASK-004, TASK-010, TASK-011
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`. Chequeo visual en el navegador: claro y oscuro a 1280×700 y 1440×860, escala tipográfica de RNF-1 (título de panel 16 semibold, grupos 13, ítems 14 en filas de 28px con ícono 16, metadatos 11, etiquetas del riel 11), sin scroll horizontal ni texto mayor que su contexto
**Criterio de done:**

- [ ] Registro vacío y archivo inválido se distinguen con su estado propio
- [ ] Sin panel derecho y centro a todo el ancho
- [ ] Specs verdes y chequeo visual hecho

### TASK-026: Web: módulo Métricas, Dashboard, Planificación, Ecosistema y Telemetría

**Historia:** US-10-001
**App:** apps/studio
**Descripción:** Panel de Métricas con las cinco vistas; centro sin panel derecho. Dashboard (specs por estado, ciclos en curso, avance de tareas, fixes abiertos) y Planificación con los mismos datos que el visor del kit. Ecosistema y Telemetría reubican EcosystemDashboard y LiveTelemetryHUD sin cambiar su contenido. Estados de carga, vacío y error por vista.
**Archivos:** `apps/studio/src/components/shell/metrics/MetricsPanel.tsx`, `apps/studio/src/components/shell/metrics/DashboardView.tsx`, `apps/studio/src/components/shell/metrics/PlanningView.tsx`, `apps/studio/src/components/mission-control/EcosystemDashboard.tsx`, `apps/studio/src/components/mission-control/LiveTelemetryHUD.tsx`, `apps/studio/src/components/shell/metrics/MetricsPanel.spec.tsx`
**CA cubiertos:** CA-120..CA-122, CA-124..CA-126
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-010, TASK-011, TASK-007
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`. Chequeo visual en el navegador: claro y oscuro a 1280×700 y 1440×860, escala tipográfica de RNF-1 (título de panel 16 semibold, grupos 13, ítems 14 en filas de 28px con ícono 16, metadatos 11, etiquetas del riel 11), sin scroll horizontal ni texto mayor que su contexto
**Criterio de done:**

- [ ] Ecosistema y Telemetría conservan su contenido anterior
- [ ] Cada vista tiene carga, vacío y error propios
- [ ] Specs verdes y chequeo visual hecho

### TASK-027: Web: Métricas, vista Costos con RTK

**Historia:** US-10-001
**App:** apps/studio
**Descripción:** Costos con RTK: consumo y costo por agente, modelo y ciclo desde los precios del snapshot, ahorro estimado atribuible a rtk, valores estimados indicados como tales. Sin pricing (nulo) muestra estado vacío explicando que faltan tarifas, nunca ceros ni NaN. Formato de números según idioma.
**Archivos:** `apps/studio/src/components/shell/metrics/CostsView.tsx`, `apps/studio/src/lib/metrics/costs.ts`, `apps/studio/src/lib/metrics/costs.spec.ts`
**CA cubiertos:** CA-123, CA-126, CA-127
**Estimación:** 4h · **Story points:** 3
**Dependencias:** TASK-026
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`. Chequeo visual en el navegador: claro y oscuro a 1280×700 y 1440×860, escala tipográfica de RNF-1 (título de panel 16 semibold, grupos 13, ítems 14 en filas de 28px con ícono 16, metadatos 11, etiquetas del riel 11), sin scroll horizontal ni texto mayor que su contexto
**Criterio de done:**

- [ ] Sin pricing: estado vacío, sin NaN
- [ ] Valores estimados rotulados como estimados
- [ ] Specs verdes y chequeo visual hecho

### TASK-028: Web: limpieza del sidebar anterior, pestañas e i18n y cierre del layout

**Historia:** US-1-001, US-X-001
**App:** apps/studio
**Descripción:** Eliminar el Sidebar con árbol, las pestañas de vistas y los puentes temporales de los slots, reutilizando lo que se haya migrado; podar textos de i18n sin uso; revisar que toda cadena nueva exista en español e inglés con fechas y cantidades del idioma; probar web nueva con puente anterior y puente nuevo con web anterior. Ajustar e2e al estado final.
**Archivos:** `apps/studio/src/components/workspace/`, `apps/studio/src/components/WorkspaceApp.tsx`, `apps/studio/src/lib/i18n/`, `apps/studio/e2e/studio.e2e.ts`
**CA cubiertos:** CA-006, CA-007, CA-128, CA-129, CA-132, CA-133
**Estimación:** 5h · **Story points:** 3
**Dependencias:** TASK-012, TASK-013, TASK-014, TASK-017, TASK-018, TASK-019, TASK-020, TASK-021, TASK-024, TASK-025, TASK-026, TASK-027
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck && pnpm --filter sdd-studio-web e2e`. Chequeo visual en el navegador: claro y oscuro a 1280×700 y 1440×860, escala tipográfica de RNF-1 (título de panel 16 semibold, grupos 13, ítems 14 en filas de 28px con ícono 16, metadatos 11, etiquetas del riel 11), sin scroll horizontal ni texto mayor que su contexto
**Criterio de done:**

- [ ] Sin referencias al sidebar anterior ni a las pestañas de vistas
- [ ] Cada texto nuevo en español e inglés
- [ ] Compatibilidad web/puente de versiones distintas verificada
- [ ] Specs y e2e verdes

## Task integral

### TASK-029: Integral: verificación del workspace, recorrida visual y cierre

**Historia:** US-1-001, US-X-001
**App:** libs/studio-protocol, apps/studio-bridge, apps/studio
**Descripción:** Verificación final de los tres subproyectos, recorrida visual de los nueve módulos en claro y oscuro a 1280×700 y 1440×860 con la escala tipográfica, y limpieza de residuos (sin apps/studio/next-env.d.ts en el diff).
**Archivos:** ninguno (verificación)
**CA cubiertos:** CA-133, RNF-9
**Estimación:** 3h · **Story points:** 2
**Dependencias:** TASK-028
**Verificación:** `pnpm build && pnpm typecheck && pnpm test && pnpm --filter sdd-studio-web e2e && pnpm sdd:validate`
**Criterio de done:**

- [ ] pnpm build, typecheck y test en verde
- [ ] e2e de Studio verde
- [ ] Recorrida visual de los nueve módulos hecha en claro y oscuro
- [ ] Sin residuos en el diff
