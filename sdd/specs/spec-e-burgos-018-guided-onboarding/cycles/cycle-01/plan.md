# spec-e-burgos-018-guided-onboarding — cycle-01 · plan (lite)

> Módulo: guided-onboarding | Subproyectos: apps/studio, apps/cli | Fecha: 2026-11-07
> Objetivo: un primer uso guiado de punta a punta — Conectar Claude → Crear el proyecto (wizard) →
> Conectar GitHub → Primera idea / primera spec — que se completa solo según el estado real.
> Rama `feat/github-onboarding`.

## Historias
- US-1 — Launcher guiado. CA: en modo launcher, una franja «Primeros pasos» reemplaza el aviso actual
  y muestra los 4 pasos con su estado (hecho / actual / pendiente / no disponible); «Conectar Claude»
  abre el panel de cuenta existente (`AuthPanel`) en un diálogo, así se puede conectar sin proyecto.
- US-2 — GitHub tras generar. CA: cuando la generación termina bien, `GenerationResult` muestra el
  paso «Conectar GitHub» con `GithubConnectPanel` (por `generationId`, nombre por defecto = proyecto)
  y la opción «Ahora no»; abrir el proyecto sigue disponible en todo momento. Sin la feature
  `github` el paso se muestra como no disponible.
- US-3 — Guía en Home. CA: con el proyecto abierto, Home muestra una tarjeta «Primeros pasos» con los
  pasos que faltan y su acción: Conectar GitHub (diálogo con el panel), Primera idea a Hermes
  (enfoca el composer de #general, donde el wizard deja el borrador), Primera spec (lleva al módulo
  Specs). Cada paso se marca solo (auth conectado, proyecto abierto, `snapshot.github.remote`,
  hay specs registradas o una conversación iniciada) y «Ocultar guía» la esconde para ese proyecto.
- US-4 — `harness init` ofrece Studio. CA: `harness init` interactivo sin `--config`/`--yes`
  pregunta primero «Studio (recomendado) o terminal»; Studio corre
  `npx -y @e-burgos/sdd-studio@latest` en la carpeta destino (heredando la terminal) y sale con su
  código; `--studio` salta la pregunta; `--terminal` o cualquier flag de configuración mantiene el
  asistente de terminal sin cambios.

## Tasks
- TASK-001 — Studio: modelo puro de pasos (`lib/onboarding.ts`), componente `OnboardingSteps`,
  franja del launcher con «Conectar Claude» en diálogo; tests.
- TASK-002 — Studio: paso GitHub en `GenerationResult` con `GithubConnectPanel` y «Ahora no»; tests.
- TASK-003 — Studio: tarjeta «Primeros pasos» en Home con acciones y «Ocultar guía» (por proyecto,
  localStorage); i18n es/en; tests.
- TASK-004 — CLI: `harness init` ofrece Studio (`--studio`/`--terminal`); tests.
- TASK-005 — Docs (README/HOW-TO es/en del kit: arranque recomendado con Studio, CHANGELOG) y
  verificación real: launcher en carpeta vacía, generación real con el wizard, paso GitHub (sin crear
  repo), apertura y guía en Home; cierre.

## Decisiones técnicas
- El estado de cada paso se deriva (no se guarda); lo único persistido es «guía oculta» por raíz de
  proyecto, en localStorage con try/catch (si falla, la guía se muestra).
- Reutiliza `AuthPanel`, `GithubConnectPanel` (spec 014) y el borrador para Hermes que ya deja el
  wizard; no hay comandos nuevos en el protocolo.
- Flow lite (profile solo): no crea contratos que consuma otro subproyecto.
