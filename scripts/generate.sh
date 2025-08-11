#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

LANG_CODE="${1:-en}"

if [ ! -f .env.local ]; then
  echo "Missing .env.local. Create it with OPENAI_API_KEY before running."
  exit 1
fi

case "$LANG_CODE" in
  en|it|fr)
    npm run "generate-news:${LANG_CODE}" ;;
  all)
    npm run generate-news:all ;;
  *)
    echo "Usage: scripts/generate.sh [en|it|fr|all]" ;;
esac

