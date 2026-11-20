# spec-e-burgos-026-studio-claude-tools · cycle-01 — 2026-11-20

## Estructura
- Módulo `claude` en el riel (después de `kit`; requiere la feature `claude-tools`): `components/modules/claude/` con `ClaudePanel` (Fuentes · Plugins · MCP · Navegador), `ClaudeCenter`, `ClaudeProvider`, `use-claude-tools.ts` (get/set con `expectedRevision`, re-pedido en conflicto y en `claude-tools.changed`, refresh de inventario) y `claude-model.ts` (filas, umbrales de costo: skills sumadas > 100 o herramientas MCP sumadas > 50). i18n en `lib/i18n/modules/claude.ts`.
- Los interruptores guardan directo (sin confirmación): el cambio no es destructivo y aplica desde el próximo turno. Claude in Chrome figura «no disponible» con su motivo.
