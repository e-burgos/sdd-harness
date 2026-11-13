---
name: nx-migration
description: Usar al migrar un workspace Nx a una mayor nueva (22 a 23, 23 a 24), actualizar la versión de Nx de un monorepo, resolver errores después de `nx migrate`, o decidir si subir TypeScript 7 — método de un salto de mayor a la vez, registro como fix en el SDD, checklist de verificación por salto, trampas conocidas por versión y el comando `pnpm sdd:nx-migrate`.
---

# Skill: nx-migration

Migrar Nx es un cambio de infraestructura, no una feature. El método es siempre el mismo: **una
mayor por vez, en una rama, registrado en el SDD, verificado antes de seguir**. Nunca se mezcla con
trabajo de producto: si algo se rompe, el diff tiene que ser solo la migración.

## Método

1. **Rama dedicada** (`chore/nx-<mayor>`), árbol de git limpio. **Nunca en la rama por defecto**: Nx 24
   se niega a correr las migraciones en `main` (ver abajo). El comando crea la rama solo si estás ahí.
2. **Registrar en el SDD** vía FIX GATE: prefijo `[IMPROVEMENT]`, **un fix por migración** (un salto de
   mayor = un fix). Archivos afectados: `package.json`, el lockfile, `nx.json` y las configs de
   proyecto (`project.json`, `tsconfig*`, `eslint`). El fix se cierra **solo después** de verificar.
3. **Un salto por vez** (22 → 23 → 24, jamás saltear): por cada mayor
   1. `npx nx migrate <última de la mayor siguiente>`
   2. instalar con el package manager del repo (`pnpm install`, o npm/yarn según el lockfile)
   3. `npx nx migrate --run-migrations` si apareció `migrations.json`; con Nx >= 24 instalado, sumar
      `--no-agentic` (sin eso Nx puede intentar arrancar un agente de IA: no dependemos de eso). En 22 y 23
      va la forma simple, porque el flag puede no existir
   4. borrar `migrations.json` **solo si el paso 3 corrió de verdad**
   5. aplicar los prompts diferidos que Nx deje en `tools/ai-migrations/` (ver abajo)
   6. verificar (checklist abajo) y recién ahí commitear el salto
4. Un commit por salto, así un salto roto se revierte sin perder los anteriores.

## Comando

```bash
pnpm sdd:nx-migrate -- --to 24          # imprime el plan, no cambia nada
pnpm sdd:nx-migrate -- --to 24 --yes    # ejecuta los saltos
pnpm sdd:nx-migrate -- --to 24 --json   # salida estructurada para agentes
```

Detecta la mayor actual de `nx` en el `package.json` raíz, arma los saltos (`actual+1 … --to`),
resuelve la última versión de cada mayor con `npm view nx@<N> version` y, con `--yes`, ejecuta por
salto los pasos 3.1 a 3.4 sin shell. Reglas: exige árbol limpio, si estás en `main`/`master` (o en la
rama por defecto del remoto) crea y cambia a `chore/nx-<mayor destino>` antes de tocar nada, frena en el primer fallo diciendo
qué salto y paso falló, y **nunca commitea ni pushea** (en Nx 24 es Nx mismo quien puede crear un commit
por migración en la rama de migración; el comando no pasa `--create-commits`). Si falla: arreglá, commiteá el estado
parcial en la rama y volvé a correr el mismo comando (retoma desde la mayor que quedó en
`package.json`). Códigos de salida: 0 plan/ejecutado/nada para hacer, 1 no se puede o falló un paso,
2 uso incorrecto (falta `--to`, no hay `nx`).

### Cuándo el paso de migraciones cuenta como fallo

Se captura stdout y stderr de `nx migrate --run-migrations`. Es **fallo** (exit 1, `migrations.json` se
conserva, se retoma re-corriendo el mismo comando en la rama de migración) si el exit code no es 0 o si
la salida dice `Not starting the run`. Nx 24 en la rama por defecto avisa eso y sale con 0 sin correr
ninguna migración: sin esta detección el workspace quedaba en 24 con los executors viejos (`@nx/eslint:lint`,
`@nx/vite:build`…) que Nx 24 ya no trae.

### Prompts diferidos para el agente del proyecto

Tras un salto exitoso, el comando lista los archivos de `tools/ai-migrations/**` (si existen) como
`Pending for the project agent` y los devuelve en `--json` como `pendingPrompts` (exit 0). Es trabajo
del agente del proyecto: aplicar esos prompts en orden, verificar, y recién ahí borrar
`tools/ai-migrations/` junto con `migrations.json` si quedó.

## Checklist de verificación por salto

- [ ] Instalación limpia (sin peer deps rotos ni lockfile rival).
- [ ] `npx nx show projects` y `npx nx graph --file=/tmp/graph.json` funcionan.
- [ ] `build`, `typecheck`, `lint` y `test` de todos los proyectos (`nx run-many -t build typecheck lint test`).
- [ ] `serve` de cada app. Nx 24 espera la señal de readiness de los dev servers (timeout por defecto
      10 minutos): revisá flujos que encadenan `serve` con e2e/Playwright.
- [ ] e2e, si existe.
- [ ] Build de la imagen Docker si algún proyecto usa `@nx/js:prune-lockfile`.
- [ ] Deploy a staging de las apps de producción antes de mergear.
- [ ] `pnpm sdd:validate` en verde y el fix cerrado con su `usage`.

## Referencias

- `references/22-to-23.md` — cambios y trampas del salto 22 → 23 (solo lo verificado, con fuente).
- `references/23-to-24.md` — cambios y trampas del salto 23 → 24.
- `references/typescript-7.md` — por qué TypeScript 7 está bloqueado hoy y qué cambia cuando se destrabe.
