# SPEC-e-burgos-002: SDD Studio: pulido de UI (viewport, eventos del bot, menú @, paneles)

> Estado: **completed** — 2026-10-23. Flow `lite` (un solo actor), un ciclo.

## Resumen Ejecutivo

Pulido de la web de SDD Studio (`apps/studio`) y ajustes puntuales del puente (`apps/studio-bridge`)
detectados al usar el Studio en vivo después de `spec-e-burgos-001`:

1. La app no debe scrollear nunca el documento (franja vacía abajo).
2. Los eventos del sdd-bot no se duplican en un canal.
3. Follow-ups del reviewer de la 001: agentes primero en el menú `@`, Enter envía un comando ya completo,
   re-escaneo periódico del workspace en el puente.
4. Pulido general: paneles colapsables, composer con altura acotada, error boundary, tarjeta de aprobación.

## Evidencia y decisiones

- Evidencia (código, 2026-10-23): `html/body` con `h-full` sin bloquear el scroll del documento;
  `Composer.tsx` hace `focus()` sin `preventScroll` tras cada envío.
- Evidencia (código, 2026-10-23): `diffSnapshots` emite eventos sin id ni timestamp; dos puentes sobre el mismo
  root escribían el mismo `.sdd-studio/channels/*.jsonl`.
- Decisión del dev (2026-10-23): seguir con un ciclo lite propio para el pulido.
