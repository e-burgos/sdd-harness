# Functional — Cycle 1: studio-dual-sidebar

> **Input:** sdd/specs/spec-e-burgos-010-studio-dual-sidebar/cycles/cycle-01/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-010-studio-dual-sidebar/cycles/cycle-01/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

SDD Studio es la interfaz web donde el dev conversa con agentes, sigue specs, ciclos y fixes, y ve el mapa de agentes. Hoy navega con pestañas en el header (Workspace, Agent Map, Ecosystem, Telemetry) y un sidebar único con un árbol largo. Dos problemas concretos:

- **Navegación pesada.** Para llegar a una spec, un fix o una conversación hay que recorrer un árbol enorme, y las vistas viven en dos lugares distintos (pestañas arriba, árbol a la izquierda).
- **Información que Studio no muestra.** Lo que trae el kit (documentación, schemas JSON, contexto, memoria, herramientas, arquitectura) solo se ve en el visor `pnpm sdd:docs`. Y las herramientas auxiliares del kit (rtk, mod de Claude Code, modo del SPEC GATE) solo se cambian por consola.

Este ciclo reemplaza esa navegación por un **doble sidebar estilo Slack**: un riel angosto de módulos y, al lado, un panel con la lista del módulo elegido. Cada módulo tiene su vista central y, en cinco de ellos, un panel derecho. Además Studio pasa a mostrar los contenidos del kit en solo lectura y a permitir prender y apagar las herramientas del kit con confirmación.

Es una evolución de lo que ya existe: los datos del snapshot (specs, ciclos, tareas, fixes, agentes, skills, modo del gate, precios) alimentan los módulos nuevos, y el mapa de agentes conserva sus nodos tal cual.

**Fuera de alcance:** editar documentos, schemas, contexto o memoria desde Studio (la única escritura es `sdd/tools.json`); migrar los modales a `SplitModal` (salvo que tucu-ui 3.7.0 esté publicada y entre sin riesgo); mensajes sin leer; vista mobile dedicada (solo se pide que riel y panel no se rompan en pantallas chicas).

## Mapa de módulos

| Módulo       | Panel (lista)                                              | Centro                                   | Panel derecho                          |
| ------------ | ---------------------------------------------------------- | ---------------------------------------- | -------------------------------------- |
| Inicio       | En curso, Por aprobar, canales, conversaciones, agentes    | Canal o conversación elegida             | Sí (actividad y detalles del elemento) |
| Specs        | Specs agrupadas por estado, con filtros                    | Ficha de la spec con cinco pestañas      | Sí (Actividad y Detalles)              |
| Fixes        | Fixes agrupados por estado y severidad                     | Ficha del fix                            | Sí                                     |
| Agentes      | Lista de agentes                                           | Presencia / conversaciones del agente    | Sí (ficha del agente con chat directo) |
| Actividad    | Filtros de actividad                                       | Línea de tiempo de actividad del proyecto| No definido por la spec (ver preguntas)|
| Mapa         | Conversaciones, nueva conversación y filtros               | Mapa de agentes                          | Sí (interacción del enjambre y ficha)  |
| Kit          | Secciones del kit                                          | Contenido de la sección                  | No                                     |
| Arquitectura | Schema de base de datos, API, Componentes                  | Contenido de la sección                  | No                                     |
| Métricas     | Dashboard, Planificación, Costos con RTK, Ecosistema, Telemetría | Vista elegida                      | No                                     |

## Historias de usuario

### US-1-001: Riel de módulos y panel de lista

**Como** dev
**Quiero** un riel de módulos a la izquierda y, junto a él, un panel con la lista del módulo elegido
**Para** moverme entre áreas de Studio sin recorrer un árbol enorme

**Trazabilidad:** US-1, CA-1 de la spec.
**Prioridad:** Alta · **Estimación:** XL

**Criterios de aceptación:**

- [ ] CA-001: El riel muestra, de arriba hacia abajo: el proyecto; los módulos Inicio, Specs, Fixes, Agentes, Actividad, Mapa, Kit, Arquitectura y Métricas; "Más"; y, al pie, nueva conversación y la cuenta con el punto de estado de conexión.
- [ ] CA-002: Cada ítem del riel muestra un ícono y una etiqueta corta debajo; el módulo activo se distingue claramente de los demás (más allá del color: forma o indicador).
- [ ] CA-003: Elegir un módulo abre en el panel la lista de ese módulo y en el centro su vista; el panel y el centro nunca quedan en módulos distintos.
- [ ] CA-004: El panel muestra arriba el título del módulo y sus acciones o menú, debajo el buscador (atajo ⌘K / Ctrl+K) y luego los grupos colapsables separados por líneas finas.
- [ ] CA-005: Colapsar o expandir un grupo no altera el filtro del buscador ni la selección; el estado de colapso se conserva mientras se navega entre módulos y se vuelve a ellos en la misma sesión.
- [ ] CA-006: El header superior ya no tiene las pestañas de vistas (Workspace, Agent Map, Ecosystem, Telemetry) y conserva el chip del SPEC GATE, el estado del equipo, el selector de idioma y el modo claro/oscuro.
- [ ] CA-007: El sidebar único con árbol y las pestañas anteriores dejan de existir como navegación; todo lo que se alcanzaba desde ahí se alcanza desde algún módulo (ver Reglas de negocio, tabla de equivalencias).
- [ ] CA-008: Con la navegación por teclado se puede recorrer el riel, la lista del panel y los grupos, y cada ítem tiene nombre accesible (también en el riel, donde la etiqueta es corta).
- [ ] CA-009: Con un viewport angosto, riel y panel no rompen el layout ni producen scroll horizontal de la página (degradan sin vista mobile dedicada).
- [ ] CA-010: Al recargar la página con una selección activa (módulo y elemento), Studio vuelve a ese módulo y elemento si todavía existen; si no existen, cae en Inicio sin error.

### US-1-002: Buscador ⌘K por módulo

**Como** dev
**Quiero** que el buscador del panel filtre solo el contenido del módulo en el que estoy
**Para** encontrar rápido un elemento sin ruido de otros módulos

**Trazabilidad:** US-1.
**Prioridad:** Alta · **Estimación:** M

**Criterios de aceptación:**

- [ ] CA-011: ⌘K (Ctrl+K en Windows/Linux) lleva el foco al buscador del panel del módulo activo, desde cualquier punto de la pantalla que no esté capturando ese atajo.
- [ ] CA-012: El filtro actúa sobre los elementos del módulo activo según la tabla de campos de búsqueda de Reglas de negocio; no mezcla resultados de otros módulos.
- [ ] CA-013: El filtro no distingue mayúsculas ni tildes, y se aplica a medida que se escribe.
- [ ] CA-014: Con texto en el buscador, los grupos sin coincidencias se ocultan y los que tienen coincidencias se muestran expandidos, sin perder el estado de colapso guardado una vez que se borra el texto.
- [ ] CA-015: Si no hay coincidencias, el panel muestra un estado vacío que dice que no hay resultados para ese texto y ofrece limpiar el filtro.
- [ ] CA-016: El texto del buscador es propio de cada módulo: al cambiar de módulo y volver, el buscador del módulo anterior queda como se lo dejó o vacío (se define una sola conducta para todos los módulos), nunca arrastra el texto de otro módulo.
- [ ] CA-017: Escape con el foco en el buscador limpia el texto; un segundo Escape devuelve el foco a la lista.

