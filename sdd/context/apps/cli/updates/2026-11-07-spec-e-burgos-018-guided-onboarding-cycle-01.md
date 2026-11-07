# spec-e-burgos-018-guided-onboarding — cycle-01 — 2026-11-07

## Estado
`harness init` interactivo pregunta si seguir en Studio (recomendado) o en la terminal; `--studio` / `--terminal` saltan la pregunta. Studio corre `npx -y @e-burgos/sdd-studio@latest` en la carpeta destino.

## Estructura
- `src/utils/studio-launch.ts` (`resolveStudioRoute`, `launchStudio`, `setStudioSpawner`), `commands/init.ts` (`chooseOnboardingRoute`, `runStudioFlow`); docs INSTALL es/en con el arranque recomendado.

## Dependencias
- Ninguna nueva.

## Qué sigue
- Probar el spawn real de `--studio` después del próximo release (hoy abre el Studio publicado).
