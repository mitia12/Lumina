#!/usr/bin/env bash
set -euo pipefail
cd /project

# Keep Linux binaries in the Docker volume; leave Windows node_modules intact.
dependency_key="$(node -p "require('crypto').createHash('sha256').update(require('fs').readFileSync('package-lock.json')).digest('hex')")"
if [[ ! -f node_modules/.lumina-linux-lock ]] || [[ "$(cat node_modules/.lumina-linux-lock)" != "$dependency_key" ]]; then
  npm ci --no-audit --no-fund
  printf '%s' "$dependency_key" > node_modules/.lumina-linux-lock
fi

xvfb-run -a npm test
npm run dist:linux
xvfb-run -a node tests/packaged-linux.cjs
