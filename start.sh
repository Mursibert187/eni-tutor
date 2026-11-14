#!/usr/bin/env sh
# Starts ENI Tutor at http://localhost:8000 (macOS / Linux)
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "Node.js is not installed. Get it from https://nodejs.org and try again."; exit 1; }
[ -f .env ] || echo "Note: no .env file found. Copy .env.example to .env and add your API key, otherwise the chat will not work."
exec node server.mjs
