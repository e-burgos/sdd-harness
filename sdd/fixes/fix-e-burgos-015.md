# FIX-e-burgos-015 — La integración tucu-ui convive con `.claude/skills` enlazado a `sdd/skills`

## Problema
`setup-agents` enlaza `.claude/skills` entero a `sdd/skills`, y la integración tucu-ui (`sdd/scripts/sdd-tucu.mjs`)
necesita un enlace propio `tucu-ui-design` dentro de `.claude/skills`. Los dos scripts se pisan: al prender la
integración se reemplaza el symlink por una carpeta (git ve `D .claude/skills`), y cuando el symlink vuelve el
enlace de tucu se pierde. Resultado real: `sdd-tucu --status` ⇒ `claude: incomplete`, `.claude/skills: missing`,
y `sdd:validate` avisa aunque el dev haya corrido `pnpm sdd:tucu -- --enable`.

## Justificación del bypass
Cambio en el kit publicado (`apps/cli/templates/sdd/`): las reglas del repo piden flow `full`; el dev pidió
resolverlo por FIX GATE (2026-11-20).

## Solución aplicada
- (se completa al resolver)

### Archivos modificados
- (se completa al resolver)
