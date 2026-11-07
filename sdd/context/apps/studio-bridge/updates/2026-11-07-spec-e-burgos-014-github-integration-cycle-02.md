# spec-e-burgos-014-github-integration — cycle-02 — 2026-11-07

## Estado
El puente atiende `github.status`/`github.connect` delegando en la CLI del kit (`harness github … --json`), también en modo launcher sobre una generación `succeeded`; y suma `snapshot.github` con PR y checks por ciclo en curso (`gh pr view`, cada 60 s y al cambiar los ciclos, solo con remoto de GitHub y gh autenticado).

## Estructura
- `src/github/` (`exec.ts`, `service.ts` `GithubService`, `pr-feed.ts` `createGithubFeed`/`reduceChecks`/`withGithub`); `project/runtime.ts` compone el feed sobre el de sesiones (`refreshGithub`); `server/router.ts` y `main.ts` rutean `github.*` como comandos de host.

## Dependencias
- Ninguna nueva (usa `gh` del dev a través de la CLI del kit).

## Qué sigue
- spec 018: onboarding reusa `github.connect` con `generationId`.
