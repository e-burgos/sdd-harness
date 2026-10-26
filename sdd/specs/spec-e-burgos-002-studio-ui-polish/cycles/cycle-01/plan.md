# spec-e-burgos-002-studio-ui-polish — cycle-01 · plan (lite)

> Módulo: studio-ui-polish | Subproyectos: apps/studio, apps/studio-bridge | Fecha: 2026-10-23
> Objetivo: la app no scrollea el documento, el bot no duplica eventos, el menú @ prioriza agentes, y los paneles/composer/aprobación quedan pulidos. Fuera de alcance: estados de carga/vacíos consistentes (siguiente ciclo), cambios de protocolo.

## Historias
- US-1 — Como dev quiero que la app quede anclada al viewport para no ver una franja vacía al enviar mensajes, abrir el menú @ o la bandeja de pendientes. CA: `documentElement.scrollTop` sigue en 0; todo focus programático usa `preventScroll`.
- US-2 — Como dev quiero ver cada evento del bot una sola vez. CA: eventos idénticos consecutivos de un canal se colapsan al persistir, al leer el historial y al recibirlos en la web.
- US-3 — Como dev quiero que `@agente` aparezca primero cuando lo escribo, y que Enter sobre `/gate` ya completo lo envíe. CA: grupo Agentes primero si el query coincide con un agente; sin archivos por subsecuencia débil (query < 4); Enter no se consume cuando el query es igual al id activo.
- US-4 — Como dev quiero que el puente re-escanee el workspace periódicamente. CA: el watcher refresca cada N segundos sin eventos fs.
- US-5 — Como dev quiero sidebar y panel derecho colapsables (persistidos), un composer de altura acotada con atajos visibles, un error boundary con recarga y una tarjeta de aprobación con jerarquía clara.

## Tasks (detalle en tasks.json)
- TASK-001 — Shell `fixed inset-0` + `overflow: hidden` en html/body y `focus({ preventScroll: true })` en el Composer; spec de regresión.
- TASK-002 — Dedupe de eventos bot consecutivos idénticos en `ThreadStore.appendBot`/`botHistory` y en el store web.
- TASK-003 — Menú @: agentes primero si coinciden; el índice de archivos descarta subsecuencia con query < 4.
- TASK-004 — Enter sobre un comando/skill ya completo lo envía directo.
- TASK-005 — Re-escaneo periódico (`rescanIntervalMs`) en el watcher del puente.
- TASK-006 — Sidebar y panel derecho colapsables con estado en localStorage; scroll contenido en los paneles.
- TASK-007 — Composer: textarea auto-grow hasta altura máxima con scroll interno y atajos visibles.
- TASK-008 — ErrorBoundary de React con fallback y botón de recargar.
- TASK-009 — Tarjeta de aprobación: jerarquía visual e input largo colapsado.

## Decisiones técnicas
- `fixed inset-0` en el shell y `overflow: hidden` en html/body: `overflow: clip` en el root se trata como `hidden` por el viewport y no impide scroll programático, así que el ancla real es el shell fijo más `preventScroll` → components.json no cambia (componentes ya registrados se rediseñan sin contrato nuevo).
- Los eventos bot no tienen id ni timestamp: la identidad es (channelId, botKind, payload) y solo se colapsan consecutivos, para no perder transiciones repetidas legítimas (pending → done → pending → done).
- Subsecuencia débil se corta en el puente (`file-index`), no en la web, porque la web no conoce el tier del match.
