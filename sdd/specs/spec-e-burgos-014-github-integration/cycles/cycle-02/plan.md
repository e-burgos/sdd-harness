# spec-e-burgos-014-github-integration — cycle-02 · plan (lite)

> Módulo: github-integration | Subproyectos: libs/studio-protocol, apps/studio-bridge, apps/studio
> Fecha: 2026-11-07 · Rama `feat/github-onboarding`.
> Objetivo: que Studio sepa si el proyecto está en GitHub, pueda conectarlo (también el proyecto
> recién generado por el wizard, para el onboarding de spec 018) y muestre PR y CI de cada ciclo.

## Historias
- US-4 — Studio y GitHub. CA:
  - `github.status` devuelve gh (instalado/autenticado/usuario), git, remoto y workflow, del
    proyecto abierto o de una generación terminada (`generationId`).
  - `github.connect` (nombre, owner opcional, visibilidad, `protect` apagado por defecto) corre la
    CLI del kit (`harness github connect --yes --json`) solo por pedido explícito de la UI, sobre el
    proyecto abierto o sobre una generación terminada; devuelve remoto o error legible.
  - Con remoto y `gh`, el snapshot suma `github` (opcional): remoto y, por cada ciclo en curso, rama
    `feat/<slug>-cycle-XX`, PR (número, url, estado) y resumen de checks (success/failure/pending/none).
  - Studio muestra el estado de GitHub (conectado `owner/name`, o botón «Conectar») con un diálogo de
    conexión (privado por defecto, protección apagada), y en la lista «en curso» el PR y el CI de
    cada ciclo. Sin `gh` explica cómo instalarlo; con un puente viejo no muestra nada.

## Tasks
- TASK-001 — Protocolo: comandos `github.status` / `github.connect` y sus resultados, feature
  `github` en el handshake, `snapshot.github` opcional con tope; tests.
- TASK-002 — Puente: servicio GitHub (CLI localizada como en el wizard, `generationId` resuelto por
  el registro de generaciones), feed de PR/CI por ciclo (`gh pr view <rama> --json …`, cada 60 s y
  tras conectar, solo con remoto y gh), wiring en runtime y launcher; tests.
- TASK-003 — Studio: estado y diálogo de conexión de GitHub, PR/CI por ciclo en la lista «en curso»,
  i18n es/en; tests.
- TASK-004 — Verificación y cierre: build/typecheck/test, Studio local contra el repo de prueba
  (e-burgos/sdd-gh-smoke-017) mostrando el PR #1 y su CI; `sdd:validate`.

## Decisiones técnicas
- El puente no reimplementa GitHub: `status`/`connect` delegan en la CLI del kit (`harness github …
  --json`) y el feed usa `gh` directo solo para leer PRs. Nada guarda tokens.
- `generationId` en vez de una ruta libre, igual que `workspace.open`: solo se conecta un proyecto que
  el wizard generó en esta sesión o el proyecto abierto.
- Nombre de rama con la librería del kit del proyecto (`sdd/scripts/lib/github.mjs`, import dinámico
  como `session-registry.mjs`); kit viejo ⇒ sin feed.
- Flow lite (profile solo); campos y comandos nuevos opcionales y detrás de la feature `github`.
