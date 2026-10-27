# SPEC-e-burgos-010: SDD Studio — navegación de doble sidebar (riel de módulos + panel de lista) con módulos de Kit y Arquitectura

> Estado: **in-progress** (cycle-01 abierto 2026-10-27). Flow `full`: cambia el contrato de
> `libs/studio-protocol`, que consumen `apps/studio` y `apps/studio-bridge` (nuevos datos del kit y
> escritura de `sdd/tools.json`).
> Sucesora de spec-e-burgos-009 (completed), que dejó Studio sobre tucu-ui. Diseño aprobado por el
> dev el 2026-10-27 sobre los mockups mostrados en la sesión.

## Resumen ejecutivo

Studio navega hoy con pestañas en el header (Workspace, Agent Map, Ecosystem, Telemetry) y un
sidebar único con un árbol largo. El dev quiere una navegación como la de Slack: un **riel de
módulos** (íconos con etiqueta) y un **panel de lista** con el contenido del módulo elegido, con
tipografía, espaciado y separadores armónicos. Además Studio tiene que mostrar lo que hoy solo
muestra el visor `pnpm sdd:docs` del kit: skills, prompts, agentes del kit, herramientas,
documentación, schemas JSON, contexto, memoria y arquitectura (schema de base de datos, API,
componentes), y permitir prender y apagar las herramientas del kit.

## Historias de usuario

### US-1 — Riel de módulos y panel de lista

Como dev, quiero un riel de módulos a la izquierda y un panel con la lista del módulo elegido, para
moverme entre áreas sin un árbol enorme.

- Riel (~60px): proyecto arriba; módulos Inicio, Specs, Fixes, Agentes, Actividad, Mapa, Kit,
  Arquitectura, Métricas y "Más"; abajo, nueva conversación y la cuenta con el punto de conexión.
- Panel (~220px): título del módulo con su menú/acciones, buscador ⌘K que filtra el módulo, grupos
  colapsables separados por líneas finas.
- El header superior pierde las pestañas de vistas y conserva el chip del SPEC GATE, el estado del
  equipo, el idioma y el modo claro/oscuro.

### US-2 — Riel personalizable

Como dev, quiero ocultar y reordenar módulos del riel; los ocultos quedan en "Más". La preferencia
persiste por proyecto.

### US-3 — Inicio con canales generales

Como dev, quiero en Inicio los accesos "En curso" y "Por aprobar", los canales `#general`, `#specs`
y `#fixes`, las conversaciones (filtro "solo activas" y "mostrar todo") y los agentes con presencia.

- `#specs` (nuevo) y `#fixes` muestran arriba un resumen de todas las specs / todos los fixes del
  proyecto (estado, ciclo y flow, progreso; severidad y estado) y debajo su actividad y
  conversaciones. `#specs` reúne la actividad de todas las specs.

### US-4 — Ficha de spec

Como dev, quiero que al elegir una spec en el módulo Specs el centro muestre su ficha con pestañas
Resumen · Plan · Tareas · Documentos · Conversaciones, y a la derecha Actividad y Detalles.

- Panel: buscador, filtros Activas / Todas / Cerradas, grupos por estado con ciclo, flow y progreso.
- Resumen: ciclo actual, tareas, estado del gate, ciclos, dependencias, subproyecto, fixes
  vinculados y tareas del ciclo.

### US-5 — Fixes y Agentes

Como dev, quiero el módulo Fixes con la lista por estado y severidad y su ficha, y el módulo Agentes
con la lista de agentes; elegir un agente abre su ficha a la derecha con el chat directo (la misma
ficha que el mapa).

### US-6 — Mapa en tres columnas

Como dev, quiero el módulo Mapa con conversaciones, nueva conversación y filtros (todas,
transversal, por ciclo, en ejecución, listas) en el panel; el mapa de agentes al centro; y a la
derecha la interacción del enjambre y la ficha del agente seleccionado con chat directo.

- Los nodos del mapa se conservan tal cual (pedido explícito del dev); solo se admiten mejoras
  claras, sin rediseñarlos.

### US-7 — Módulo Kit

Como dev, quiero ver desde Studio lo que trae el kit: skills, prompts y agentes del kit;
herramientas; documentación (README, cómo usar SDD, instalar y actualizar, en el idioma de la UI);
schemas JSON; contexto (constitution y context_prompt global y por subproyecto, con sus fragmentos
`updates/`); memoria (lessons y journal).

### US-8 — Herramientas del kit desde Studio

