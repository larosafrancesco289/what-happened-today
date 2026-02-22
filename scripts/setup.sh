#!/usr/bin/env bash
set -euo pipefail

# Basic project setup: install deps and create .env.local if missing

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

if [ ! -f .env.local ]; then
  cat > .env.local <<'ENV'
# OpenRouter API key for content generation
OPENROUTER_API_KEY=

# Optional: Vercel deploy hook to trigger redeploys after generation
# VERCEL_DEPLOY_HOOK=
ENV
  echo "Created .env.local (fill in OPENROUTER_API_KEY)"
fi

DEV_COMMAND="bun run dev"

if command -v bun >/dev/null 2>&1; then
  if [ -f bun.lock ] || [ -f bun.lockb ]; then
    bun install --frozen-lockfile
  else
    bun install
  fi
elif command -v npm >/dev/null 2>&1; then
  echo "bun not found; falling back to npm install."
  DEV_COMMAND="npm run dev"
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
else
  echo "Neither bun nor npm was found. Install Bun (https://bun.sh) or Node.js/npm (https://nodejs.org)."
  exit 1
fi

echo "Setup complete. Next steps:"
echo "- Edit .env.local and set OPENROUTER_API_KEY"
echo "- Run development server: ${DEV_COMMAND}"
