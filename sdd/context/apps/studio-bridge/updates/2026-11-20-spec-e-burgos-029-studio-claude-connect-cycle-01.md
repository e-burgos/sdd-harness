# spec-e-burgos-029-studio-claude-connect · cycle-01 — 2026-11-20

## Estructura
- `workspace/studio-chrome.ts`: Chrome propio de Studio (`--remote-debugging-port=9333 --user-data-dir=~/.sdd-studio/chrome-profile`), lanzado si no responde; instancia única compartida por motor, estado y router. El motor usa `chrome-devtools-mcp --browserUrl http://127.0.0.1:9333` (sin `--autoConnect`).
- `workspace/chrome-status.ts`: estado por `GET /json/version` (nunca WebSocket: no dispara avisos), bot event al cambiar.
- `workspace/claude-mcp.ts`: `claude mcp login` del binario del SDK (resuelto desde el paquete del SDK) bajo pty con `python3 -c 'import pty…'`; sin python3 o en Windows abre una terminal del sistema (`terminal`). `reconnect` = sonda de inventario.

## Dependencias
- `--autoConnect` pide permiso en cada conexión nueva; `claude mcp login` exige TTY; el paquete de plataforma del SDK solo se ve desde el SDK con pnpm.