### US-2-001: Riel personalizable

**Como** dev
**Quiero** ocultar y reordenar los módulos del riel y encontrar los ocultos en "Más"
**Para** dejar a mano solo los módulos que uso

**Trazabilidad:** US-2, CA-2 de la spec.
**Prioridad:** Media · **Estimación:** M

**Criterios de aceptación:**

- [ ] CA-018: El dev puede abrir un modo o menú de personalización del riel desde "Más" (o desde el título del riel) donde ve todos los módulos, con su estado visible/oculto y su orden.
- [ ] CA-019: Ocultar un módulo lo saca del riel y lo lista en "Más"; elegirlo desde "Más" abre ese módulo con su panel y centro.
- [ ] CA-020: Reordenar módulos cambia su orden en el riel de inmediato; el reordenamiento funciona con mouse y con teclado.
- [ ] CA-021: El dev puede restablecer el riel al orden y visibilidad por defecto con una sola acción.
- [ ] CA-022: La personalización persiste tras recargar la página y se guarda por proyecto: dos proyectos distintos conservan cada uno su propio riel.
- [ ] CA-023: Un proyecto sin personalización guardada ve el riel por defecto (todos los módulos, en el orden de CA-001).
- [ ] CA-024: Si el almacenamiento local no está disponible o la preferencia guardada es inválida o antigua (por ejemplo, referencia un módulo que ya no existe o falta uno nuevo), Studio usa el riel por defecto sin error; un módulo nuevo que no está en la preferencia guardada aparece en "Más" o al final, nunca desaparece.
- [ ] CA-025: Si el módulo activo se oculta, el centro y el panel siguen mostrándolo (no se expulsa al dev de donde está); el módulo oculto sigue alcanzable desde "Más".
- [ ] CA-026: "Más" muestra una marca de cantidad o un indicador cuando hay módulos ocultos, y está vacío (o sin indicador) cuando no hay ninguno.
- [ ] CA-027: Inicio no puede ocultarse (siempre hay un punto de entrada); el resto sí.

### US-3-001: Inicio con accesos rápidos y canales

**Como** dev
**Quiero** abrir Inicio y ver "En curso", "Por aprobar", los canales `#general`, `#specs` y `#fixes`, mis conversaciones y los agentes con presencia
**Para** retomar lo que importa sin buscar

**Trazabilidad:** US-3, CA-3 de la spec.
**Prioridad:** Alta · **Estimación:** L

**Criterios de aceptación:**

- [ ] CA-028: El panel de Inicio muestra, en este orden: accesos "En curso" y "Por aprobar"; el grupo Canales (`#general`, `#specs`, `#fixes`); el grupo Conversaciones; el grupo Agentes.
- [ ] CA-029: "En curso" lista lo que está ejecutándose ahora: conversaciones con un agente trabajando y ciclos en estado `in-progress`; cada ítem lleva a su conversación o a su spec.
- [ ] CA-030: "Por aprobar" lista lo que espera una decisión del dev: aprobaciones y preguntas pendientes de agentes; muestra la cantidad como contador y lleva a la conversación donde está pendiente.
- [ ] CA-031: Si no hay nada en curso o por aprobar, el acceso se muestra igual con contador en cero y, al abrirlo, un estado vacío que lo dice.
- [ ] CA-032: El grupo Conversaciones tiene un filtro con dos opciones, "Solo activas" y "Mostrar todo"; por defecto muestra solo activas, y la opción elegida se conserva al recargar.
- [ ] CA-033: Una conversación activa se define como en Reglas de negocio (RN-6); el filtro no oculta nunca una conversación que esté en curso o por aprobar.
- [ ] CA-034: Cada conversación muestra su título (el real si existe, el mismo criterio de "sin título disponible" ya vigente), un indicador de estado (en curso, por aprobar, lista) y metadatos en tamaño meta (11).
- [ ] CA-035: El grupo Agentes lista los agentes con su indicador de presencia (activo o inactivo) y elegirlo lleva a su ficha (ver US-5-002).
- [ ] CA-036: El botón "nueva conversación" del riel y el menú del panel de Inicio crean una conversación nueva y la abren en el centro.
- [ ] CA-037: `#general` muestra en el centro la actividad general del proyecto, incluidos los registros de cambios de herramientas del kit (US-8-001).
- [ ] CA-038: El panel derecho de Inicio muestra, para el elemento elegido, su actividad y sus detalles; sin elemento elegido muestra un estado vacío que invita a elegir uno.

### US-3-002: Canales `#specs` y `#fixes` con resumen

**Como** dev
**Quiero** que `#specs` y `#fixes` muestren arriba un resumen de todas las specs o todos los fixes y debajo su actividad y conversaciones
**Para** tener una foto del proyecto y su movimiento en un solo lugar

**Trazabilidad:** US-3, CA-3 de la spec.
**Prioridad:** Alta · **Estimación:** M

**Criterios de aceptación:**

- [ ] CA-039: `#specs` muestra arriba un resumen con una fila por spec del proyecto, con datos reales del snapshot: título (e id), estado, ciclo actual, flow del ciclo y progreso (tareas hechas sobre total).
- [ ] CA-040: `#fixes` muestra arriba un resumen con una fila por fix del proyecto: título (e id), severidad y estado.
- [ ] CA-041: Cada fila del resumen es accionable: una fila de `#specs` abre la ficha de esa spec en el módulo Specs; una fila de `#fixes` abre la ficha de ese fix en el módulo Fixes.
- [ ] CA-042: Debajo del resumen, `#specs` muestra la actividad reunida de todas las specs (más reciente primero) y las conversaciones asociadas a cualquier spec; `#fixes` hace lo mismo para los fixes.
- [ ] CA-043: El resumen refleja los cambios del snapshot sin recargar (por ejemplo, una tarea que pasa a hecha actualiza el progreso).
- [ ] CA-044: Un proyecto sin specs (o sin fixes) muestra un estado vacío en el resumen que lo explica, y el resto del canal sigue funcionando.
- [ ] CA-045: Una spec sin ciclo muestra "sin ciclo" en lugar de ciclo y flow, y un progreso en cero sobre cero indicado como "sin tareas" (nunca "0%" engañoso ni división por cero).
- [ ] CA-046: Un fix sin severidad registrada la muestra como "sin severidad".

### US-4-001: Módulo Specs — panel con filtros y grupos

