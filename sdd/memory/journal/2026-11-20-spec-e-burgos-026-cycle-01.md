# spec-e-burgos-026-studio-claude-tools · cycle-01 — 2026-11-20

- Verificar con una sonda del SDK real (query abortada al recibir `system/init`, sin turno del modelo) qué carga el motor antes de diseñar sobre opciones del Agent SDK: así se eligió `deniedMcpServers` frente a `toggleMcpServer` y se midió el costo de cada fuente.
- Claude in Chrome no anda con API key (Claude Code la apaga aun con `--chrome`); con API key el navegador va por chrome-devtools-mcp, y `--autoConnect` además exige habilitar la depuración remota en `chrome://inspect/#remote-debugging` — que el MCP diga «connected» no prueba que llegue al navegador.
- No importar el bin de un CLI (`dist/cli.js`) desde un script de prueba: se ejecuta al cargarse y levanta un proceso real (pasó con el puente).
- Si un spec de contrato del puente falla por versión de la CLI, recompilar `apps/cli` antes de diagnosticar: usa el `dist` local.
