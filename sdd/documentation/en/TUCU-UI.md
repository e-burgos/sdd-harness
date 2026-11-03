# tucu-ui — design skill and MCP (optional)

> `@e-burgos/tucu-ui` is a UI library for React and Next. This switch gives the agents its
> **design skill** (`tucu-ui-design`) and its **MCP server** (`tucu-ui`) on all four harnesses:
> Claude Code, GitHub Copilot, Gemini CLI and Antigravity. It is optional and meant for repos with
> a React or Next frontend.

## What it is and who decides

- **Skill:** installed once in `sdd/integrations/skills/tucu-ui-design/` and linked into
  `.claude/skills`, `.github/skills` and `.agents/skills`.
- **MCP:** a `tucu-ui` entry in `.mcp.json`, `.vscode/mcp.json` and `.gemini/settings.json`, with
  the `@e-burgos/tucu-ui-mcp` version pinned (never `latest`).
- **Switch:** `tucu_ui` in `sdd/tools.json`. Turning it on or off is **the developer's call**; the
  agent never changes it on its own. The sdd-steward operates it on request.

## Commands

```bash
pnpm sdd:tucu -- --status                       # read-only, no network; prints JSON
pnpm sdd:tucu -- --enable                       # turn on or repair (skill + MCP)
pnpm sdd:tucu -- --enable --parts=skill         # skill only (exact set of parts)
pnpm sdd:tucu -- --enable --parts=mcp           # MCP only
pnpm sdd:tucu -- --enable --force               # reinstall the skill at the version the kit pins
pnpm sdd:tucu -- --disable                      # turn off and clean up only what the kit wrote
pnpm sdd:tucu -- --disable --purge              # also delete sdd/integrations/skills/tucu-ui-design
```

No arguments is the same as `--status`. An invalid combination (`--enable` with `--disable`, an
unknown `--parts`, `--purge` without `--disable`, `--force` without `--enable`) exits with code 2
and prints the usage.

`--status` reports `state` (`off`, `complete` or `incomplete`), the state of every link and MCP
file, the state per harness, `update_available` and, when the state is `incomplete`, the repair
command.

`--enable` is all-or-nothing on `tools.json`: if a step fails (no network, invalid MCP file, Node
below 20) the switch stays as it was and the message says how to continue. Whatever was already
written to disk is safe: another `--enable` completes it and `--disable` cleans it up.

## Generated frontend apps: tucu-ui by default

The CLI scaffolds `react`, `nextjs`, `next-bff`, `mfe-shell` and `mfe` apps **with tucu-ui** already
wired: the pinned dependency, Tailwind v4 importing its styles, `ThemeProvider` (Vite apps) or
`NextThemeProvider` from `@e-burgos/tucu-ui/next` (Next apps) and an example screen. Generating one
also turns this integration on. `--no-tucu-ui` (or `apps[].tucuUi: false` in `init --config`)
generates a plain app and keeps the integration off.

| App type    | What it is                                                                                  | Config fields                  |
| ----------- | ------------------------------------------------------------------------------------------- | ------------------------------ |
| `react`     | Vite + React SPA                                                                            | `tucuUi`                       |
| `nextjs`    | Next 16 App Router                                                                          | `tucuUi`                       |
| `next-bff`  | Next App Router whose `app/api/*` routes call a service at `<APP>_UPSTREAM_URL` (monorepo only) | `tucuUi`                   |
| `mfe-shell` | Vite shell: dev proxy, menu, `nginx.conf` and a combined `Dockerfile` for its mfes (monorepo only) | `tucuUi`                |
| `mfe`       | Vite app with `base: '/<name>/'` served behind a shell (monorepo only)                      | `tucuUi`, `shell`              |
| `python`    | FastAPI + LangGraph managed with uv; TensorFlow behind `ml` (not a frontend)                | `ml`                           |

- `next-bff`, `mfe-shell` and `mfe` exist only in Nx monorepo mode; standalone fails with a clear
  message. An `mfe` needs `shell` when the workspace has more than one `mfe-shell`.
- Default ports: `next-bff` 3001, `mfe-shell` 4200, `mfe` 4201 (+1 per extra mfe), `python` 8000;
  `apps[].port` overrides them and every app reads `<APP>_PORT`.
- `harness add app mfe --name <mfe> --shell <shell>` adds an mfe to an existing shell and updates the
  shell's proxy, menu, `nginx.conf` and `Dockerfile` idempotently; `harness add app python --ml`
  adds TensorFlow.

## From the CLI

```bash
harness init --tucu-ui            # turn tucu-ui on while generating the project
harness init --no-tucu-ui         # keep it off, no prompt
harness configure sdd --tucu-ui   # adds the SDD kit to a repo that does not have it yet
pnpm sdd:tucu -- --enable         # repo that already has the kit: this is the way
```

`configure sdd` is for installing the kit in a repo that does not have it yet: if `sdd/` already
exists it asks to **reset the whole directory** (specs, cycles and fixes included) and with `-y` it
resets without asking. To turn tucu-ui on in a repo with the kit installed, use
`pnpm sdd:tucu -- --enable`.