**Como** dev
**Quiero** que el panel de Specs me deje filtrar y agrupar las specs por estado
**Para** ubicar rápido la spec que busco

**Trazabilidad:** US-4, CA-3/CA-4 de la spec.
**Prioridad:** Alta · **Estimación:** M

**Criterios de aceptación:**

- [ ] CA-047: El panel de Specs tiene el buscador (campos según Reglas de negocio) y tres filtros: Activas, Todas y Cerradas.
- [ ] CA-048: Por defecto el filtro es Activas; la opción elegida se conserva al recargar.
- [ ] CA-049: "Activa" para una spec se define como en Reglas de negocio (RN-5); "Cerradas" lista las completadas; "Todas" lista todas.
- [ ] CA-050: Las specs se agrupan por estado (por ejemplo En curso, Planificada, Completada), cada grupo colapsable y con su cantidad.
- [ ] CA-051: Cada fila muestra el título, el ciclo actual, el flow (full / reduced / lite) y el progreso (tareas hechas sobre total), con metadatos en tamaño meta (11).
- [ ] CA-052: Si no hay specs en el filtro elegido se muestra un estado vacío específico del filtro ("no hay specs activas", etc.); si el proyecto no tiene ninguna, el estado vacío lo dice y no ofrece cambiar de filtro.
- [ ] CA-053: Elegir una spec abre su ficha en el centro y el panel derecho con Actividad y Detalles.

### US-4-002: Ficha de spec con cinco pestañas

**Como** dev
**Quiero** que la ficha de la spec muestre sus datos en las pestañas Resumen, Plan, Tareas, Documentos y Conversaciones
**Para** entender el estado de una spec y abrir sus documentos sin ir al visor del kit

**Trazabilidad:** US-4, CA-4 de la spec.
**Prioridad:** Alta · **Estimación:** XL

**Criterios de aceptación:**

- [ ] CA-054: La ficha muestra un encabezado con el título de la spec, su estado y el ciclo actual, y las pestañas Resumen · Plan · Tareas · Documentos · Conversaciones; la pestaña activa por defecto es Resumen.
- [ ] CA-055: **Resumen** muestra: ciclo actual y su flow, tareas (hechas sobre total), estado del gate, lista de ciclos con su estado, dependencias (con acceso a cada spec de la que depende), subproyecto (app o lib), fixes vinculados (con acceso a cada uno) y las tareas del ciclo actual.
- [ ] CA-056: **Plan** muestra el plan del ciclo según su flow: en un ciclo `lite`, el contenido de `plan.md`; en un ciclo `full` o `reduced`, los documentos `functional.md`, `planner.md` y `architect.md` (los que existan), cada uno accesible por separado.
- [ ] CA-057: En la pestaña Plan, un documento que todavía no existe en el ciclo se lista como "pendiente", sin error y sin enlace roto; si el ciclo no tiene ningún documento de plan, un estado vacío lo explica.
- [ ] CA-058: Plan permite abrir cada documento en el visor de documentos existente de Studio; abrir un documento no cambia la pestaña ni la selección.
- [ ] CA-059: **Tareas** lista las tareas del ciclo actual con id, título, estado y puntos, agrupadas por estado; si el ciclo tiene más de uno, el dev puede elegir de qué ciclo ver las tareas (por defecto el actual).
- [ ] CA-060: **Documentos** lista todos los documentos de la spec (la spec, los de cada ciclo y los artefactos) agrupados por ciclo, y permite abrir cada uno en el visor de documentos.
- [ ] CA-061: **Conversaciones** lista las conversaciones asociadas a la spec (directa o por alguno de sus ciclos) con título, estado y última actividad; elegir una la abre en el centro; sin conversaciones muestra un estado vacío con acceso a iniciar una.
- [ ] CA-062: El panel derecho muestra **Actividad** (eventos recientes de la spec, más reciente primero) y **Detalles** (identificador, carpeta, módulo, app, dependencias).
- [ ] CA-063: Una spec cuyo ciclo no se pudo leer o cuyos datos faltan muestra en la pestaña afectada un estado de error acotado a esa pestaña; las demás pestañas siguen operativas.
- [ ] CA-064: Cambiar de spec en el panel mantiene la pestaña activa si existe para la nueva spec, y cae en Resumen si no.
- [ ] CA-065: Los datos de la ficha se actualizan sin recargar cuando cambia el snapshot (estado, tareas, ciclos).

### US-5-001: Módulo Fixes

**Como** dev
**Quiero** ver los fixes agrupados por estado y severidad y abrir la ficha de cada uno
**Para** seguir correcciones fuera del ciclo SDD

**Trazabilidad:** US-5, CA-3 de la spec.
**Prioridad:** Media · **Estimación:** M

**Criterios de aceptación:**

- [ ] CA-066: El panel de Fixes agrupa los fixes por estado, y dentro de cada grupo los ordena de mayor a menor severidad y luego del más reciente al más antiguo.
- [ ] CA-067: Cada fila muestra el id, el título, la severidad y el estado; el buscador filtra según Reglas de negocio.
- [ ] CA-068: La ficha del fix muestra título, id, estado, severidad, spec vinculada (con acceso a ella si existe), fecha de creación y de cierre, y los documentos del fix si los hay (abribles en el visor).
- [ ] CA-069: El panel derecho de Fixes muestra la actividad y los detalles del fix elegido; las conversaciones asociadas se listan en la ficha.
- [ ] CA-070: Un proyecto sin fixes muestra un estado vacío explicativo; un fix que apunta a una spec que ya no existe muestra el vínculo como "no disponible" sin romper la ficha.

### US-5-002: Módulo Agentes y ficha de agente con chat directo

**Como** dev
**Quiero** ver la lista de agentes y, al elegir uno, su ficha a la derecha con chat directo, la misma ficha que usa el mapa
**Para** hablar con un agente puntual sin pasar por el mapa

**Trazabilidad:** US-5, CA-5 de la spec.
**Prioridad:** Alta · **Estimación:** L

**Criterios de aceptación:**

- [ ] CA-071: El panel de Agentes lista los agentes del snapshot agrupados por origen (agentes del proyecto / agentes del kit), con su descripción corta y modelo cuando existen, y el indicador de presencia.
- [ ] CA-072: Elegir un agente abre su ficha en el panel derecho, con su presencia, su descripción, el modelo, el origen y la ruta de su definición, y el chat directo con ese agente.
- [ ] CA-073: El chat directo permite enviar un mensaje al agente y ver su respuesta con la misma conducta que el chat de la ficha del mapa (misma ficha, un solo componente funcional compartido por Agentes y Mapa).
- [ ] CA-074: La ficha de agente es idéntica en contenido y comportamiento se abra desde Agentes o desde el Mapa; una acción hecha en una se refleja en la otra (por ejemplo, la conversación iniciada desde la ficha aparece en ambos lados).
- [ ] CA-075: El buscador filtra por nombre y descripción del agente.
- [ ] CA-076: El centro del módulo Agentes muestra, para el agente elegido, sus conversaciones; sin agente elegido, un estado vacío invita a elegir uno.
- [ ] CA-077: Si el puente no está conectado o no soporta chat directo, el chat se muestra deshabilitado con el motivo, y la ficha sigue mostrando los datos del agente.
- [ ] CA-078: Un proyecto sin agentes muestra un estado vacío explicativo.

