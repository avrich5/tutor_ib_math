#!/usr/bin/env bash
set -euo pipefail
cd ~/tutor_skufs

echo "[1/5] Pull latest from origin"
git pull --ff-only

echo "[2/5] Backend deps"
cd backend
if [ ! -d .venv ]; then
  python3.12 -m venv .venv
fi
./.venv/bin/pip install -q -r requirements.txt

echo "[3/5] DB migrations"
./.venv/bin/alembic upgrade head

echo "[4/5] Frontend build (skip if no frontend yet)"
if [ -d ../frontend ] && [ -f ../frontend/package.json ]; then
  cd ../frontend
  npm ci --silent
  npm run build
  cd ../backend
fi

echo "[5/5] Restart tutor_backend"
PLIST=~/Library/LaunchAgents/com.skufs.tutor-backend.plist
if [ -f "$PLIST" ]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load "$PLIST"
else
  echo "  Warning: plist not installed at $PLIST — run manually or install plist first"
fi

echo "[mirror] Sync to MacBook"
ssh macbook 'cd ~/tutor_macbook && git pull --ff-only' 2>/dev/null || echo "  MacBook sync skipped"

echo "Deploy complete."