Como dev, quiero prender y apagar rtk y el mod de Claude Code, y cambiar el modo del SPEC GATE
(block/warn), desde Studio, con confirmación y un registro del cambio en `#general`.

### US-9 — Módulo Arquitectura

Como dev, quiero ver el schema de base de datos, la API y los componentes del proyecto
(`sdd/schema.json`, `sdd/api.json`, `sdd/components.json`), como en el visor del kit.

### US-10 — Métricas

Como dev, quiero el módulo Métricas con sus vistas en el panel (Dashboard, Planificación, Costos con
RTK, Ecosistema, Telemetría) y la elegida al centro, sin panel derecho.

## Restricciones de diseño (del dev)

- Escala tipográfica única y armónica, como Slack: título de panel 16 (semibold), encabezados de
  grupo 13 (medium, color secundario), ítems 14 en filas de 28px con ícono de 16, metadatos 11,
  etiquetas del riel 11. Ningún control con fuente mayor que su contexto. Tokens de Studio:
  micro 10 · meta 11 · ui 12 · small 13 · copy 14 · title 16.
- Panel derecho en Inicio, Specs, Fixes, Agentes y Mapa; sin panel derecho en Kit, Arquitectura y
  Métricas.
- Componentes de tucu-ui donde existan (3.7.0 trae SegmentedControl, FilterBar, AnimatedTabs,
  vistas de estado y SplitModal); las fricciones se reportan a la sesión de tucu-ui.
- Sin PR hasta completar toda la adopción (pedido del dev): solo commits en `feat/studio-tucu-ui`.

## Criterios de aceptación

- **CA-1:** El riel y el panel reemplazan a las pestañas del header y al sidebar actual; cada módulo de US-1 abre su panel y su vista; la escala tipográfica de las restricciones se cumple en todos los paneles (verificado en el navegador, claro y oscuro, 1280×700 y 1440×860).
- **CA-2:** Ocultar y reordenar módulos persiste tras recargar; los ocultos aparecen en "Más".
- **CA-3:** `#specs` y `#fixes` muestran su resumen y su actividad con datos reales del snapshot.
- **CA-4:** La ficha de spec muestra las cinco pestañas con datos reales; Plan y Documentos abren los documentos del ciclo.
- **CA-5:** El módulo Mapa conserva los nodos actuales y su comportamiento; los filtros y la ficha del agente con chat funcionan.
- **CA-6:** Kit y Arquitectura muestran skills, prompts, agentes, documentación, schemas, contexto, memoria, schema de base de datos, API y componentes leídos del repo por el puente.
- **CA-7:** Cambiar rtk, el mod o el modo del SPEC GATE desde Studio escribe `sdd/tools.json` igual que `pnpm sdd:rtk`/`pnpm sdd:mod`, pide confirmación y deja un registro en `#general`; un puente sin la capacidad muestra los controles en solo lectura.
- **CA-8:** Compatibilidad de protocolo: un puente o una web antiguos no fallan (campos opcionales y feature en `BRIDGE_FEATURES`, o bump de versión; lo decide el architect).
- **CA-9:** `pnpm build && pnpm typecheck && pnpm test` y el e2e de Studio en verde; specs nuevas para riel, panel, filtros, fichas y herramientas.

## Fuera de alcance

- Editar documentos del kit, schemas, contexto o memoria desde Studio (solo lectura, salvo `sdd/tools.json`).
- Migrar los modales a `SplitModal` (ciclo aparte al adoptar tucu-ui 3.7.0, si no entra en este).
- Mensajes sin leer (no hay dato).
- Vista mobile dedicada (el riel y el panel deben degradar sin romperse, nada más).

## Evidencia

- Visor del kit `sdd/docs/app.js`: vistas Dashboard, Planificación, Costos; Specs, Ciclos, Tareas, Fixes, Contexto, Memoria; Agentes, Skills, Prompts; Schema, API, Componentes, Schemas JSON; Documentación SDD.
- `libs/studio-protocol/src/snapshot.ts`: el snapshot trae specs, ciclos, fixes, agentes, skills, gateMode y pricing; no trae documentación, schemas, contexto, memoria, tools ni arquitectura.
- Slack: [visión general del rediseño](https://slack.com/help/articles/16764236868755-An-overview-of-Slacks-new-design), [preferencias del sidebar](https://slack.com/help/articles/212596808-Adjust-your-sidebar-preferences), [secciones personalizadas](https://slack.com/help/articles/360043207674-Organize-your-sidebar-with-custom-sections).
