# spec-e-burgos-017-parallel-sessions — cycle-02 — 2026-11-06

## Estado
El puente toma y respeta reservas de archivo para cada conversación de Studio: el gate (sincrónico) lee el archivo de la reserva con fs sincrónico y aplica `judgeFileLease`; la toma y el pedido al buzón van en la cola asíncrona. Cerrar la conversación libera sus reservas. El snapshot suma `leases` con `requestedBy` (pedidos sin leer de la dueña). Con un kit sin funciones de reserva, el puente no reserva.

## Estructura
- `src/sessions/session-bindings.ts`: `judgeLease`, `listLeases`, `studioLeaseReasonOf` (mensajes en inglés para Studio).
- `src/workspace/sessions-feed.ts`: `SessionsSource.listLeases` opcional; `withSessions` recibe `{ sessions, leases? }`.

## Dependencias
- Ninguna nueva.

## Qué sigue
- Nada pendiente de esta spec.
