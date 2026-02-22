#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

if [ ! -f .env.local ]; then
  echo "Missing .env.local. Create it with OPENROUTER_API_KEY before running."
  exit 1
fi

if command -v bun >/dev/null 2>&1; then
  bun run dev
elif command -v npm >/dev/null 2>&1; then
  npm run dev
else
  echo "Neither bun nor npm was found. Install Bun (https://bun.sh) or Node.js/npm (https://nodejs.org)."
  exit 1
fi
