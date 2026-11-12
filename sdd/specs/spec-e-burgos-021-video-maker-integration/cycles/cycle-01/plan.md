# spec-e-burgos-021-video-maker-integration — cycle-01 · plan (lite)

> Módulo: video-maker-integration | Subproyecto: apps/cli | Fecha: 2026-11-12 · Rama `feat/kit-design-skills` (sale con la 0.21.0).

## Diseño
- `sdd/tools.json → video_maker: { enabled: false, plugin: true, mcp: true, version? }` (+ schema).
- `scripts/video-maker-common.mjs` (puro, espejo de `tucu-ui-common.mjs`): constantes
  (`@e-burgos/video-maker-mcp`, pin `0.1.0`, server `video-maker`, marketplace `video-maker` →
  github `e-burgos/video-maker`, plugin `video-maker@video-maker`, Node ≥ 22), settings, entrada
  MCP del kit (reconoce `npx` y `cmd /c npx`), estado del plugin en `.claude/settings.json`,
  `videoMakerStatus(root)`.
- `scripts/sdd-video.mjs`: `--status` (JSON, sin red) · `--enable [--parts=plugin,mcp]` ·
  `--disable`; MCP solo en `.vscode/mcp.json` y `.gemini/settings.json` (Claude usa el plugin);
  plugin = `extraKnownMarketplaces.video-maker` + `enabledPlugins["video-maker@video-maker"]`.
- `package.json` raíz: `sdd:video`. `validate-sdd.mjs`: aviso si está prendido e incompleto.
- CLI: `harness init` / `configure sdd` con `--video-maker` / `--no-video-maker` (mismo patrón que
  `--tucu-ui`), `update sdd` lo preserva.
- Steward (playbook), README/HOW-TO es/en + `VIDEO-MAKER.md` es/en, CHANGELOG.

## Tasks
- TASK-001 — Kit: common + script + tools.json/schema + validator + script raíz.
- TASK-002 — CLI: flags y oferta en init/configure, preservación en update; tests.
- TASK-003 — Docs y steward; generación real en `examples/` y cierre.
