# spec-e-burgos-017 cycle-01 — sesiones en paralelo

## Qué pasó
Para verificar el mod de Claude Code con sesiones reales, el CLI de la terminal (2.1.123) rechazó el mod entero (formato «modules» de hooks.json) y `claude -p` no cargaba los mods de `.claude/skills`, así que las primeras pruebas parecían mostrar un gate que no actuaba.

## Lección
Para probar un mod de Claude Code en uso real, usar el binario del motor de la app de escritorio (`~/Library/Application Support/Claude/claude-code/<ver>/…/claude`) con `--plugin-dir`; el CLI de terminal puede ser demasiado viejo y `-p` no autocarga mods de carpetas de skills.

## Costo evitable
Un rato diagnosticando el gate y el formato de hooks.json antes de comprobar la versión del binario.