### US-6-001: Mapa en tres columnas

**Como** dev
**Quiero** el módulo Mapa con conversaciones y filtros en el panel, el mapa de agentes al centro y a la derecha la interacción del enjambre y la ficha del agente seleccionado
**Para** operar el enjambre de agentes con todo el contexto a la vista

**Trazabilidad:** US-6, CA-5 de la spec.
**Prioridad:** Alta · **Estimación:** L

**Criterios de aceptación:**

- [ ] CA-079: El panel del Mapa muestra el botón nueva conversación, el selector de conversaciones y los filtros Todas, Transversal, Por ciclo, En ejecución y Listas.
- [ ] CA-080: Cada filtro limita las conversaciones del panel como sigue: Todas, sin restricción; Transversal, las que no están asociadas a un ciclo ni a un fix concretos; Por ciclo, las asociadas a algún ciclo (con agrupación por ciclo); En ejecución, las que tienen un agente trabajando; Listas, las que terminaron y esperan revisión del dev. Cada filtro muestra su cantidad.
- [ ] CA-081: Elegir una conversación la selecciona en el mapa y en el panel derecho, con la misma conducta que hoy.
- [ ] CA-082: El mapa de agentes al centro conserva los nodos (AgentNode) y el lienzo (AgentMapCanvas) tal como están hoy: apariencia, interacciones (selección, arrastre, zoom, resaltado) y estados; solo se admiten mejoras claras que no los rediseñen.
- [ ] CA-083: El panel derecho muestra la interacción del enjambre (comunicación entre agentes, en vivo) y, al seleccionar un agente en el mapa o en el panel, su ficha con chat directo (la misma de US-5-002).
- [ ] CA-084: Sin agente seleccionado, el panel derecho muestra solo la interacción del enjambre, con un indicio de cómo seleccionar un agente.
- [ ] CA-085: Un filtro sin resultados muestra un estado vacío propio ("no hay conversaciones en ejecución", etc.).
- [ ] CA-086: Todas las funciones del mapa actual que no se mencionan aquí (por ejemplo, inspección de compuertas del SPEC GATE y de documentos) siguen disponibles.
- [ ] CA-087: El buscador del panel del Mapa filtra las conversaciones por título y por elementos asociados (spec, ciclo, fix).

### US-7-001: Módulo Kit — navegación y contenido

**Como** dev
**Quiero** ver desde Studio lo que trae el kit: skills, prompts, agentes del kit, herramientas, documentación, schemas JSON, contexto y memoria
**Para** consultar el kit sin abrir el visor `pnpm sdd:docs`

**Trazabilidad:** US-7, CA-6 de la spec.
**Prioridad:** Alta · **Estimación:** XL

**Criterios de aceptación:**

- [ ] CA-088: El panel del Kit lista las secciones Skills, Prompts, Agentes del kit, Herramientas, Documentación, Schemas JSON, Contexto y Memoria, cada una con la cantidad de elementos cuando aplica.
- [ ] CA-089: **Skills** y **Prompts** listan los elementos del kit con nombre y descripción, y al elegir uno el centro muestra su contenido en solo lectura.
- [ ] CA-090: **Agentes del kit** lista los agentes de origen kit con descripción y modelo, y al elegir uno el centro muestra su definición en solo lectura (sin chat: el chat vive en el módulo Agentes).
- [ ] CA-091: **Documentación** ofrece README, cómo usar SDD, e instalar y actualizar, en el idioma de la UI (español o inglés); si no hay versión en el idioma de la UI se muestra la disponible con un aviso de idioma.
- [ ] CA-092: **Schemas JSON** lista los schemas de `sdd/schemas/` y al elegir uno el centro muestra su contenido formateado en solo lectura.
- [ ] CA-093: **Contexto** muestra la constitution y el context_prompt globales y los de cada subproyecto (apps, libs, tools), y para cada uno sus fragmentos `updates/` vigentes en orden de nombre, distinguiendo con claridad el archivo base de los fragmentos.
- [ ] CA-094: **Memoria** muestra `lessons` y la lista del `journal`, y al elegir una entrada del journal muestra su contenido.
- [ ] CA-095: Los documentos se muestran con el mismo render que el visor de documentos de Studio (Markdown formateado, JSON legible); todo es de solo lectura, sin controles de edición en ninguna sección.
- [ ] CA-096: El buscador del Kit filtra los elementos de la sección activa según Reglas de negocio.
- [ ] CA-097: El módulo Kit no tiene panel derecho; el centro usa todo el ancho disponible.
- [ ] CA-098: Un archivo que falta, es ilegible o excede el tamaño soportado se muestra como un estado de error acotado a ese elemento ("no se pudo leer"), con el motivo cuando se conoce, sin afectar al resto de la sección.
- [ ] CA-099: Una sección vacía (por ejemplo, un proyecto sin entradas en el journal) muestra un estado vacío que lo explica.
- [ ] CA-100: Mientras el contenido se está obteniendo se muestra un estado de carga en el centro; el panel y el riel siguen utilizables.
- [ ] CA-101: Si el puente conectado es anterior y no entrega datos del kit, el módulo Kit muestra un aviso de que la función no está disponible con ese puente (no un error genérico) y conserva las secciones que sí puede mostrar (skills, prompts y agentes, que ya vienen en el snapshot).

### US-8-001: Herramientas del kit desde Studio

**Como** dev
**Quiero** prender y apagar rtk y el mod de Claude Code, y cambiar el modo del SPEC GATE (block/warn), desde Studio
**Para** administrar las herramientas del kit sin ir a la consola

**Trazabilidad:** US-8, CA-7 de la spec.
**Prioridad:** Alta · **Estimación:** L

**Criterios de aceptación:**

