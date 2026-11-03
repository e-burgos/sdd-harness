# spec-e-burgos-009-studio-tucu-ui — cycle-07 · plan (lite)

> Módulo: studio-tucu-ui | Subproyecto: apps/studio | Fecha: 2026-11-02
> Objetivo: Studio pasa a `@e-burgos/tucu-ui@3.10.0`, que da a Alert, Tooltip, Badge, ConfirmDialog, ColorCard, Button y las variantes `color` de los campos sus tonos por tokens `--tucu-*` en `@layer components` (sin `dark:` ni `!important`). Se borran los overrides con `!` y las variantes `dark:` que Studio agregaba sobre esos componentes, y donde haga falta un tono propio se pisa el token del grupo «Tones». Antes de abrir, se consolida el contexto de `apps/studio` (5 fragmentos).
> Fuera de alcance: cambios de distribución o de comportamiento. Sin PR: solo commits.

## Historias
- US-016 — Como dev de Studio quiero usar 3.10.0 sin los overrides de color que ya resuelven sus tokens. CA: dependencia exacta 3.10.0; ningún `className` con `!` ni `dark:` de color sobre Alert, Tooltip, Badge, ConfirmDialog, Button ni los campos con `color`, salvo los que sigan haciendo falta (se mantienen y se reportan a tucu-ui); los tonos propios de Studio, si los hay, como tokens en `globals.css`; ningún Select con `appearance="neutral"` depende de `color`; mismo aspecto en claro y oscuro; los e2e no cambian selectores.

## Tasks
- TASK-001 — Base 3.10.0 y limpieza de overrides según US-016. Valida: build, typecheck, test.
- TASK-002 — Verificación y cierre: `build:local` → bridge → e2e, recorrida visual en los dos modos y fricciones nuevas a tucu-ui.

## Decisiones técnicas
- TASK-001 la hace un subagente sonnet/medium; la consolidación del contexto corre en paralelo (otro subagente, solo `sdd/context/apps/studio/`).
- Lo que 3.10.0 no resuelva se mantiene y se reporta a la sesión de tucu-ui.
