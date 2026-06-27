#!/usr/bin/env bash
# VPS deploy — matches ~/Buddy-service repo + /var/www static frontend.
set -euo pipefail

REPO=~/Buddy-service
WEB_ROOT=/var/www/Buddy-service

echo "Deploy started..."

cd "$REPO"
git pull origin main

echo "Frontend build..."
cd "$REPO/Frontend"
npm install
npm run build
rm -rf "$WEB_ROOT"/*
cp -r dist/* "$WEB_ROOT/"

echo "Backend install..."
cd "$REPO/Backend"
npm install

echo "PM2 reload..."
if pm2 describe Buddy-service-backend >/dev/null 2>&1; then
  pm2 restart Buddy-service-backend --update-env
elif pm2 describe buddy-api >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi

# Start queue workers when BullMQ is enabled (safe to run; workers no-op if disabled)
for w in buddy-worker-order buddy-worker-tracking; do
  pm2 describe "$w" >/dev/null 2>&1 || pm2 start ecosystem.config.cjs --only "$w" 2>/dev/null || true
done
pm2 save

sleep 2
echo "Health:"
curl -sf "http://127.0.0.1:5000/health" || echo "(health check failed — is API on port 5000?)"

echo "Deploy finished."