- [ ] CA-102: La sección Herramientas del módulo Kit muestra tres controles: rtk (prendido/apagado), mod de Claude Code (prendido/apagado) y modo del SPEC GATE (block o warn), cada uno con su estado actual leído de `sdd/tools.json` y una descripción corta de qué hace.
- [ ] CA-103: Cambiar cualquiera de los tres controles abre una confirmación que dice qué se va a cambiar (herramienta, valor actual y valor nuevo) y qué archivo se modifica; sin confirmar, no se escribe nada.
- [ ] CA-104: Cancelar la confirmación (botón o Escape) deja el control en su valor anterior.
- [ ] CA-105: Al confirmar, el cambio se aplica con la misma semántica que `pnpm sdd:rtk -- --enable|--disable` y `pnpm sdd:mod -- --enable|--disable|--gate=warn|block` (ver RN-12), el control muestra el nuevo valor solo cuando el puente confirma que se escribió, y se indica el resultado al dev.
- [ ] CA-106: Todo cambio exitoso deja un registro visible en `#general` con qué herramienta cambió, el valor anterior, el valor nuevo y cuándo; un cambio fallido o cancelado no deja registro de cambio.
- [ ] CA-107: Si el cambio falla (archivo inválido, permiso, puente desconectado), el control vuelve a su valor anterior, se muestra el motivo del fallo y no se registra un cambio en `#general`.
- [ ] CA-108: Si el puente conectado no tiene la capacidad de escribir herramientas, los controles se muestran en solo lectura (deshabilitados, con el estado actual) y un aviso indica que el puente no lo soporta; si tampoco puede leer el estado, los controles se muestran sin valor, con ese mismo aviso.
- [ ] CA-109: Mientras un cambio está en curso, el control afectado queda deshabilitado y muestra progreso; no se pueden encolar dos cambios sobre el mismo control.
- [ ] CA-110: Si `sdd/tools.json` cambió en disco por fuera de Studio (por ejemplo, con `pnpm sdd:rtk`), los controles reflejan el nuevo estado sin recargar.
- [ ] CA-111: El chip del SPEC GATE del header refleja el modo vigente y se actualiza al cambiar el modo desde Studio.
- [ ] CA-112: Apagar o prender el mod o el gate desde Studio incluye en la confirmación la advertencia de su efecto (por ejemplo, que en modo warn el SPEC GATE deja de rechazar ediciones de código) sin pedir justificación extra.
- [ ] CA-113: Los controles de herramientas no permiten editar ningún otro campo de `sdd/tools.json` ni ningún otro archivo.

### US-9-001: Módulo Arquitectura

**Como** dev
**Quiero** ver el schema de base de datos, la API y los componentes del proyecto
**Para** consultar la arquitectura vigente como en el visor del kit

**Trazabilidad:** US-9, CA-6 de la spec.
**Prioridad:** Media · **Estimación:** M

**Criterios de aceptación:**

- [ ] CA-114: El panel de Arquitectura lista tres secciones: Base de datos (`sdd/schema.json`), API (`sdd/api.json`) y Componentes (`sdd/components.json`), cada una con su cantidad de elementos.
- [ ] CA-115: **Base de datos** muestra las tablas / entidades con sus columnas y relaciones; **API** muestra los endpoints agrupados con método, ruta y descripción; **Componentes** muestra los componentes registrados con su subproyecto y descripción, todo en solo lectura.
- [ ] CA-116: El buscador filtra los elementos de la sección activa según Reglas de negocio.
- [ ] CA-117: El módulo no tiene panel derecho; el centro usa todo el ancho.
- [ ] CA-118: Un proyecto cuyo registro está vacío (arquitectura sin tablas o sin endpoints) muestra un estado vacío que lo explica; uno cuyo archivo falta o es inválido muestra un estado de error acotado a esa sección.
- [ ] CA-119: Los estados de carga se comportan como en CA-100, y con un puente anterior se aplica el aviso de CA-101.

### US-10-001: Módulo Métricas

**Como** dev
**Quiero** el módulo Métricas con sus vistas en el panel y la vista elegida al centro
**Para** revisar planificación, costos y estado del ecosistema sin salir de Studio

**Trazabilidad:** US-10, CA-1 de la spec.
**Prioridad:** Media · **Estimación:** L

**Criterios de aceptación:**

- [ ] CA-120: El panel de Métricas lista las vistas Dashboard, Planificación, Costos con RTK, Ecosistema y Telemetría; elegir una abre su contenido en el centro y no hay panel derecho.
- [ ] CA-121: **Dashboard** resume el estado del proyecto (specs por estado, ciclos en curso, avance de tareas, fixes abiertos).
- [ ] CA-122: **Planificación** muestra specs, ciclos y tareas con su avance, con los mismos datos que el visor del kit.
- [ ] CA-123: **Costos con RTK** muestra el consumo y costo por agente, modelo y ciclo a partir de los precios del snapshot, y el ahorro estimado atribuible a rtk; indica claramente cuando un valor es estimado.
- [ ] CA-124: **Ecosistema** conserva el contenido de la vista Ecosystem actual (EcosystemDashboard).
- [ ] CA-125: **Telemetría** conserva el contenido de la vista Telemetry actual (LiveTelemetryHUD).
- [ ] CA-126: Cada vista tiene estado de carga, estado vacío (sin datos de consumo todavía, sin ciclos) y estado de error acotado a esa vista.
- [ ] CA-127: Sin datos de precios (`pricing` nulo), Costos muestra un estado vacío que explica que faltan las tarifas y no valores en cero ni NaN.

### US-X-001: Estados, idioma y diseño transversales

**Como** dev
**Quiero** que todos los módulos se comporten igual ante carga, vacío y error, en mi idioma y con la misma escala tipográfica
**Para** tener una interfaz coherente y predecible

**Trazabilidad:** US-1..US-10, CA-1, CA-8 de la spec.
**Prioridad:** Alta · **Estimación:** L

**Criterios de aceptación:**

- [ ] CA-128: Todo texto nuevo de la interfaz (etiquetas del riel, títulos de panel, grupos, filtros, estados vacíos, errores, confirmaciones, avisos) existe en español y en inglés y cambia al cambiar el idioma sin recargar.
- [ ] CA-129: Fechas, cantidades y porcentajes se muestran con el formato del idioma activo.
- [ ] CA-130: Cada panel y cada vista central tienen tres estados distinguibles: cargando (con indicador), vacío (con texto que explica por qué y, si corresponde, una acción) y error (con el motivo y, si corresponde, reintentar); un estado de error en un módulo no afecta a los demás.
- [ ] CA-131: Si el puente se desconecta, el riel y el panel siguen visibles con la última información conocida, se muestra el aviso de conexión existente y las acciones que requieren puente quedan deshabilitadas con su motivo.
- [ ] CA-132: Con una web nueva y un puente anterior, y con un puente nuevo y una web anterior, nada se rompe: lo que el puente no entrega se degrada como indican CA-101 y CA-108.
- [ ] CA-133: Los módulos y sus paneles se ven correctos en modo claro y oscuro.

## Requisitos funcionales

### RF-1-001: Navegación por módulos

**Descripción:** Studio navega con un riel de módulos y un panel de lista por módulo; el centro y el panel derecho dependen del módulo.
**Reglas de negocio:**

