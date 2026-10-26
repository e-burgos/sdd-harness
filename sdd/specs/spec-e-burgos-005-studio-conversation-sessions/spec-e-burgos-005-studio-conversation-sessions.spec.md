# SPEC-e-burgos-005: SDD Studio — una conversación, una sesión: sesión real visible, cache de contexto y enjambre centrado en la conversación

> Estado: **in-progress** (cycle-01 abierto 2026-10-25). Flow `full`: cambia el contrato de
> `libs/studio-protocol`, que consumen `apps/studio` y `apps/studio-bridge`.

## Resumen ejecutivo

Hoy SDD Studio muestra en Mission Control conversaciones, proveedores y sesiones que no
existieron: guiones fijos por spec/fix en `swarm-dialogue.ts` (FIX-e-burgos-004-001). La sesión
real de cada hilo existe en el puente, pero la web nunca la ve. Esta spec:

1. Garantiza que **cada conversación nueva abre una sesión nueva del proveedor** y que ninguna
   sesión se reutiliza entre hilos.
2. **Expone la sesión real** (`engineSessionId`) y el **proveedor** del hilo a la web por protocolo.
3. Reduce el costo de contexto con un **prefijo de sistema estable del proyecto** que aprovecha el
   prompt caching de Claude.
4. **Centra el enjambre en la conversación**: el mapa y el inspector muestran lo que hizo una
   conversación real, con sus specs y fixes derivados de sus eventos.
5. **Limpia** los guiones ficticios y los selectores de spec/fix, y conserva el visor de documentos.

La arquitectura queda **preparada para varios proveedores** (Gemini, Copilot) con el campo
`provider` en protocolo y motor. **Solo se implementa el motor Claude.**

## Diagnóstico (2026-10-25, verificado en código)

- `apps/studio-bridge/src/sessions/session-manager.ts`: `createThread` crea el hilo con
  `engineSessionId: null`; el turno pasa `resumeSessionId: thread.engineSessionId` y guarda el id
  que devuelve el SDK. **El puente ya crea una sesión nueva por hilo** y solo retoma dentro del hilo.
- `.sdd-studio/threads.json`: 6 hilos previos, cada uno con su propia sesión Claude.
- `apps/studio-bridge/src/sessions/store.ts`: `toThreadInfo` destructura y **descarta**
  `engineSessionId` antes de mandar el hilo a la web; `store.spec.ts` exige ese descarte.
- `libs/studio-protocol/src/domain.ts`: `ThreadInfo` no tiene `engineSessionId` ni `provider`.
- Motor único: `apps/studio-bridge/src/engine/claude-sdk-engine.ts` (`settingSources: ['project']`).
- Entradas que crean hilos en la web: `components/workspace/Composer.tsx` (`thread.create` cuando
  no hay `threadId`) y `components/mission-control/LiveAgentChatFeed.tsx` (`thread.create`).
- Cada hilo tiene `link.target` (spec, ciclo o fix). Las specs/fixes que **tocó** una conversación
  se pueden derivar de sus eventos: rutas `sdd/specs/<id>/…` y `FIX-…` en tool calls y mensajes.

## Historias de usuario

### US-1 — Cada conversación nueva es una sesión nueva del proveedor

Como dev, quiero que cada conversación que abro arranque una sesión nueva del proveedor, para que
el contexto de una conversación nunca contamine a otra.

- Auditar las dos entradas que crean hilos (Composer y LiveAgentChatFeed): ambas deben producir
  un hilo con sesión vacía.
- Botón explícito **"Nueva conversación"**.
- Prohibido reutilizar una sesión entre hilos: retomar sesión solo dentro del mismo hilo.

### US-2 — La web ve la sesión real

Como dev, quiero ver en la web la sesión real del proveedor y qué proveedor la atiende, para
saber con qué conversación estoy trabajando.

