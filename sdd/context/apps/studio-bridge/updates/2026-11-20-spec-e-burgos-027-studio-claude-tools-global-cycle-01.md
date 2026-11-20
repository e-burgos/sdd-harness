# spec-e-burgos-027-studio-claude-tools-global · cycle-01 — 2026-11-20

## Estructura
- Config de Claude global en `~/.sdd-studio/claude-tools.json` (`SDD_STUDIO_HOME` reemplaza el home; `src/test-utils/studio-home.ts` lo fija en un tmpdir para todos los specs vía `setupFiles`). Efectiva = override del proyecto (`<root>/.sdd-studio/claude-tools.json`) → global → defaults. Revisión = hash de alcance + bytes.
- `set` sin `scope` escribe en el alcance efectivo; `scope:'project'` crea el override; `scope:'global'` escribe la global sin tocar el override; `claude.tools.useGlobal` borra el override. Un cambio global recalcula la caché de todas las raíces del proceso.

## Qué sigue
- Otro proceso del puente ve un cambio de la global recién en su próximo get/set.
