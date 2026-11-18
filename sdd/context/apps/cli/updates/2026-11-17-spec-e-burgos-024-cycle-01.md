# apps/cli — spec-e-burgos-024 cycle-01 (session-where)

## Estado
El mod de Claude Code lee las unidades de todos los worktrees del repo y muestra dónde trabaja la
sesión (unidad, flow o tipo de fix, y worktree). La sesión se ata desde el GATE A (spec en
preparación), al escribir documentos de la spec o del ciclo, al editar código en un worktree con
una sola unidad, por rama (id o slug) y con `sdd:use` desde el worktree de la unidad. Regla ① en
los arneses.

## Estructura
- `templates/sdd/scripts/lib/session-registry.mjs` (copia idéntica en `skills/sdd-mod/hooks/.src/`):
  `listWorktrees`, `worktreeOf`, unidad `{ kind: 'spec' }`, `parseBindTarget`, marca
  `SDD-BIND … worktree=<uri>`, `unitFromSpecPath`, rama por slug; `listLiveBindings` oculta las
  ataduras a spec salvo `{ includeSpec: true }` (Studio no las conoce).
- `skills/sdd-mod/hooks/.src/sdd.ts`: snapshot multi-worktree (`root`, `worktrees`, `specs`,
  `worktree` en ciclos y fixes), `bindFromEdit`, `bindFromCommand` devuelve `{ bound } | { rejected }`,
  gate y reservas contra el worktree del archivo.
- `sdd-use.mjs` (`<spec>` sin ciclo) y `spec-gate.mjs` (marca en A y B) imprimen el worktree.
- Bloque `regla-cero` de CLAUDE/AGENTS/GEMINI.md suma ① REGLA UNO; validador avisa si falta.

## Dependencias
Sin dependencias nuevas.

## Qué sigue
Studio no muestra ataduras a una spec en preparación (las filtra el registro); sumarlas es un ciclo
de studio-bridge/studio-protocol.
