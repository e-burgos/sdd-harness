# spec-e-burgos-019-studio-entry-wizard — cycle-01 · plan (lite)

> Módulo: studio-entry-wizard | Subproyecto: apps/studio | Fecha: 2026-11-07 · Rama `feat/studio-entry-wizard`.
> Objetivo: reemplazar `ConnectScreen` por un wizard de entrada de pantalla completa con graphic motion.

## Historias y criterios
- US-1 Bienvenida: hero de pantalla completa con motion (rieles/costura del wizard de spec 016),
  título y bajada claros, CTA «Empezar» (y «Ya tengo el puente corriendo» como link secundario).
- US-2 Camino: tres puertas (proyecto nuevo recomendado / repo existente / ya tengo el puente), con
  teclado y foco visibles; la elección se recuerda en la sesión.
- US-3 Requisitos: Node 20+ (`node -v`) y Claude Code (`claude` con sesión o `ANTHROPIC_API_KEY`),
  cada uno con verificar / resolver y un check «lo tengo»; se puede seguir igual (son guías).
- US-4 Conectar: comandos del camino con copiar; aviso de que la terminal abre Studio sola; campo
  «pegá el enlace» que valida el formato (`#bridge=<puerto>&token=<token>`) y navega; ayuda para
  bloqueos (Chrome red local, Safari/sin internet → `--local-ui`). Con error de conexión
  (`ConnectScreen error`) el wizard abre en este paso con el error y la ayuda.
- US-5 Lo que viene: línea de tiempo animada de los Primeros pasos dentro de Studio.

## Tasks
- TASK-001 — Wizard de entrada: estado de pasos, pantallas US-1..US-5 con motion (`crafted-motion`),
  i18n es/en, reemplazo de `ConnectScreen` en `page.tsx` y `WorkspaceApp.tsx` (incluido el caso de
  error); tests (pasos, validación del enlace, reduced-motion, error).
- TASK-002 — Verificación real en el navegador (desktop y mobile, es/en, reduced-motion), e2e de
  Playwright actualizado si cubría `ConnectScreen`; cierre.

## Decisiones técnicas
- Sin detección automática del puente: no expone rutas sin token (HTTP 426) y la web es https; el
  puente ya abre el navegador conectado y el enlace pegado cubre el resto.
- Reutiliza los primitivos de motion del wizard (spec 016) y tucu-ui; nada de librerías nuevas
  salvo que la skill `crafted-motion` lo indique (GSAP ya está en Studio).
- Flow lite (profile solo): un subproyecto, sin contratos.
