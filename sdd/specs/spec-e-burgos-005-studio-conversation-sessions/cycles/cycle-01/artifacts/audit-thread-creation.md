# Auditoria de creacion de hilos (CA-005, D-10)

Alcance: toda via de la web que puede crear una conversacion nueva en el puente, y si alguna puede reutilizar la sesion de otra conversacion.

## Resultado

| Entrada | Comando | Resultado |
| ------- | ------- | --------- |
| `apps/studio/src/components/workspace/Composer.tsx` sin `threadId` | `thread.create` | Cumple. Cada creacion pasa por `createThread`, que fija `engineSessionId: null`; la sesion nace en el primer turno. |
| `apps/studio/src/components/mission-control/LiveAgentChatFeed.tsx` con conversacion seleccionada | `thread.send` | Cumple. Retoma la sesion de esa misma conversacion (RN-02); no abre una conversacion nueva ni toca otra sesion. |
| `LiveAgentChatFeed.tsx` sin conversacion seleccionada | `thread.create` (DM del agente) | Cumple. Crea un hilo con sesion nula y lo selecciona con `pick(id)`. |
| Boton "Nueva conversacion" (`NewConversationButton`) | ninguno | Deja seleccionado un borrador vacio (`threadId: null`); el hilo real nace con el primer envio por `thread.create`. |

No existe ninguna otra llamada a `thread.create` en `apps/studio/src` fuera de `Composer.tsx` y `LiveAgentChatFeed.tsx`.

## Evidencia

Puente (`apps/studio-bridge/src/sessions/session-manager.spec.ts`):

- `creates a thread with the engine provider and no session yet (CA-001, CA-006)`
- `gives two threads different sessions and resumes each one with its own (CA-002, CA-004)`
- `rejects a session id that belongs to another thread (RN-02)`
- `keeps a null session when the engine fails before init and does not resume next turn (CE-01)`
- `broadcasts thread.updated carrying the session id once it is known`

Store (`apps/studio-bridge/src/sessions/store.spec.ts`):

- `toThreadInfo hides pending, exposes pendingCount and shows the engine session and provider (CA-006)`
- `migrates a legacy threads.json without provider, keeping the engine session (CA-007)`

Web:

- `apps/studio/src/components/workspace/composer.spec.tsx`: `forces the DM agent in thread.create and creates one thread on double submit`.
- `apps/studio/src/components/mission-control/liveagentchatfeed.spec.tsx`: `sends to the selected conversation instead of creating a thread` y `creates a direct conversation when none is selected and picks it`.
- `apps/studio/src/components/mission-control/inspectordrawer.spec.tsx`: `creates a direct conversation from the quick message when nothing is selected`.
- `apps/studio/src/components/workspace/workspace.spec.tsx`: `leaves an empty draft selected when a new conversation is requested, keeping the channel`.
- `apps/studio/src/lib/no-fabricated-data.spec.ts`: ausencia de ids de sesion literales, guiones de demo, telemetria base y proveedores fijos en el codigo fuente.
