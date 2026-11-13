# SPEC-e-burgos-022: Las integraciones opcionales del kit se prenden desde Studio

> Estado: **completed** (2026-11-13). cycle-01 cerrado (flow lite, 3/3 tasks). Cierra el pendiente
> «interruptor de tucu-ui en el módulo Kit de Studio» (spec-e-burgos-011) y suma video-maker
> (spec-e-burgos-021), que usa el mismo mecanismo.

## Resumen ejecutivo
Hoy tucu-ui (`pnpm sdd:tucu`) y video-maker (`pnpm sdd:video`) solo se prenden desde la terminal.
El módulo Kit de Studio ya opera rtk, el mod y el gate, pero esos son interruptores de
`sdd/tools.json`; las integraciones además instalan cosas (skill, links por arnés, entradas MCP,
plugin), así que prenderlas es correr su script. El dev quiere operarlas desde Studio, viendo el
estado real por arnés.

## Historias de usuario
- US-1 — Ver el estado. Como dev, en el módulo Kit veo tucu-ui y video-maker con su estado
  (apagada, completa o incompleta), las partes (skill/plugin y MCP), la versión fijada, si hay
  actualización, y el estado por arnés (Claude Code, Copilot, Gemini, Antigravity).
- US-2 — Prender y apagar. Como dev, con un interruptor prendo o apago cada integración; Studio
  corre el script del kit, muestra el progreso y el resultado, y si falla dice por qué (sin red,
  Node viejo, archivo MCP inválido) sin dejar el estado a medias en pantalla.
- US-3 — Reparar. Si una integración está prendida pero incompleta, un botón «Reparar» la completa.
- US-4 — Qué es cada una. Cada tarjeta explica en una línea qué agrega y sus requisitos (tucu-ui
  necesita red la primera vez; video-maker necesita Node 22+ y el studio de video-maker).

## Decisiones (dev, 2026-11-13)
- Se hace el interruptor de tucu-ui; video-maker entra por usar el mismo mecanismo.

## Restricciones
- El puente ejecuta solo `sdd/scripts/sdd-tucu.mjs` y `sdd/scripts/sdd-video.mjs` del workspace,
  con argumentos fijos (`--status`, `--enable`, `--disable`), `execFile` sin shell y timeout.
- Feature nueva en `BRIDGE_FEATURES`; sin bump de `PROTOCOL_VERSION`. Sin la feature, la UI no
  muestra las tarjetas. Un kit sin el script (anterior a 0.17 o a 0.21) muestra «no disponible».

## Ciclos propuestos
- cycle-01 — Contrato, puente y UI (US-1..US-4).
