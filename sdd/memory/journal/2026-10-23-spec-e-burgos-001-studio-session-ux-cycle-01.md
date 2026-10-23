# spec-e-burgos-001-studio-session-ux cycle-01 — 2026-10-23

## Qué pasó

1. El Studio que el dev usaba para operar el ciclo corría con `next dev` desde la rama en desarrollo. Al
   llegar el bump a `PROTOCOL_VERSION = 2`, el HMR recargó el protocolo nuevo en la web mientras el puente
   vivo seguía en v1: handshake roto (`protocol-mismatch`) en medio del trabajo.
2. Los subagentes lanzados con `isolation: "worktree"` del Agent tool no podían usar git dentro de su
   worktree (bloqueado), así que no podían commitear su task; se resolvió creando el worktree a mano con
   `git worktree add` y pasándole la ruta.
3. La verificación visual con Playwright reportó que "click en el nombre de un canal lo colapsa". No era
   un bug: `getByRole('button', { name: 'general' })` hace match por substring y tomó primero el caret
   (`aria-label` "Expand or collapse # general").

## Lección

- Operar el Studio de uso diario desde un build/puerto estable, nunca con `next dev` de la rama que cambia el protocolo.
- Para subagentes que deben commitear, usar `git worktree add` manual en vez de `isolation: "worktree"`.
- En Playwright usar `exact: true` en `getByRole(..., { name })` cuando hay controles cuyo `aria-label` contiene el mismo texto.

## Costo evitable

Una sesión de Studio caída a mitad de ciclo, re-dispatch de tasks sin commits y una investigación del
reviewer sobre un falso positivo de UI.
