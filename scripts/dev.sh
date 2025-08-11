#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

if [ ! -f .env.local ]; then
  echo "Missing .env.local. Create it with OPENAI_API_KEY before running."
  exit 1
fi

npm run dev

