# spec-e-burgos-021-video-maker-integration — cycle-01 — 2026-11-12

## Estado
El kit trae la vinculación opcional con video-maker (`video_maker` en `sdd/tools.json`, apagada): `pnpm sdd:video -- --status | --enable | --disable` declara en Claude Code el plugin `video-maker@video-maker` (marketplace `e-burgos/video-maker`, trae skills y su propio MCP; `.mcp.json` no se toca) y deja `@e-burgos/video-maker-mcp@0.1.0` fijado en `.vscode/mcp.json` y `.gemini/settings.json`. `harness init` / `configure sdd` aceptan `--video-maker`.

## Estructura
- Kit: `scripts/video-maker-common.mjs` (puro; reusa `readToolsDocument`/`compareVersions` de `tucu-ui-common.mjs`), `scripts/sdd-video.mjs`, sección `video_maker` en `tools.json`/`tools.schema.json` y en `validate-sdd.mjs` (solo avisos), script raíz `sdd:video`.
- CLI: `src/utils/video-maker-run.ts`, flags en `commands/init.ts` y `commands/configure/sdd.ts`.
- Docs: `documentation/{es,en}/VIDEO-MAKER.md`, README §9, steward Playbook 9, sección en `dual-harness/{AGENTS,CLAUDE,GEMINI}.md`.

## Dependencias
- Externa y opcional: `@e-burgos/video-maker-mcp` 0.1.0 (Node ≥ 22) y el plugin del marketplace `e-burgos/video-maker`; requiere el studio de video-maker corriendo.

## Qué sigue
- Cuando la app de escritorio publique `~/.video-maker/studio.json`, la doc puede recomendarla como forma principal de tener el studio.
- Al publicarse versiones nuevas del MCP: subir `VIDEO_MAKER_PINNED_VERSION` (y el test que la fija).
