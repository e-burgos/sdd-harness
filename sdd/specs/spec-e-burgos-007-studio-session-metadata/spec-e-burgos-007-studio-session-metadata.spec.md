# SPEC-e-burgos-007: SDD Studio — título real de sesión, asociación múltiple y documentos tocados como evento estructurado

> Estado: **in-progress** (cycle-01 abierto 2026-10-26). Flow `full`: cambia el contrato de
> `libs/studio-protocol`, que consumen `apps/studio` y `apps/studio-bridge`.
> Sucesora de spec-e-burgos-005 (completed): su cycle-02 se registra como spec nueva porque el
> SPEC GATE A5 bloquea specs `completed` y `specs/index.json` es append-only.

## Resumen ejecutivo

Tres huecos de spec-e-burgos-005 que el dev encontró usando Studio:

1. La conversación muestra el id de sesión pero no su **título real** (el de `/resume`).
2. `ThreadInfo.link.target` admite **una sola** asociación (spec, ciclo o fix); una conversación real
   toca varias.
3. Los documentos de una conversación se infieren por heurística de los tool calls
   (FIX-e-burgos-005-006): lo que escriben **Bash o scripts** (caso real: `planner.md` y `tasks.json`
   generados por `/tmp/gen-planner.mjs`) no aparece, y el resumen Bash se recorta a 160 caracteres
   (`apps/studio-bridge/src/engine/tool-summary.ts`).

## Historias de usuario

### US-1 — Título real de la sesión

Como dev, quiero ver el título que Claude le asignó a la sesión (el de `/resume`), para reconocer
la conversación sin leer el id.

- `ThreadInfo.sessionTitle` opcional; el puente lo lee con `getSessionInfo(sessionId)` del SDK
  (`customTitle` si existe, si no `summary`) y lo publica al conocerse y al cambiar.
- `ConversationSessionInfo` lo muestra; sin título dice que no hay, nunca inventa uno.

### US-2 — Asociación múltiple y persistente

Como dev, quiero que una conversación quede asociada a todas las specs, ciclos y fixes que toca,
y que esa asociación sobreviva a reinicios.

- `ThreadLink.targets[]` aditivo, compatible con `link.target` (que se conserva).
- El puente persiste las asociaciones detectadas y las manuales; `threads.json` viejos se migran.

### US-3 — Todos los documentos generados, también los de Bash

Como dev, quiero ver todos los documentos que generó la conversación, incluidos los escritos por
Bash o por scripts.

- Evento estructurado `document.touched { path, op, author, seq }`, emitido por el puente para
  Write/Edit/MultiEdit y para cambios en `sdd/` durante tools Bash (mecanismo: lo decide el
  architect, p. ej. diff de mtimes/hash de `sdd/` antes/después del tool).
- Revisar el recorte de 160 caracteres de los resúmenes Bash.
- La web prefiere `document.touched` y cae a la heurística de FIX-e-burgos-005-006 para hilos viejos.

## Criterios de aceptación

- **CA-1:** `ThreadInfo.sessionTitle` llega a la web y `ConversationSessionInfo` lo muestra; sin título no se fabrica ninguno.
- **CA-2:** Un hilo con varias asociaciones las conserva tras reiniciar el puente; `threads.json` previo se migra sin pérdida y sin `targets`.
- **CA-3:** Un script lanzado por Bash que escribe `sdd/specs/<id>/cycles/cycle-XX/planner.md` produce `document.touched` y el documento aparece en la web.
- **CA-4:** Un hilo anterior al ciclo (sin `document.touched`) sigue mostrando documentos por la heurística.
- **CA-5:** Compatibilidad de protocolo resuelta (campos y evento opcionales o bump de `PROTOCOL_VERSION`, lo decide el architect); un puente o web antiguos no fallan.
- **CA-6:** `pnpm test` y `pnpm typecheck` en verde en los tres subproyectos.

## Fuera de alcance

- Renombrar sesiones desde la web (escritura de `customTitle`).
- Motores de otros proveedores.
- Los FIX-e-burgos-005-001..011 (los revisa el reviewer al cerrar, no se reabren).

## Evidencia

- `apps/studio-bridge/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`: `getSessionInfo(sessionId, { dir })` → `SDKSessionInfo { summary, customTitle?, firstPrompt? }`.
- `sdd/context/apps/studio/constitution.md` § 6: el título de sesión quedó pendiente como ciclo nuevo.
