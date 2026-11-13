# CI y consumo de GitHub Actions

La cuenta tiene 3000 minutos de Actions por mes. En octubre de 2026 se consumieron 9735. Antes de
este cambio, cada push a una PR de este repo facturaba unos 21 minutos:

| Job                               | Reloj  | Facturado                 |
| --------------------------------- | ------ | ------------------------- |
| build · typecheck · test (ubuntu) | ~3.6 m | 4 min                     |
| build · typecheck · test (windows) | ~6.7 m | 7 min × 2 = **14 min**   |
| studio e2e                        | ~1.9 m | 2 min                     |
| sdd:validate                      | ~0.3 m | 1 min                     |

El merge a `main` repetía el mismo CI (otros ~21 minutos).

## `pnpm ci:local`: el CI verificado en tu máquina

Con la rama commiteada y el árbol limpio:

```bash
pnpm ci:local            # verifica, pushea la rama y publica el status
pnpm ci:local --no-push  # la rama ya está en origin con ese mismo SHA
```

Si `gh` responde 404, la cuenta activa no es la correcta: `GH_TOKEN=$(gh auth token -u e-burgos) pnpm ci:local`.

`scripts/ci/ci-local.sh` falla si hay cambios sin commitear o archivos sin trackear, si Node no
es la 22 (la del CI) o si pnpm no coincide con `packageManager`. Después corre lo mismo que el CI:
`pnpm install --frozen-lockfile`, `sdd:validate`, `build`, `typecheck`, `test` y el e2e de Studio
con Playwright. Si tenés `pwsh`, chequea además la sintaxis de los `.ps1`. Solo si todo pasa
pushea y publica el commit status `ci-local=success` sobre el SHA de HEAD. Si algo falla, no
publica nada.

**Cómo lo usa el CI** (`ci.yml`): el job `ci-local status` busca ese status sobre el SHA de la
cabeza de la PR, con polling de hasta 60 s (`scripts/ci/wait-ci-local-status.sh`). Si lo
encuentra, `sdd:validate`, `test` y `e2e` quedan *skipped* y la corrida termina en unos 15 s
(1 minuto facturado). Si no lo encuentra, o la API falla, corre todo.

**Qué garantiza:** que ese SHA exacto pasó lo mismo que el CI en una máquina con Node 22 y el
pnpm del repo. No es una verificación independiente: confía en quien corrió el script. Un commit
nuevo cambia el SHA y vuelve a pedir el status. Un colaborador sin `ci:local` tiene el CI completo.

**Forzar el CI completo:** `gh workflow run ci.yml -R e-burgos/sdd-harness --ref <rama> -f force=true`.

## Cuándo corre cada workflow

| Workflow             | Dispara                                                           |
| -------------------- | ----------------------------------------------------------------- |
| `ci.yml`             | PRs (salvo las que solo tocan `docs/`, `apps/documentation/`, `README.md` o `LICENSE`) y a mano. Ya no corre en push a `main`: el SHA ya se verificó en la PR. Un push nuevo cancela la corrida anterior de la misma PR. |
| `deploy-docs.yml`    | Push a `main` que toca `apps/documentation/`.                     |
| `deploy-studio.yml`  | Push a `main` que toca `apps/studio/` o `libs/studio-protocol/`, salvo tests, e2e y Markdown. |
| `release.yml`        | Tag `v*`. Corre typecheck, test y build antes de publicar en npm. |
| `release-studio.yml` | Tag `studio-v*`.                                                  |

## Windows

Windows no corre en Actions: costaba el doble y no es una plataforma prioritaria. Se prueba en local.

Qué cubre solo Windows:

- `apps/cli/src/generators/__tests__/sdd.generator.windows.spec.ts`: 10 casos que ejecutan
  `setup-agents.ps1` con Windows PowerShell 5.1 de verdad (links de la raíz, junctions y
  hardlinks cuando no hay Developer Mode, paths con `#` y espacios, idempotencia) y
  `sdd:tucu` con junctions. Están marcados `skipIf(process.platform !== 'win32')`.
- El checkout con `core.longpaths` (los paths del blueprint `java-api` superan los 260
  caracteres) y con `core.autocrlf true`, que es lo que trae Git for Windows.
- Toda la suite corriendo con separadores `\`. Los tests que usan `path.win32` explícito
  también corren en la Mac.

**En la Mac:** `pwsh` (`brew install powershell`) valida la sintaxis de los `.ps1` dentro de
`pnpm ci:local`. PowerShell 7 en macOS no crea junctions ni hardlinks de Windows, así que no
reemplaza la suite.

**La suite completa**, en una VM con Windows 11 ARM (UTM o Parallels) con Node 22 y pnpm:

```powershell
git config --global core.longpaths true
git config --global core.autocrlf true
git clone https://github.com/e-burgos/sdd-harness.git
cd sdd-harness
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
$env:SDD_RTK_SKIP_INSTALL = '1'; pnpm test
```

**Cuándo:** antes de un release (`v*`) que toque `setup-agents.ps1`, `sdd-tucu`, la creación de
symlinks del kit o el manejo de fin de línea. Para el resto de los cambios no hace falta.
