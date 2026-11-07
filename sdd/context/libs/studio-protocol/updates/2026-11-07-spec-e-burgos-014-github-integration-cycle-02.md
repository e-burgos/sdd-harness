# spec-e-burgos-014-github-integration — cycle-02 — 2026-11-07

## Estado
Feature `github`; comandos `github.status {generationId?}` → `GithubStatus` y `github.connect {generationId?, name?, owner?, visibility, protect}` → `GithubConnectResult`; `WorkspaceSnapshot.github` opcional (`SnapshotGithub`: remoto y `CycleGithub[]` con rama, PR y checks; tope `MAX_GITHUB_CYCLES` 64). `PROTOCOL_VERSION` no cambia.

## Estructura
- `src/github.ts` (+ `github.spec.ts`), entradas en `commands.ts`, `snapshot.ts` y `limits.ts` (`BRIDGE_FEATURES`).

## Dependencias
- Ninguna nueva (usa `gh` del dev a través de la CLI del kit).

## Qué sigue
- spec 018 usa `github.*` con `generationId` en el onboarding.