- `ThreadInfo` incluye `engineSessionId` (nullable hasta el primer turno) y `provider`.
- `toThreadInfo` deja de borrarlos; ajustar el test que exige el borrado.
- La web nunca inventa un id de sesión: si no hay sesión, lo dice.

### US-3 — Cache de contexto con prefijo de sistema estable (DECIDIDO por el dev)

Como dev, quiero que cada sesión arranque con un prefijo de sistema estable del proyecto
(`sdd/context/context_prompt.md`, `sdd/context/constitution.md`, `sdd/memory/lessons.md`), para
aprovechar el prompt caching de Claude y no pagar ese contexto completo en cada sesión.

- El prefijo es idéntico entre sesiones mientras esos archivos no cambien (orden y contenido
  deterministas).
- **Sin resumen por sesión** (descartado por el dev).

### US-4 — Enjambre centrado en la conversación

Como dev, quiero elegir una conversación y ver en el mapa y el inspector a los agentes que
participaron, sus diálogos reales y las specs/fixes que tocó.

- Selector de conversación en Mission Control.
- Specs y fixes relacionados derivados de los eventos de la conversación (no de `link` solo).
- Por defecto: la conversación con `lastActivity` más reciente.

### US-5 — Limpieza de lo ficticio

Como dev, quiero que Studio deje de mostrar conversaciones, proveedores y sesiones inventados.

- Borrar los guiones de `swarm-dialogue.ts` (`SPEC_00X_SCRIPT`, `FIX_*_SCRIPT`,
  `SWARM_SCRIPTS_BY_SPEC`) y los ids de sesión inventados.
- Borrar los selectores de spec/fix y el filtro de fixes del inspector.
- Conservar el visor de documentos (`DocumentViewerModal`, `lib/agent-documents.ts`), ahora
  alimentado por las specs/fixes de la conversación seleccionada.

## Decisiones del dev

- **Proveedores:** arquitectura preparada para Gemini/Copilot (`provider` en protocolo y en la
  interfaz del motor), sin implementar esos motores.
- **Cache de contexto:** prefijo de sistema estable (US-3); sin resumen por sesión.

## Criterios de aceptación

- **CA-1:** Crear un hilo desde Composer o desde LiveAgentChatFeed, o con "Nueva conversación",
  produce un hilo con `engineSessionId: null` antes del primer turno y un id distinto del de
  cualquier otro hilo después del primer turno.
- **CA-2:** `ThreadInfo` valida `engineSessionId` y `provider` en el protocolo; la web muestra
  ambos valores reales; no queda ningún id de sesión fabricado en la web.
- **CA-3:** Dos sesiones consecutivas sin cambios en los tres archivos reciben un prefijo de
  sistema byte a byte idéntico (test).
- **CA-4:** Mission Control abre por defecto la conversación más reciente; cambiar de
  conversación cambia agentes, diálogos y specs/fixes relacionados, todo derivado de eventos.
- **CA-5:** Ni `swarm-dialogue.ts` ni el inspector contienen guiones, proveedores ni sesiones
  ficticios; el visor de documentos sigue funcionando.
- **CA-6:** `pnpm test` y `pnpm typecheck` en verde en los tres subproyectos; compatibilidad de
  protocolo resuelta (campos opcionales o bump de `PROTOCOL_VERSION`, lo decide el arquitecto).

## Fuera de alcance

- Implementar motores Gemini o Copilot.
- Resumen o compactación de sesiones.

## Hallazgos relacionados (los decide el dev o el funcional)

- `LiveTelemetryHUD.tsx` sin datos muestra cifras inventadas (6.6M tokens, filas Gemini). Es la
  misma clase de problema que US-5, pero el dev no lo incluyó. Decidir si entra.

## Evidencia y decisiones

- FIX-e-burgos-004-001 (`sdd/specs/spec-e-burgos-004-studio-gates-topology/fixes/fix-e-burgos-004-001.md`):
  inventario de las falsedades en código que limpia US-5.
