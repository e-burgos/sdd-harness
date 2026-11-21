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
Opción (a): cuando `.claude/skills` resuelve a `sdd/skills`, la integración ya no lo convierte en carpeta;
crea su enlace en la ruta `.claude/skills/tucu-ui-design`, que físicamente queda en `sdd/skills/tucu-ui-design`
con el mismo destino relativo que los demás (`../../sdd/integrations/skills/tucu-ui-design`: `sdd/skills` está a
la misma profundidad que `.claude/skills`). Así `.claude/skills` sigue siendo el symlink versionado (git no ve
cambio de tipo), y ni restaurarlo ni re-correr `setup-agents` borra el enlace. `kitLinkState`, `--status`,
`--disable` y `validate-sdd` funcionan sin cambios porque resuelven a través del symlink padre.

Por qué no (b): que `setup-agents` arme `.claude/skills` como carpeta con enlaces por skill cambiaría el tipo de un
archivo versionado en todos los repos ya instalados (el mismo `D .claude/skills` del bug, para todos).

Para que el enlace dentro de `sdd/skills` no se confunda con una skill del kit:
- `setup-agents.sh/.ps1` saltean los symlinks/junctions (y en `.ps1` los enlaces degradados a texto) de `sdd/skills`
  al enlazar por skill en `.github/skills`, `.agents/skills` y en carpetas reales: la integración enlaza cada arnés.
- `rebuild-catalog.mjs` usa `lstatSync`: el enlace no entra a `catalog.json` y `validate-sdd` no lo da por desactualizado.
- `tucu-ui-common.mjs`: un archivo de texto con el destino del enlace (checkout sin `core.symlinks`) es `kit-degraded`
  y `sdd-tucu` lo recrea como enlace.
- `update sdd` no necesita cambios: recorre solo los archivos del kit y del manifiesto anterior, y el enlace no está
  en ninguno (verificado con generación real). Video-maker no enlaza skills: no comparte el problema.

Repos que ya tenían `.claude/skills` convertido en carpeta siguen funcionando (el enlace va dentro de la carpeta real).
En este repo se copiaron los scripts del kit a `sdd/scripts/` (eran idénticos al kit antes del cambio; no se usó
`update sdd` para no regenerar `kit.json`/catálogo) y se corrió `node sdd/scripts/sdd-tucu.mjs --enable`:
`--status` ⇒ los cuatro arneses `complete`, `pnpm sdd:validate` sin warning de tucu.

Verificación: `pnpm --filter @e-burgos/sdd-harness test` (998 ok), `pnpm typecheck` ok. Generación real en
`examples/test-fix-015` (`configure sdd` con la CLI construida + `sdd-tucu --enable` con red): `setup-agents`
re-corrido, `.claude/skills` restaurado a symlink + `setup-agents`, `rebuild-catalog` sin diff, `validate-sdd` sin
avisos de tucu y `update sdd` conservando `sdd/skills/tucu-ui-design`.

### Archivos modificados
- `apps/cli/templates/sdd/scripts/sdd-tucu.mjs` (+ copia en `sdd/scripts/`)
- `apps/cli/templates/sdd/scripts/tucu-ui-common.mjs` (+ copia)
- `apps/cli/templates/sdd/scripts/setup-agents.sh` (+ copia)
- `apps/cli/templates/sdd/scripts/setup-agents.ps1` (+ copia)
- `apps/cli/templates/sdd/scripts/rebuild-catalog.mjs` (+ copia)
- `apps/cli/src/generators/__tests__/tucu-ui.integration.spec.ts`
