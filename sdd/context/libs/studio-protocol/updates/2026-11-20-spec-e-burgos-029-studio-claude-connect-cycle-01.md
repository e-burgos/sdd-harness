# spec-e-burgos-029-studio-claude-connect · cycle-01 — 2026-11-20

## Estructura
- `ClaudeBrowserStatus` (`connected` | `chrome-closed` | `unknown` | `off`; `permission-pending`/`debugging-disabled` quedan por compatibilidad), comandos `claude.browser.check`/`openSettings`, `claude.mcp.login {name}` (outcomes ok | not-oauth | header-auth | unknown-server | failed | timeout | terminal, enum tolerante) y `claude.mcp.reconnect {name}`; bot kind `claude-browser.changed`; feature `claude-connect`. `DEFAULT_CLAUDE_TOOLS_CONFIG.browser.enabled = true`.
