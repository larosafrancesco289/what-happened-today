#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

LANG_CODE="${1:-en}"

if [ ! -f .env.local ]; then
  echo "Missing .env.local. Create it with OPENROUTER_API_KEY before running."
  exit 1
fi

if command -v bun >/dev/null 2>&1; then
  RUNNER=(bun run)
elif command -v npm >/dev/null 2>&1; then
  RUNNER=(npm run)
else
  echo "Neither bun nor npm was found. Install Bun (https://bun.sh) or Node.js/npm (https://nodejs.org)."
  exit 1
fi

case "$LANG_CODE" in
  en|it|fr)
    "${RUNNER[@]}" "generate-news:${LANG_CODE}" ;;
  all)
    "${RUNNER[@]}" generate-news:all ;;
  *)
    echo "Usage: scripts/generate.sh [en|it|fr|all]" ;;
esac
