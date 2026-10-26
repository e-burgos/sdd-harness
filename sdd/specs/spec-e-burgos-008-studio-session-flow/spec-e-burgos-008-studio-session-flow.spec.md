# SPEC-e-burgos-008: SDD Studio — conversación automática por spec/fix, medidor de contexto y formulario de preguntas del proveedor

> spec-id: spec-e-burgos-008-studio-session-flow
> slug: studio-session-flow
> módulo: studio-session-flow
> estado: activo
> fecha: 2026-10-26
>
> Flow pedido por el dev: **`lite`** (prefijo `[LITE]`, gana sobre el perfil). La spec modifica
> `libs/studio-protocol`, que consumen `apps/studio` y `apps/studio-bridge`: la regla de
> `sdd-gates.md` § Flow marca ese caso como excepción que vuelve a `full`. El dev lo decidió
> igual; `pnpm sdd:validate` puede dejar un warning y el próximo ciclo de esta spec se abre `full`.
> Depende de spec-e-burgos-007 (usa `ThreadLink.targets[]`). Su ciclo no se abre hasta que el
> ciclo de la 007 esté `completed` (una sola spec en curso a la vez).

## Resumen ejecutivo

Cuatro huecos que el dev encontró usando Studio (el cuarto, US-4, se suma más abajo):

1. Abrir una spec o un fix no abre una conversación propia: se acumula contexto en la misma sesión.
   Una conversación nueva es una sesión nueva, y es la forma de mantener el contexto chico.
2. No hay ningún lugar visible que diga cuánto contexto queda en la sesión antes de compartir.
3. Cuando el proveedor hace una pregunta (herramienta `AskUserQuestion`), el chat no muestra el
   formulario para elegir y responder. Causa: el puente trata toda herramienta que pide permiso
   como una aprobación allow/deny (`canUseTool`, `approval.requested`) y el protocolo no tiene
   eventos de pregunta.

## Historias de usuario

### US-1 — Conversación nueva y asociada por cada spec o fix

Como dev, quiero que al pasar una spec por el SPEC GATE o un fix por el FIX GATE se cree sola una
conversación nueva asociada a esa spec o fix, con un contexto inicial mínimo, para no arrastrar
contexto de trabajos anteriores.

- La conversación nueva usa `ThreadLink.targets[]` (spec-007) con la spec o el fix como target.
- Briefing inicial mínimo: la spec o el fix, el brief o `plan.md` del ciclo, el contexto del
  subproyecto afectado (base + `updates/*.md`) y `sdd/memory/lessons.md`. Nada del historial de
  la conversación anterior.
- No se crea una conversación duplicada si ya existe una asociada al mismo target.

### US-2 — Contexto restante visible

Como dev, quiero ver en la conversación cuánto contexto queda en la sesión, para decidir cuándo
compartir o pasar a una conversación nueva.

- Indicador permanente (usado / límite del modelo, en porcentaje y tokens) en la cabecera de la
  conversación.
- Aviso visible al cruzar un umbral (a definir en el plan) con la opción de abrir una conversación
  nueva.
- Sin dato disponible dice que no hay dato; nunca inventa un número.

### US-3 — Formulario de preguntas del proveedor

Como dev, quiero que cuando el proveedor me haga una pregunta aparezca el formulario dentro del
chat, para elegir la respuesta y enviársela.

- Evento y comando nuevos en `libs/studio-protocol` para la pregunta y su respuesta (nombres y
  forma los decide el plan).
- El puente detecta `AskUserQuestion` en `canUseTool`, publica la pregunta con sus opciones
  (selección única o múltiple, y respuesta libre) y devuelve la respuesta elegida al motor.
- La web muestra el formulario inline en el chat y lo marca resuelto una vez respondido; si el
  dev interrumpe el turno, la pregunta queda cancelada, no colgada.

### US-4 — Sesiones activas sin repetir y con el agente que trabaja

Como dev, quiero ver cada sesión activa una sola vez en la actividad y en el listado de
conversaciones, y saber qué agente está trabajando en cada una, también en las que no tengo abiertas.

- Causa de la duplicación: `buildNavTree` (`apps/studio/src/lib/store/nav-tree.ts`) arma la sección
  `active` con todos los hilos `running`/`queued`/`waiting-approval` y además mete el mismo hilo en cada
  canal, ciclo o fix de sus `targets[]`; una conversación asociada a varios targets aparece varias veces.
- Causa del agente ausente: `ActiveThreadRow` (`NavTree.tsx`) muestra `thread.agent`, el dueño del hilo,
  y no el agente que trabaja ahora. La web ya recibe `presence` (`Presence.agent`, `threadId`, `tool`) y
  los eventos `subagent.start`/`subagent.stop`, pero la fila no los usa.
- Cada fila activa muestra el agente en curso (y la herramienta si hay dato); sin dato muestra el dueño del hilo.
- Una conversación con varios targets se identifica como la misma en todas sus apariciones (misma
  marca visual de actividad), sin contarse varias veces en `threadCount` de la sección de actividad.
- Alcance a confirmar con el dev: si "múltiples sesiones" se refiere además a hilos distintos que el
  puente mantiene abiertos a la vez, se agrega al plan del ciclo.

## Criterios de aceptación

- **CA-1:** Pasar una spec por el SPEC GATE o un fix por el FIX GATE crea una conversación asociada a ese target, una sola vez.
- **CA-2:** El primer mensaje de esa conversación contiene solo el briefing mínimo definido.
- **CA-3:** La cabecera muestra el contexto usado y el límite; sin dato lo dice.
- **CA-4:** Al cruzar el umbral aparece el aviso con la acción de abrir una conversación nueva.
- **CA-5:** Una pregunta del proveedor con opciones de selección única, múltiple y respuesta libre se renderiza como formulario en el chat y la respuesta llega al proveedor.
- **CA-6:** Una pregunta pendiente se cancela al interrumpir el turno y no queda bloqueando la sesión.
- **CA-9:** Un hilo activo asociado a varios targets cuenta una sola vez en la sección de actividad.
- **CA-10:** La fila de una sesión activa que no está abierta muestra el agente que está trabajando; sin dato de presencia muestra el dueño del hilo.
- **CA-7:** Compatibilidad de protocolo resuelta (campos y eventos opcionales o bump de `PROTOCOL_VERSION`); un puente o web antiguos no fallan.
- **CA-8:** `pnpm build`, `pnpm typecheck` y `pnpm test` en verde en los tres subproyectos.

## Fuera de alcance

- Resumen de la conversación anterior en el briefing.
- Motores de otros proveedores.
- Cambiar el flujo de aprobaciones allow/deny existente.

## Evidencia

- `apps/studio-bridge/src/engine/claude-sdk-engine.ts` (`canUseTool`) y `apps/studio-bridge/src/sessions/session-manager.ts`: toda herramienta con permiso va por `approval.requested`.
- `libs/studio-protocol/src/events.ts`: solo existen `approval.requested` / `approval.resolved`; no hay evento de pregunta.
- El `init` del SDK lista `AskUserQuestion` entre las herramientas del motor
  (`apps/studio-bridge/src/engine/__fixtures__/simple.jsonl`).
