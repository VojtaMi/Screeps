#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${SCREEPS_MMO_TOKEN:-}" ]]; then
  echo "SCREEPS_MMO_TOKEN is not set. Add it to .env or export it before starting Codex." >&2
  exit 1
fi

export SCREEPS_MCP_CONFIG=".screeps-mcp/config.json"
exec npx -y screeps-mcp@latest