- RN-1: Hay exactamente nueve módulos de contenido (Inicio, Specs, Fixes, Agentes, Actividad, Mapa, Kit, Arquitectura, Métricas) más "Más"; ningún otro destino de navegación primario.
- RN-2: Panel derecho presente en Inicio, Specs, Fixes, Agentes y Mapa; ausente en Kit, Arquitectura y Métricas. El módulo Actividad no está cubierto por la spec en cuanto a panel derecho (pregunta abierta).
- RN-3: **Equivalencias con la navegación anterior.** La vista Workspace pasa a Inicio (conversaciones y canales) y a Specs/Fixes/Agentes (lo que mostraba el árbol); Agent Map pasa a Mapa; Ecosystem y Telemetry pasan a Métricas. Nada de lo accesible hoy queda inaccesible.
- RN-4: La selección (módulo y elemento) forma parte de lo que se recuerda al recargar (CA-010); no se recuerda texto del buscador entre recargas.
  **Casos de error:**
- CE-1: Si la selección guardada apunta a un elemento que ya no existe, se vuelve a Inicio o al panel del módulo sin elemento elegido, sin error visible.

### RF-1-002: Qué filtra el buscador ⌘K por módulo

**Descripción:** El buscador del panel filtra solo los elementos del módulo activo, sobre los campos que indica la tabla.
**Reglas de negocio:**

| Módulo        | Elementos filtrados                  | Campos que busca                                                      |
| ------------- | ------------------------------------ | --------------------------------------------------------------------- |
| Inicio        | Conversaciones, agentes, canales     | Título de conversación, nombre de agente, nombre de canal             |
| Specs         | Specs                                | Id, título, estado, módulo o app, nombre del ciclo actual             |
| Fixes         | Fixes                                | Id, título, severidad, estado, spec vinculada                         |
| Agentes       | Agentes                              | Nombre, descripción, modelo                                           |
| Actividad     | Filtros / eventos de actividad       | Texto del evento, origen (spec, fix, agente)                          |
| Mapa          | Conversaciones                       | Título, spec, ciclo o fix asociados                                   |
| Kit           | Elementos de la sección activa       | Nombre y descripción (skills, prompts, agentes); título (documentación); nombre de archivo (schemas, contexto, memoria) |
| Arquitectura  | Elementos de la sección activa       | Nombre de tabla/entidad, ruta o método de endpoint, nombre de componente |
| Métricas      | Vistas                               | Nombre de la vista                                                    |

- RN-4b: El filtro es de contenido ya cargado en la web; no dispara búsquedas dentro del texto completo de documentos.
  **Casos de error:**
- CE-2: Si la lista del módulo todavía no cargó, escribir en el buscador no produce error: se aplica el filtro cuando llegan los datos.

### RF-3-001: Definición de "activa" para specs y conversaciones

**Descripción:** El filtro "Activas" de Specs y el filtro "Solo activas" de las conversaciones de Inicio dependen de estas definiciones.
**Reglas de negocio:**

- RN-5: **Spec activa:** su estado es `in-progress`, o tiene al menos un ciclo en estado `in-progress`. Spec cerrada: estado `completed`. Las demás (por ejemplo, planificada o en borrador) cuentan en "Todas" y no en Activas ni Cerradas.
- RN-6: **Conversación activa:** tiene un agente trabajando, o espera una aprobación o respuesta del dev, o tuvo actividad en las últimas 24 horas y no fue archivada. Toda conversación en curso o por aprobar es siempre activa.
- RN-6b: El umbral de 24 horas es una regla de negocio provisoria; el architect confirma qué dato de actividad existe para aplicarla (pregunta abierta).
  **Casos de error:**
- CE-3: Una conversación sin dato de última actividad se considera inactiva salvo que esté en curso o por aprobar.

### RF-3-002: Construcción del resumen de `#specs` y `#fixes`

**Descripción:** Los canales `#specs` y `#fixes` abren con una tabla-resumen del proyecto completo, calculada desde el snapshot, y debajo su actividad y conversaciones.
**Reglas de negocio:**

- RN-7: El resumen de `#specs` incluye todas las specs del snapshot sin aplicar el filtro de Activas/Cerradas; ordenadas con las activas primero y luego por título. Por spec: título, estado, ciclo actual, flow, y progreso.
- RN-8: **Ciclo actual de una spec:** el ciclo en `in-progress`; si no hay, el de número más alto. **Progreso:** tareas hechas / total del ciclo actual, expresado como "N de M"; sin tareas, "sin tareas".
- RN-9: El resumen de `#fixes` incluye todos los fixes del snapshot, ordenados por severidad (mayor primero) y luego del más reciente al más antiguo. Por fix: título, severidad, estado.
- RN-10: La actividad de `#specs` reúne los eventos de todas las specs; la de `#fixes`, los de todos los fixes; en ambos casos más reciente primero.
- RN-10b: Las conversaciones del canal son las asociadas a alguna spec (o a algún fix); una conversación asociada a varias aparece una sola vez.
  **Casos de error:**
- CE-4: Un campo faltante en una fila (por ejemplo, ciclo o severidad) se muestra con un texto neutro ("sin ciclo", "sin severidad") y nunca deja la fila rota.

### RF-4-001: Ficha de spec — contenido por pestaña

**Descripción:** La ficha de spec reúne en cinco pestañas lo que el dev necesita de una spec.
**Reglas de negocio:**

- RN-11: **Plan por flow.** Un ciclo `lite` tiene un único documento de plan (`plan.md`). Un ciclo `full` tiene `functional.md`, `planner.md` y `architect.md`; un ciclo `reduced` tiene los que correspondan sin historias. La pestaña Plan muestra los documentos que el flow del ciclo elegido prevé y marca como pendiente el que aún no existe; nunca muestra a la vez `plan.md` y los tres documentos como si ambos fueran el plan de un mismo ciclo.
- RN-11b: **Alcance de cada pestaña.** Resumen: datos del snapshot, sin documentos. Plan: documentos de plan del ciclo. Tareas: tareas de un ciclo. Documentos: todo documento de la spec (spec, brief, plan, functional, planner, architect, artefactos, fixes vinculados), agrupado por ciclo. Conversaciones: hilos asociados.
- RN-11c: El ciclo mostrado en Plan y Tareas es el actual por defecto y puede cambiarse entre los ciclos de la spec.
  **Casos de error:**
- CE-5: Un ciclo sin documentos todavía (recién abierto) muestra todos los documentos de plan como "pendiente".
- CE-6: Un documento listado pero ilegible muestra error acotado a ese documento al abrirlo.

### RF-5-001: Ficha de agente compartida entre Agentes y Mapa

**Descripción:** La ficha de agente (datos, presencia y chat directo) es una sola, mostrada en el panel derecho de Agentes y de Mapa.
**Reglas de negocio:**

- RN-13: La ficha muestra siempre los mismos campos y ofrece el mismo chat directo, venga de donde venga la selección.
- RN-13b: Seleccionar un agente en el mapa, en el panel del Mapa o en la lista de Agentes lo marca como seleccionado en todos los lugares donde aparece.
- RN-13c: El chat directo de un agente es una conversación más del proyecto: aparece en la lista de conversaciones con el mismo criterio de activas.
  **Casos de error:**
