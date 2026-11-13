#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

push=true
for arg in "$@"; do
  case "$arg" in
    --no-push) push=false ;;
    *) echo "Opción desconocida: $arg (válida: --no-push)" >&2; exit 2 ;;
  esac
done

fail() { echo "ci:local ERROR: $*" >&2; exit 1; }
step() { echo; echo "==> $*"; }
free_port() { node -e "const s=require('net').createServer().listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})"; }

unset NX_WORKSPACE_ROOT_PATH

step "Árbol limpio"
if [ -n "$(git status --porcelain --untracked-files=normal)" ]; then
  git status --short >&2
  fail "hay cambios sin commitear o archivos sin trackear. Commiteá o descartá antes de verificar: el status se publica sobre el SHA de HEAD."
fi

step "Versiones de Node y pnpm"
expected_node_major=22
actual_node="$(node -v | tr -d 'v')"
[ "${actual_node%%.*}" = "$expected_node_major" ] || fail "Node $actual_node, pero el CI corre Node $expected_node_major (nvm use $expected_node_major)."
expected_pnpm="$(node -p "require('./package.json').packageManager.split('@')[1]")"
actual_pnpm="$(pnpm -v)"
[ "$actual_pnpm" = "$expected_pnpm" ] || fail "pnpm $actual_pnpm, pero packageManager exige $expected_pnpm."

step "Repositorio remoto"
remote_url="$(git remote get-url origin)"
repo_slug="$(echo "$remote_url" | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')"
case "$repo_slug" in */*) ;; *) fail "no pude derivar owner/repo de origin ($remote_url)." ;; esac
sha="$(git rev-parse HEAD)"
branch="$(git rev-parse --abbrev-ref HEAD)"
[ "$branch" != "HEAD" ] || fail "HEAD está detached; parate en una rama."
echo "repo=$repo_slug rama=$branch sha=$sha"

if [ "$push" = false ]; then
  step "Verificando que HEAD ya está en origin (--no-push)"
  remote_sha="$(git ls-remote origin "refs/heads/$branch" | awk '{print $1}')"
  [ "$remote_sha" = "$sha" ] || fail "origin/$branch está en '${remote_sha:-<no existe>}', no en $sha. Pusheá la rama o corré sin --no-push."
fi

step "pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile

step "sdd:validate"
pnpm sdd:validate

step "build"
pnpm build

step "typecheck"
pnpm typecheck

step "test"
SDD_RTK_SKIP_INSTALL=1 pnpm test

step "studio e2e (playwright)"
pnpm --filter sdd-studio-web exec playwright install chromium
E2E_PORT="$(free_port)" E2E_LAUNCHER_PORT="$(free_port)" pnpm --filter sdd-studio-web e2e

step "Sintaxis de los scripts .ps1"
if command -v pwsh >/dev/null 2>&1; then
  pwsh -NoProfile -File scripts/ci/check-ps1-syntax.ps1
else
  echo "pwsh no está instalado: se saltea (brew install powershell para chequearlo)."
fi

if [ "$push" = true ]; then
  step "git push origin $branch"
  git push origin "HEAD:refs/heads/$branch" || fail "el push falló; no se publica el status."
fi

step "Publicando commit status ci-local"
description="Node ${actual_node}, verificado en local"
if ! gh api -X POST "repos/${repo_slug}/statuses/${sha}" \
  -f state=success -f context=ci-local -f description="$description" >/dev/null; then
  fail "no pude publicar el status. Si gh responde 404 es la cuenta activa: probá  GH_TOKEN=\$(gh auth token -u e-burgos) pnpm ci:local --no-push"
fi

echo
echo "OK: ci-local=success publicado sobre $sha ($repo_slug)."
