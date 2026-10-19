# @e-burgos/sdd-studio

> Local bridge for **SDD Studio** — a Slack-like workspace to run the agents of the SDD kit
> on your own repo, from the browser, with Claude running on your machine.
>
> 🧭 **App:** [studio.sdd.estebanburgos.com.ar](https://studio.sdd.estebanburgos.com.ar) ·
> 📖 **SDD Harness docs:** [sdd.estebanburgos.com.ar](https://sdd.estebanburgos.com.ar)

## Quick start

1. **Your repo needs the SDD kit** (an `sdd/` folder at the root). If it does not have one yet:

   ```bash
   npx @e-burgos/sdd-harness configure sdd   # existing repo
   npx @e-burgos/sdd-harness init            # new project
   ```

2. **At the root of the repo, start the bridge:**

   ```bash
   npx @e-burgos/sdd-studio
   ```

3. **Your browser opens SDD Studio already paired with the repo.** From there you chat with the
   Orchestrator (or DM any agent), watch who is working live, approve each action, and follow
   specs, cycles and tasks as they change.

## What you get

- **Channels** — `#general`, one channel per spec, `#fixes`, plus a DM with each kit agent
  (Orchestrator, Functional, Planner, Architect, Impl-back, Impl-front, Reviewer, Steward).
- **Live threads** — agent and subagent messages with their names, grouped tool activity and
  diffs, usage per turn (model, effort, tokens, cost).
- **Approvals in chat** — every tool call that needs permission shows its full input; approve,
  deny with a reason, or allow it for the thread.
- **SPEC GATE enforced** — code edits without an `in-progress` cycle or an open fix are denied,
  in every permission mode.
- **Model and effort per thread** — `kit` (as the agents decide per `AGENTS.md`) or a fixed
  model (`haiku`, `sonnet`, `opus`, `fable`) and effort.
- **Kit commands** — `/gate`, `/validate` and the kit prompts (`/open-cycle`, `/review`,
  `/hotfix`, `/check`, `/resume`, `/steward`).
- **sdd-bot** — specs, cycles, tasks and fixes changing on disk show up in their channel.

## How it works

```
Browser (studio.sdd.estebanburgos.com.ar)        Your machine
┌───────────────────────────┐   WebSocket    ┌──────────────────────────────────────┐
│ SDD Studio web (static)   │◄──────────────►│ sdd-studio (this package)            │
│ never sees credentials    │  127.0.0.1 +   │  ├─ reads/watches sdd/               │
└───────────────────────────┘  pairing token │  ├─ Claude Agent SDK → kit agents    │
                                              │  └─ history in .sdd-studio/          │
                                              └──────────────────────────────────────┘
```

The web is a static page; everything that touches your code runs in the bridge, on your machine.

## Requirements

- Node 20 or later.
- Claude Code signed in (`claude login`) **or** `ANTHROPIC_API_KEY` in the environment.
- Chrome or Firefox. In **Chrome**, allow the "local network access" permission the first time.
  **Safari** blocks a secure page from talking to `127.0.0.1` — use `--local-ui`.

## Options

| Option | Default | Description |
|---|---|---|
| `--root <dir>` | current directory | Repo root (where `sdd/` lives) |
| `--port <n>` | `4320` (or the next free one) | WebSocket port on 127.0.0.1. An explicit `--port` is strict: it fails if the port is busy |
| `--engine claude\|fake` | `claude` | `fake` spends no tokens (demo and tests) |
| `--local-ui` | — | Serve the web from the bridge itself (`http://127.0.0.1:<port>/w/`): offline use, or browsers that block the hosted page (Safari) |
| `--web-url <url>` | `https://studio.sdd.estebanburgos.com.ar` | Web to open |
| `--allow-origin <a,b>` | — | Extra allowed browser origins |
| `--no-open` | — | Don't open the browser (the pairing link is printed) |
| `--token <t>` | generated | Fixed pairing token (≥16 chars `[A-Za-z0-9_-]`), for tests/scripts only: it is visible in the process list |

Invalid values abort with an error message.

## Authentication

- Without `ANTHROPIC_API_KEY`: the bridge uses your **local Claude Code login**.
- With `ANTHROPIC_API_KEY`: it uses the API key.

The bridge never reads, stores or sends credentials; the web only learns which mode is active.

> **Note:** per the Claude Agent SDK docs, unless previously approved, Anthropic does not allow
> third-party developers to offer claude.ai login or rate limits for their products, including
> agents built on the Claude Agent SDK.

## Security

- Listens on `127.0.0.1` only; every connection must present the pairing token printed at start
  (a new one on every run) and come from an allowed browser origin.
- Reads files only under `sdd/`; runs only the kit scripts (`spec-gate`, `validate-sdd`,
  `rebuild-tasks-index`, `rebuild-catalog`), without a shell.
- Code edits go through the kit's **SPEC GATE** in a `PreToolUse` hook — also in `acceptEdits` mode
  and for tools allowed by `.claude/settings.json`. Other approvals show the full tool input;
  "always in this thread" applies only to the exact Bash command or to non-edit, non-MCP tools.
- Agents inherit the MCP connectors of your Claude account; each call still asks for approval.

## Local data

Thread history lives in `.sdd-studio/` at the repo root; the folder ignores itself in git.

## Troubleshooting

| Symptom | Fix |
|---|---|
| The page says the token is not valid | The bridge was restarted: open the new link it printed |
| "No bridge is listening on port …" | Start `npx @e-burgos/sdd-studio` in the repo (or check the port) |
| Chrome never connects | Allow "local network access" for the site (lock icon → site settings) |
| Safari never connects | Use `npx @e-burgos/sdd-studio --local-ui` |
| "No sdd/ folder found in …" | Run it at the repo root, or install the kit first (see Quick start) |

## License

MIT
