# spec-e-burgos-008-studio-session-flow — cycle-01 · plan (lite)

> Módulo: studio-session-flow | Subproyectos: apps/studio, apps/studio-bridge, libs/studio-protocol | Fecha: 2026-10-26
> Objetivo: Studio ofrece selectores con ayuda, formulario de preguntas del proveedor, actividad sin repetir con el agente en curso, contexto restante visible, elección de modos solo/team y lite/full, y conversación automática por spec o fix. Fuera de alcance: resumen de la conversación anterior en el briefing, otros proveedores, cambiar las aprobaciones allow/deny.

## Historias
- US-6 — Como dev quiero un icono de ayuda en cada selector. CA-14/15/16: ningún `<select>` nativo fuera de HelpSelect; tooltip en hover y foco, es/en; pruebas previas en verde.
- US-3 — Como dev quiero responder en el chat las preguntas del proveedor. CA-5/6: formulario con selección única, múltiple y libre; la pregunta se cancela al interrumpir.
- US-4 — Como dev quiero ver cada sesión activa una vez y el agente que trabaja. CA-9/10.
- US-2 — Como dev quiero ver cuánto contexto queda en la sesión. CA-3/4: sin dato lo dice, aviso por umbral.
- US-5 — Como dev quiero elegir modo de desarrollo y de implementación antes de arrancar una spec. CA-11/12/13.
- US-1 — Como dev quiero una conversación nueva y asociada por cada spec o fix. CA-1/2.

## Tasks (detalle en tasks.json)
- TASK-001 — HelpSelect (icono + tooltip accesible), textos de ayuda es/en, test.
- TASK-002 — Reemplazo de los 7 select nativos por HelpSelect.
- TASK-003 — Protocolo de preguntas: `question.requested`/`question.resolved`, `question.answer`, feature `questions`.
- TASK-004 — Puente: intercepta AskUserQuestion en `canUseTool`, devuelve la respuesta, cancela al interrumpir.
- TASK-005 — Web: QuestionForm inline en el chat, store y acción de respuesta.
- TASK-006 — Actividad: sin duplicar hilos con varios targets y con el agente en curso.
- TASK-007/008 — Contexto restante: uso por hilo en protocolo y puente, ContextMeter y aviso en la web.
- TASK-009/010 — Modos: leer/escribir `profile`, flow del pedido y aviso de excepción; selectores en la web.
- TASK-011 — Conversación automática con `ThreadLink.targets` y briefing mínimo.
- TASK-012 — Cierre integral y fragmentos de contexto.

## Decisiones técnicas (obligatoria si toca schema/api/components)
- Los contratos nuevos del protocolo son aditivos y opcionales (eventos, comandos y campos nuevos, feature flags): un puente o web antiguos no fallan. `PROTOCOL_VERSION` no se sube salvo que un cambio no pueda ser opcional.
- Este ciclo cambia `libs/studio-protocol`, que consumen studio y studio-bridge: la regla de flow lo marca como excepción a `lite`; se mantiene `lite` por pedido explícito del dev y `sdd:validate` puede avisarlo.
- El perfil (`global.json`) lo escribe el puente a pedido, nunca la web directamente.
- Sin registros en `api.json`/`schema.json`: el protocolo de Studio no se versiona ahí (ver ciclos anteriores).
- Detalles de transporte de contexto restante y de origen de la pregunta (ids, límites) se fijan en TASK-003 y TASK-007 con la evidencia del SDK real.
