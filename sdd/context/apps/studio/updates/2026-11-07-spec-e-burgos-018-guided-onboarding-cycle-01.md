# spec-e-burgos-018-guided-onboarding — cycle-01 — 2026-11-07

## Estado
Primer uso guiado: el launcher muestra «Primeros pasos» (Claude → proyecto → GitHub → primera idea/spec) derivados del estado real y permite conectar Claude; tras generar, el resultado ofrece conectar GitHub (GithubConnectPanel por generationId) o «Ahora no»; Home muestra la guía de lo que falta con sus acciones y «Ocultar guía» por proyecto.

## Estructura
- `lib/onboarding.ts` (`onboardingSteps`, `readGuideHidden`/`writeGuideHidden`), `lib/use-claude-connected.ts`; `components/onboarding/` (`OnboardingSteps` COMP-127, `ClaudeConnectDialog` COMP-128, `FirstStepsCard` COMP-129); `GenerationResult` con `GithubStep`; `lib/wizard/persist.ts` suma el skip de GitHub; i18n `modules/onboarding.ts`.
- Estado leído de localStorage en cada render con la raíz vigente (no en el inicializador de useState: la raíz llega después del primer render).

## Dependencias
- Ninguna nueva.

## Qué sigue
- Las puertas con shader del wizard se ven vacías en el navegador integrado (previo).
