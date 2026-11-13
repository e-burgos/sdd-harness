# video-maker — product videos from the repo (optional)

> [video-maker](https://github.com/e-burgos/video-maker) is a local video studio: promos, reels,
> explainers and recorded tutorials, with voice, music, motion and rendering on your machine. This
> switch links the repo to video-maker so agents can produce videos of the product from the code,
> the brand and the repo's material. It is optional and off by default.

## What it is and who decides

- **Claude Code:** the kit declares the **plugin** `video-maker@video-maker` (marketplace from the
  `e-burgos/video-maker` repo) in `.claude/settings.json`. The plugin brings its skills
  (`video-maker`, `video-maker-brand`, `video-maker-motion-brief`, `video-maker-screen-capture`,
  `video-maker-raw-material`) and its own MCP server, so the kit does **not** add `video-maker` to
  `.mcp.json` (it would be registered twice).
- **GitHub Copilot, Gemini CLI and Antigravity:** a `video-maker` entry in `.vscode/mcp.json` and
  `.gemini/settings.json` with `@e-burgos/video-maker-mcp` at a pinned version (never `latest`).
  These harnesses get the tools; the plugin's skills are Claude Code only.
- **Switch:** `video_maker` in `sdd/tools.json` (`enabled`, `plugin`, `mcp`, `version`). Turning
  it on or off is **the dev's decision**; the agent never changes it on its own. The sdd-steward
  operates it on request.

## Commands

```bash
pnpm sdd:video -- --status                      # read-only, no network; prints JSON
pnpm sdd:video -- --enable                      # turns on or repairs (plugin + MCP)
pnpm sdd:video -- --enable --parts=plugin       # Claude Code plugin only
pnpm sdd:video -- --enable --parts=mcp          # Copilot and Gemini MCP only
pnpm sdd:video -- --enable --force               # bumps the entries to the version the kit pins
pnpm sdd:video -- --disable                     # turns off and removes only what the kit wrote
```

No arguments means `--status`, which reports `state` (`off`, `complete` or `incomplete`), the
plugin and each MCP file, the state per harness, `update_available` and, when something is
missing, the repair command. None of this uses the network: Claude Code downloads the plugin and
`npx` fetches the MCP the first time a harness launches it.

In Claude Code, after `--enable` the next session offers to install the plugin from the
marketplace (or run `/plugin install video-maker@video-maker`). `--disable` removes only the keys
and entries the kit wrote; your own marketplace definition or MCP entry is left alone.

## Requirements

- **Node 22 or newer** for the MCP (`--enable` warns when your Node is older).
- **The video-maker studio running** on your machine: the MCP talks to it over HTTP. Today:
  `pnpm studio` in a clone of `e-burgos/video-maker`, in its own terminal (not from a harness
  preview server: it gets killed and looks like a crash), or an explicit studio through
  `VIDEO_MAKER_API_URL` + `VIDEO_MAKER_API_TOKEN`. The desktop app does not publish its address
  to the MCP yet; its next version will.
- Nothing else in your repo: no ffmpeg, no Remotion, no `brand.json`. The brand lives in the
  studio (`create_brand` / `update_brand`) and material is uploaded from any path. Only the
  recorded-tutorial mode uses Playwright with Chromium in your repo.

## End-to-end flow (driven by the `video-maker` skill)

1. `studio_status` and `get_capabilities`; the agent reads the repo.
2. It picks the mode: **motion** (promo, sales, explainer, reel) or **footage** (recorded tutorial).
3. One round of questions and your OK.
4. Brand: `list_brands` and, if needed, `create_brand`, `update_brand`, `upload_brand_file`.
5. `create_project`.
6. Motion: `write_motion_brief` → storyboard job (3–6 min) → review and your OK →
   `propose_production` → **you approve it in the studio** → video job → visual review.
   Footage: Playwright recording → `upload_asset` → script → voice, montage and timeline →
   `propose_production` → render → review.
7. You publish and delete publications from the studio: the MCP does not expose them.

Known traps: without the `propose_production` approval the render fails with
`PROPOSAL_NOT_APPROVED`; check every voice-over against the script (the voice paraphrases and
reads URLs aloud); brand photos are used as `brand:<key>` without uploading them again; save the
storyboard before rendering.

## From the CLI

`harness init --video-maker | --no-video-maker` and `harness configure sdd --video-maker` (repos
without the kit). With the kit already installed: `pnpm sdd:video -- --enable`. `harness update
sdd` never overwrites `sdd/tools.json`, so the switch survives updates; new kit versions may bump
the pinned MCP version and `--status` reports it with `update_available`.

## Validation

`pnpm sdd:validate` warns (never fails) when the integration is on and incomplete or when
`video_maker` has unknown keys.

## Windows

MCP entries use `cmd /c npx` on Windows, same as tucu-ui.