- CE-7: Agente que ya no existe en el snapshot: la ficha muestra "agente no disponible" y el chat queda deshabilitado.

### RF-6-001: Filtros del Mapa

**Descripción:** Los filtros del panel del Mapa recortan las conversaciones que se listan y se resaltan.
**Reglas de negocio:**

- RN-14: Los filtros son excluyentes entre sí (uno activo a la vez); el valor por defecto es Todas.
- RN-14b: Los filtros solo afectan a la lista de conversaciones del panel; no ocultan ni mueven los nodos del mapa, que se conservan tal cual.
- RN-14c: Las definiciones de cada filtro son las de CA-080.

### RF-7-001: Secciones del Kit

**Descripción:** Cada sección del Kit presenta su contenido en solo lectura.
**Reglas de negocio:**

- RN-15: Skills, prompts, agentes del kit y herramientas son los que el repo tiene instalados; no se mezclan con los del usuario fuera de `sdd/` salvo el origen ya distinguido en el snapshot.
- RN-15b: Documentación se muestra en el idioma de la UI cuando existe (README, cómo usar SDD, instalar y actualizar); si falta, se muestra la versión disponible indicando su idioma.
- RN-15c: Contexto: el contexto vigente de un subproyecto es el archivo base más sus `updates/*.md` en orden de nombre; la sección lo muestra así y deja claro cuál es cuál. La línea "Última actualización" del base no se presenta como la verdad si hay fragmentos.
- RN-15d: Memoria: `lessons` se muestra completo; el journal se lista (nombre y fecha) y cada entrada se abre bajo demanda, nunca se vuelcan todas juntas.
- RN-15e: Ningún elemento del Kit permite edición; la única escritura de Studio sobre el repo en este ciclo es `sdd/tools.json` (US-8-001).

### RF-8-001: Cambio de herramientas del kit

**Descripción:** Studio permite cambiar tres valores de `sdd/tools.json` con confirmación y registro.
**Reglas de negocio:**

- RN-12: **Mismo efecto que la consola.** Rtk prendido/apagado equivale a `pnpm sdd:rtk -- --enable|--disable` (`rtk.enabled`); el mod equivale a `pnpm sdd:mod -- --enable|--disable` (`claude_mod.enabled`); el modo del gate equivale a `pnpm sdd:mod -- --gate=warn|block` (`claude_mod.gate`). El resultado en `sdd/tools.json` tiene que ser el mismo que el que dejaría el comando, y un cambio desde Studio y uno desde consola son intercambiables.
- RN-12b: Se pide confirmación siempre, para cualquiera de los tres controles y en cualquier dirección.
- RN-12c: Cada cambio exitoso genera un registro en `#general` (herramienta, valor anterior, valor nuevo, cuándo).
- RN-12d: Con un puente que no tiene la capacidad, los controles son de solo lectura (CA-108).
- RN-12e: Solo se pueden cambiar `rtk.enabled`, `claude_mod.enabled` y `claude_mod.gate`; el resto de `sdd/tools.json` (por ejemplo, `auto_install`, `version`, `_description`) no se toca.
  **Casos de error:**
- CE-8: `sdd/tools.json` no existe o es inválido: los controles muestran el estado desconocido, el cambio se rechaza con motivo y no se crea ni se corrige el archivo por cuenta de Studio.
- CE-9: El archivo cambió en disco entre que se abrió la confirmación y se confirmó: el cambio se rechaza con aviso y se muestra el valor actual, sin pisar la modificación externa a ciegas.

### RF-9-001: Contenido de Arquitectura

**Descripción:** El módulo muestra en solo lectura lo que registran `sdd/schema.json`, `sdd/api.json` y `sdd/components.json`.
**Reglas de negocio:**

- RN-16: Cada sección muestra únicamente lo registrado en su archivo; una sección sin registros se muestra vacía y no se completa con datos de otras fuentes.
  **Casos de error:**
- CE-10: Archivo ausente o inválido: error acotado a esa sección, las otras siguen.

### RF-10-001: Vistas de Métricas

**Descripción:** Las cinco vistas de Métricas leen datos que Studio ya recibe (snapshot, telemetría en vivo, ecosistema).
**Reglas de negocio:**

- RN-17: Las vistas Ecosistema y Telemetría conservan sus datos y comportamiento actuales, solo cambian de lugar de navegación.
- RN-17b: Los costos son estimaciones cuando la fuente del consumo es declarada y se rotulan como tales.
  **Casos de error:**
- CE-11: `pricing` nulo o consumo ausente: estado vacío explicativo (CA-127).

### RF-2-001: Persistencia del riel

**Descripción:** La personalización del riel (visibilidad y orden) se recuerda por proyecto.
**Reglas de negocio:**

- RN-18: La clave de persistencia es el proyecto; el mismo navegador con dos proyectos distintos guarda dos preferencias independientes.
- RN-18b: La preferencia es del navegador del dev; no se comparte entre dispositivos ni con el equipo.
- RN-18c: Una preferencia que no se puede leer o escribir nunca bloquea el uso de Studio.
  **Casos de error:**
- CE-12: Preferencia corrupta: se descarta y se usa el riel por defecto.

## Requisitos no funcionales (diseño)

- **RNF-1 Escala tipográfica.** Una sola escala armónica, como Slack, con los tokens de Studio (micro 10 · meta 11 · ui 12 · small 13 · copy 14 · title 16): título de panel 16 semibold; encabezados de grupo 13 medium en color secundario; ítems 14 en filas de 28px con ícono de 16; metadatos 11; etiquetas del riel 11. Ningún control con fuente mayor que su contexto. Se verifica en el navegador, en claro y oscuro, a 1280×700 y 1440×860.
- **RNF-2 Nodos del mapa intactos.** AgentNode y AgentMapCanvas se conservan tal cual; solo se admiten mejoras claras, sin rediseño (pedido explícito del dev).
- **RNF-3 Panel derecho por módulo.** Presente en Inicio, Specs, Fixes, Agentes y Mapa; ausente en Kit, Arquitectura y Métricas.
- **RNF-4 Componentes de tucu-ui** donde existan (hoy 3.6.0; 3.7.0 trae SegmentedControl, FilterBar, AnimatedTabs, vistas de estado y SplitModal). Las fricciones se reportan a la sesión «tucu-ui spec 002».
- **RNF-5 Accesibilidad.** Navegación completa por teclado, foco visible, nombres accesibles, contraste suficiente en claro y oscuro; los controles que cambian archivos (US-8) no se activan por accidente.
- **RNF-6 Rendimiento percibido.** Cambiar de módulo es inmediato (sin esperas de red para módulos cuyos datos ya están en el snapshot); los datos pesados del Kit se piden al abrir su sección, no al abrir Studio.
- **RNF-7 Compatibilidad.** Web y puente de versiones distintas no se rompen entre sí (CA-132); el modo de lograrlo lo decide el architect.
- **RNF-8 Idioma.** Todo el texto visible en español e inglés (CA-128).
- **RNF-9 Calidad.** `pnpm build && pnpm typecheck && pnpm test` y el e2e de Studio en verde; specs nuevas para riel, panel, filtros, fichas y herramientas.
- **RNF-10 Seguridad de la escritura.** Studio solo escribe `sdd/tools.json` y solo los tres valores de RF-8-001; ninguna otra ruta se puede escribir ni leer fuera de las permitidas para el visor de documentos.

