#!/usr/bin/env bash
set -u

repo="${1:?owner/repo requerido}"
sha="${2:?sha requerido}"
timeout="${CI_LOCAL_WAIT_TIMEOUT:-60}"
interval="${CI_LOCAL_WAIT_INTERVAL:-10}"
gh_bin="${GH_BIN:-gh}"

elapsed=0
while :; do
  state=$("$gh_bin" api "repos/${repo}/commits/${sha}/status" \
    --jq '[.statuses[] | select(.context == "ci-local")][0].state // ""' 2>/dev/null) || state=""
  if [ "$state" = "success" ]; then
    echo "verified=true"
    exit 0
  fi
  if [ "$elapsed" -ge "$timeout" ]; then
    echo "verified=false"
    exit 0
  fi
  sleep "$interval"
  elapsed=$((elapsed + interval))
done
