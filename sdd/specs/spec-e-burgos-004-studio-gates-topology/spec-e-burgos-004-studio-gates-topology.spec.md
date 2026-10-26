# SPEC-e-burgos-004: SDD Studio: Topología interactiva de Gates, visualización del enjambre y live chat compartido

> Estado: **completed** — 2026-10-24. Flow `lite` (un solo actor), un ciclo completado.

## Resumen Ejecutivo

Evolución de la vista Mission Control de SDD Studio (`apps/studio`), expandiendo el lienzo interactivo del Mapa de Agentes (`AgentMapCanvas`) y el panel de inspección (`AgentInspectorDrawer`):

1. **Tarjetas de GATES ("Puertas del Enjambre") en el Grafo de Topología**:
   - Integración de los 6 GATES canónicos del kit SDD a la izquierda del lienzo agéntico como puertas interactivas:
     - **REGLA CERO**: Selección de tier de modelo, esfuerzo y presupuesto inviolable.
     - **SPEC GATE A**: Apertura de ciclo (registro en specs index, módulo en global.json, dependencias).
     - **SPEC GATE B**: Inicio de implementación (cycle.json in-progress, plan.md/tasks.json, constitution de subproyectos).
     - **CONTEXTO GATE**: Cierre de ciclo (fragmento aditivo en updates/, tablas globales, consistencia).
     - **FIX GATE**: Bypass controlado para hotfix/bugfix/improvements rápidos sin romper trazabilidad.
     - **MEMORIA GATE**: Autoaprendizaje y destilación entre sesiones (lessons.md y journal).
   - Selector o vista compacta/conmutable entre **Gates de Ciclo** (A, B, Contexto, Fix) y **Gates Transversales** (Regla Cero, Memoria).
   - Conexiones visuales SVG activas (edges) entre los agentes del enjambre y sus puertas asociadas (ej. Clara y Mercurio con Gate A; implementadores con Gate B; Argus con Contexto y Memoria; Jarvis con Fix Gate y Regla Cero).
   - Estado en tiempo real de cada Gate derivado de la salud del workspace (ej. `PASSING`, `ACTIVE`, `IDLE`, `BLOCKED`).

2. **Panel Dividido (Split-View) de Agente y Conversación en Tiempo Real**:
   - Rediseño de `AgentInspectorDrawer`:
     - **Zona Superior**: Ficha resumida del agente seleccionado (avatar, rol, líder badge, estado de misión y herramienta en ejecución).
     - **Zona Inferior**: Feed en vivo de conversación agéntica (`LiveAgentChatFeed`) que muestra los intercambios en tiempo real del agente (mensajes entrantes y salientes, diálogos del enjambre y stream de actividad).
     - **Interacción directa**: Caja de entrada rápida para enviar un mensaje directo al agente o abrir el hilo correspondiente en el Workspace sin perder de vista la topología.

3. **Drawer / Modal de Inspección de Gates**:
   - Al pulsar sobre cualquier tarjeta de Gate, se despliega una ficha técnica con su propósito, checklist de verificación, comando CLI de chequeo (`pnpm sdd:gate`), reglas asociadas y agentes vinculados.

## Criterios de Aceptación (CA)

- **CA-1 (Gates en Lienzo)**: Las tarjetas de Gates se renderizan a la izquierda del diagrama en `AgentMapCanvas` como parte integral del SVG/layout del mapa.
- **CA-2 (Conmutador 6 Gates)**: Soporta la visualización de los 6 gates (Regla Cero, Gate A, Gate B, Contexto, Fix, Memoria) mediante selector o disposición compacta responsiva.
- **CA-3 (Conexiones Agente ➔ Gate)**: Arcos SVG animados comunican a los agentes con las puertas de las que son responsables o con las que interactúan activamente.
- **CA-4 (Split-View Inspector)**: El panel lateral al seleccionar un agente muestra la ficha superior y la conversación en vivo abajo con auto-scroll y botón de mensaje.
- **CA-5 (Gate Inspector)**: Al seleccionar una tarjeta de puerta se muestran sus reglas, estado y comando asociado.
- **CA-6 (Cero Regresiones & Tests)**: Todos los tests unitarios (`vitest`) pasan al 100%, con cobertura de los nuevos componentes y estados.

## Evidencia y decisiones

- Evidencia (código, 2026-10-24): `apps/studio/src/components/mission-control/AgentMapCanvas.tsx` ya cuenta con el sistema de coordenadas SVG de 1000x860, lo que permite ubicar las tarjetas de puertas en el cuadrante izquierdo (x: 40 a 260) conectadas visualmente a la columna de agentes.
- Decisión de diseño: Flow `lite` con panel dividido vertical para el inspector de agentes para no saturar la pantalla horizontalmente y mantener la vista del mapa despejada.