## Reglas de negocio

1. Un solo módulo está activo a la vez; panel y centro siempre pertenecen al mismo módulo (RF-1-001).
2. El buscador de cada panel filtra solo su módulo y solo contenido ya cargado (RF-1-002).
3. Specs activas: estado `in-progress` o con algún ciclo `in-progress`; conversaciones activas: en curso, por aprobar o con actividad en las últimas 24 h y no archivadas (RF-3-001).
4. El resumen de `#specs` y `#fixes` abarca todo el proyecto, sin los filtros del módulo (RF-3-002).
5. La ficha de spec muestra en Plan los documentos que corresponden al flow del ciclo: `plan.md` si es `lite`; `functional.md`, `planner.md` y `architect.md` si es `full` (RF-4-001).
6. La ficha de agente es una sola para Agentes y Mapa (RF-5-001).
7. Los filtros del Mapa actúan sobre la lista de conversaciones, jamás sobre los nodos (RF-6-001).
8. El Kit y la Arquitectura son de solo lectura; solo `sdd/tools.json` se escribe, y solo `rtk.enabled`, `claude_mod.enabled` y `claude_mod.gate` (RF-7-001, RF-8-001).
9. Todo cambio de herramienta pide confirmación y, si sale bien, queda registrado en `#general`; con un puente sin la capacidad, los controles son de solo lectura (RF-8-001).
10. La personalización del riel persiste por proyecto, con respaldo seguro al riel por defecto (RF-2-001).
11. Todo módulo tiene estados de carga, vacío y error propios, y un error no se propaga a otros módulos (US-X-001).

## Glosario del dominio

| Término              | Definición                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| Riel                 | Columna angosta a la izquierda con los módulos de Studio (ícono y etiqueta), personalizable                 |
| Panel                | Columna junto al riel con la lista, el buscador y los grupos del módulo elegido                             |
| Centro               | Área principal donde se muestra la vista, ficha o contenido del elemento elegido                            |
| Panel derecho        | Columna a la derecha del centro con actividad, detalles o la ficha del agente; no existe en Kit, Arquitectura ni Métricas |
| Módulo               | Destino del riel: Inicio, Specs, Fixes, Agentes, Actividad, Mapa, Kit, Arquitectura o Métricas             |
| Canal                | Entrada de Inicio que reúne actividad por tema: `#general`, `#specs`, `#fixes`                              |
| Ficha                | Vista de detalle de un elemento (spec, fix o agente)                                                        |
| Flow                 | Forma del ciclo SDD: `full`, `reduced` o `lite`; define qué documentos de plan tiene                       |
| Spec / conversación activa | Ver RN-5 y RN-6                                                                                       |
| Kit                  | El conjunto de skills, prompts, agentes, herramientas, documentación, schemas, contexto y memoria que instala SDD en el repo |
| rtk                  | Herramienta que comprime la salida de los comandos de shell que leen los agentes; se prende/apaga en `sdd/tools.json` |
| Mod de Claude Code   | Extensión del kit para Claude Code (franja con el ciclo en curso, `/sdd` y SPEC GATE); apagada por defecto |
| Modo del SPEC GATE   | `block` (rechaza ediciones de código sin ciclo abierto) o `warn` (solo avisa)                               |
| Puente               | Proceso local (`apps/studio-bridge`) que lee el repo, corre agentes y conecta con la web                     |
| Snapshot             | Foto del proyecto que el puente entrega a la web: specs, ciclos, fixes, agentes, skills, modo del gate, precios |

## Preguntas abiertas para el architect

1. **Datos del Kit y Arquitectura:** el snapshot no trae documentación, schemas JSON, contexto, memoria, `tools.json`, `schema.json`, `api.json` ni `components.json`. Decidir snapshot ampliado vs. pedido bajo demanda, límites de tamaño y de frame, y cómo se refrescan (CA-006 a CA-101, RNF-6).
2. **Actividad de `#general`/`#specs`/`#fixes` y panel derecho:** qué eventos existen hoy (y de dónde salen) para armar la actividad por spec/fix y el registro de cambios de herramientas; si hace falta un evento nuevo en el protocolo.
3. **Definición de conversación activa:** qué dato de "última actividad" y de "archivada" existe por hilo para aplicar RN-6 (el umbral de 24 h es provisorio).
4. **Progreso y ciclo actual:** si `CycleSummary` alcanza para RN-8 (ciclo en curso, tareas del ciclo, flow) o hace falta ampliarlo; incluir cómo se conocen los documentos que existen por ciclo (para CA-056/CA-057, según flow).
5. **Documentos por ciclo y artefactos:** cómo lista la web los documentos de una spec, de cada ciclo y de los fixes (lista blanca de rutas, como el visor de documentos) y el límite de tamaño por documento.
6. **Escritura de `sdd/tools.json`:** mensaje y respuesta, validación con `sdd/schemas/tools.schema.json`, mismo resultado que `pnpm sdd:rtk`/`pnpm sdd:mod` (RN-12), detección de cambio externo previo a escribir (CE-9), feature en `BRIDGE_FEATURES` para el modo solo lectura y evento hacia `#general`.
7. **Compatibilidad:** campos opcionales + feature vs. bump de `PROTOCOL_VERSION` (CA-132).
8. **Módulo Actividad:** la spec lo lista en el riel pero no define su panel, centro ni panel derecho. Propuesta funcional: panel con filtros por origen (specs, fixes, agentes, herramientas) y centro con línea de tiempo del proyecto, sin panel derecho propio; confirmar con el dev o decidir en el diseño.
9. **Descubrimiento del tamaño y la lista de skills/prompts/agentes del Kit:** el snapshot trae descripciones truncadas (`SkillSummary.description`, máx. 300); definir si el contenido completo se pide al elegir el elemento.
10. **Persistencia del riel:** ubicación de la preferencia (almacenamiento del navegador por proyecto) y qué identifica al proyecto (nombre del snapshot vs. ruta), incluida la conducta de CA-016 (texto del buscador al volver a un módulo).
11. **Filtros del Mapa:** de dónde sale que una conversación sea "transversal", "por ciclo", "en ejecución" o "lista" con los asociados múltiples de spec-e-burgos-007 (si ya existen esos datos, solo mapear; si no, agregarlos).