- `harness init` with no flag turns tucu-ui **on by default** when there is a frontend app
  (`react`, `nextjs`, `next-bff`, `mfe-shell`, `mfe`): the apps are scaffolded with tucu-ui and the
  kit integration is enabled. `--no-tucu-ui`, `sdd.tucu_ui: false` in `--config`, or `tucuUi: false`
  on every frontend app keeps it off. `configure sdd` with no flag **only asks when there is a
  `react` or `nextjs` app** and the terminal is interactive; with `--yes` or without a TTY it stays
  off, and it keeps an existing `tucu_ui` on when it resets the kit.
- `--tucu-ui` together with `--no-tucu-ui` fails before generating anything.
- In `init --config`, `sdd.tucu_ui: true | false` acts as the default; the flag wins.
- If the install fails during `init` (for example offline), `init` does not abort: it finishes the
  generation, leaves tucu-ui off and prints the command to retry.
- `harness configure mcp` has `tucu-ui` in its catalog and **merges**: servers outside the catalog
  are kept; one with a catalog name (`github`, `figma`...) is written from the catalog when selected
  and removed when deselected. The one exception is a `tucu-ui` entry the kit did not write, which
  is kept. It does not touch the switch; if you remove
  `tucu-ui` that way while the switch is on, `pnpm sdd:validate` warns.

## What it writes per harness

| Harness | Skill (link) | MCP |
| ------- | ------------ | --- |
| Claude Code | `.claude/skills/tucu-ui-design` | `.mcp.json` → `mcpServers.tucu-ui` |
| GitHub Copilot | `.github/skills/tucu-ui-design` | `.vscode/mcp.json` → `servers.tucu-ui` (with `"type": "stdio"`) |
| Gemini CLI | `.agents/skills/tucu-ui-design` | `.gemini/settings.json` → `mcpServers.tucu-ui` |
| Antigravity | `.agents/skills/tucu-ui-design` | `.gemini/settings.json` → `mcpServers.tucu-ui` |

The canonical MCP entry is the same in the three files:

```json
{ "command": "npx", "args": ["-y", "@e-burgos/tucu-ui-mcp@0.16.0"] }
```

- **It does not overwrite files that are not its own.** It merges: other servers and the rest of
  the keys are kept. A `tucu-ui` entry the kit did not write counts as custom: it is respected and
  `--status` reports it as `custom`. A broken MCP file (invalid JSON) aborts `--enable` before
  anything is written; `--disable` leaves it as it is.
- **Foreign links.** A `tucu-ui-design` that does not point at the kit's folder is reported as
  `foreign` and left alone.
- **`.claude/skills` becomes a real directory.** By default `setup-agents` makes `.claude/skills` a
  symlink to `sdd/skills`. To avoid writing inside `sdd/skills/` (which is kit-owned), the first
  time tucu-ui is linked it is converted into a real directory with one link per skill. In git it
  shows up as a type change of `.claude/skills`. The conversion is permanent and `setup-agents`
  supports it.
- **`setup-agents`** runs `sdd-tucu.mjs --sync` at the end: no network and no installs, it creates
  the missing links when the integration is on and removes the kit's links when it is off. A
  teammate who runs `git pull` ends up aligned.

## Without network

Only `--enable` **without the skill already installed** needs network (it downloads
`@e-burgos/tucu-ui-mcp` with `npx`). Everything else works offline: `--status`, `--disable`,
`--sync`, `pnpm sdd:validate` and `--enable` when the skill is already in
`sdd/integrations/skills/tucu-ui-design/`. Offline, `--enable` fails with a clear message and
`tools.json` is left unchanged.

## Updates

- `harness update sdd` **does not touch** `sdd/tools.json` or `sdd/integrations/`: they are project
  data. Your switch and the installed skill survive any update.
- `tucu_ui.version` is the version the project uses. When the kit pins a newer one, `--status`
  reports `update_available: true` and `pnpm sdd:validate` warns (no network). Apply it with
  `pnpm sdd:tucu -- --enable --force`.
- The `dual-harness/*.md` files are hybrid: a repo with local changes receives them as `.new` next
  to the original. That is the expected kit behavior.

## Validation

`pnpm sdd:validate` **warns, never fails** because of tucu-ui: unknown keys in `tucu_ui`, an
incomplete skill folder, missing or foreign links, MCP files without the entry or broken, and an
outdated version. With the switch off only unknown keys are reported.

## Windows

- Links are created as junctions, like the rest of the kit's skills.
- The committed MCP files always carry the canonical `npx` form so they work on every platform.
  Native Claude Code on Windows requires the `cmd /c` wrapper for `npx`: on `win32`, `--enable`
  also tries a local-scope override (`claude mcp add --scope local …`) that is not committed. If
  `claude` is not on the PATH or fails, it prints the exact command as a warning and continues.
  `--disable` removes it with `claude mcp remove --scope local tucu-ui`.
- The kit recognizes both entry shapes (`npx` and `cmd /c npx`) as its own.

## Requirements

- Node 20 or newer for `--enable` (required by `@e-burgos/tucu-ui-mcp`). The rest of the kit still
  runs on Node 18.
