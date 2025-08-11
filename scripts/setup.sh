#!/usr/bin/env bash
set -euo pipefail

# Basic project setup: install deps and create .env.local if missing

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

if [ ! -f .env.local ]; then
  cat > .env.local <<'ENV'
# OpenAI API key for content generation
OPENAI_API_KEY=

# Optional: Vercel deploy hook to trigger redeploys after generation
# VERCEL_DEPLOY_HOOK=
ENV
  echo "Created .env.local (fill in OPENAI_API_KEY)"
fi

if command -v npm >/dev/null 2>&1; then
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
else
  echo "npm not found. Please install Node.js LTS and npm first: https://nodejs.org"
  exit 1
fi

echo "Setup complete. Next steps:"
echo "- Edit .env.local and set OPENAI_API_KEY"
echo "- Run development server: npm run dev"

