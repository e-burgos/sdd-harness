# SPEC-e-burgos-018: Primer uso guiado — de Studio vacío a la primera spec

> Estado: **completed** (2026-11-07). cycle-01 cerrado (flow lite, 5/5 tasks).

## Resumen ejecutivo
Las piezas del arranque ya existen por separado (conectar Claude, wizard que genera el proyecto,
idea para Hermes) pero no forman un camino: en modo launcher no se puede conectar Claude (el panel
de cuenta vive solo dentro de un proyecto), nada lleva a GitHub y, una vez abierto el proyecto, no hay
guía de qué hacer. `harness init` en la terminal es otro asistente que no menciona Studio.

Esta spec arma un **primer uso guiado de punta a punta**: Conectar Claude → Crear el proyecto (wizard)
→ Conectar GitHub → Primera idea / primera spec, visible como una lista de pasos que se completa sola.

## Historias de usuario
- US-1 — Como dev nuevo, al abrir Studio sin proyecto quiero ver los pasos del primer uso y cuál me
  toca, y poder conectar Claude desde ahí.
- US-2 — Como dev, al terminar la generación quiero conectar el proyecto nuevo a GitHub sin salir del
  flujo (o saltearlo) antes de abrirlo.
- US-3 — Como dev, al abrir el proyecto quiero que Home me muestre los pasos que faltan (GitHub si lo
  salteé, primera idea a Hermes, primera spec) y que se marquen solos al cumplirse; puedo ocultarlos.
- US-4 — Como dev en la terminal, quiero que `harness init` sin flags me ofrezca abrir el wizard de
  Studio como camino recomendado, sin quitar el asistente de terminal.

## Decisiones del dev (2026-11-07)
- Alcance: primer uso guiado completo (Claude → wizard → GitHub → primera idea/spec) y `harness init`
  ofrece abrir ese recorrido.

## Restricciones
- Los pasos se derivan del estado real (auth, proyecto abierto, remoto de GitHub, specs registradas);
  lo único guardado es «ocultar la guía».
- Nada se hace hacia afuera sin confirmación (GitHub usa el flujo de la spec 014).
- Compatibilidad: con un puente viejo sin `github.*`, el paso de GitHub se muestra como no disponible.

## Ciclos propuestos
- **cycle-01 — Guía del primer uso (US-1..US-4).** Lista de pasos en launcher y en Home, conectar
  Claude desde el launcher, paso GitHub tras la generación, `harness init` ofrece Studio.

## Dependencias
- spec-e-burgos-014-github-integration (cycle-02: comandos `github.*` del puente).
