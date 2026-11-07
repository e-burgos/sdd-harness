# spec-e-burgos-019-studio-entry-wizard — cycle-01 — 2026-11-07

## Estado
Sin puente conectado, Studio abre un wizard de entrada de pantalla completa (EntryWizard) en lugar de «Conectá tu repo»: bienvenida con órbita de agentes y la costura del shader, camino (proyecto nuevo recomendado / repo existente / puente corriendo), requisitos, lo que viene (línea de tiempo de los Primeros pasos) y conectar (comandos, enlace pegado validado y ayuda de bloqueos; con error de conexión abre en ese paso).

## Estructura
- `components/entry/` (`EntryWizard` COMP-130, `EntryProgress`, `EntryBackdrop` COMP-131, `CommandLine`, `entry-model`, `entry-storage`, `bridge-link` con `parsePairing`) y `components/entry/steps/` (`WelcomeStep`, `AgentOrbit` COMP-132, `PathStep`, `RequirementsStep`, `JourneyStep`, `ConnectStep`, `PasteLinkForm` COMP-133, motion GSAP en `*-motion.ts`); i18n `modules/entry.ts`; `--text-hero` en `globals.css`.
- `ConnectScreen` eliminado; `page.tsx` y `WorkspaceApp.tsx` usan `EntryWizard`.
- Contenedor de pantalla completa con `overflow-clip` (no `overflow-hidden`): el foco no lo desplaza.

## Dependencias
- Ninguna nueva (GSAP y framer-motion ya estaban).

## Qué sigue
- Sin detección automática del puente desde la web.
