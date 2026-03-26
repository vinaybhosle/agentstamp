#!/usr/bin/env bash
# Safe deploy script for AgentStamp
# 1. Run unit tests
# 2. Stop web service
# 3. Clean rebuild (no turbopack)
# 4. Restart web + backend
# 5. Run smoke tests
# 6. If smoke tests fail, alert and exit 1
#
# Usage: ./scripts/deploy.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WEB_DIR="$PROJECT_DIR/web"
UID_NUM=$(id -u)

echo "═══════════════════════════════════════════"
echo "  AgentStamp Safe Deploy"
echo "  $(date -Iseconds)"
echo "═══════════════════════════════════════════"
echo ""

# Step 1: Unit tests
echo "Step 1/5: Running unit tests..."
cd "$PROJECT_DIR"
if npx vitest run --exclude='tests/e2e/**' 2>&1 | tail -3; then
  echo "  ✅ Unit tests passed"
else
  echo "  ❌ Unit tests failed — aborting deploy"
  exit 1
fi
echo ""

# Step 2: Stop web
echo "Step 2/5: Stopping web service..."
launchctl bootout "gui/$UID_NUM/com.agentstamp.web" 2>/dev/null || true
lsof -ti :4000 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1
echo "  ✅ Web stopped"
echo ""

# Step 3: Clean rebuild
echo "Step 3/5: Clean rebuild (standalone mode)..."
cd "$WEB_DIR"
rm -rf .next
# Hide parent package-lock.json during build to prevent Next.js workspace root inference bug
[ -f "$PROJECT_DIR/package-lock.json" ] && mv "$PROJECT_DIR/package-lock.json" "$PROJECT_DIR/package-lock.json.bak"
npx next build 2>&1 | tail -5
[ -f "$PROJECT_DIR/package-lock.json.bak" ] && mv "$PROJECT_DIR/package-lock.json.bak" "$PROJECT_DIR/package-lock.json"
# Copy static assets into standalone output (required for standalone mode)
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public 2>/dev/null || true
# Copy env file to standalone (standalone server doesn't read from parent web/ dir)
[ -f .env.local ] && cp .env.local .next/standalone/.env.local
echo "  ✅ Build complete (standalone)"
echo ""

# Step 4: Restart services
echo "Step 4/5: Restarting services..."
launchctl bootstrap "gui/$UID_NUM" ~/Library/LaunchAgents/com.agentstamp.web.plist 2>/dev/null || true
launchctl bootout "gui/$UID_NUM/com.agentstamp.backend" 2>/dev/null || true
sleep 1
launchctl bootstrap "gui/$UID_NUM" ~/Library/LaunchAgents/com.agentstamp.backend.plist 2>/dev/null || true
sleep 3
echo "  ✅ Services restarted"
echo ""

# Step 5: Smoke tests
echo "Step 5/5: Running smoke tests..."
if "$SCRIPT_DIR/smoke-test.sh"; then
  echo ""
  echo "═══════════════════════════════════════════"
  echo "  ✅ DEPLOY SUCCESSFUL"
  echo "  $(date -Iseconds)"
  echo "═══════════════════════════════════════════"
  exit 0
else
  echo ""
  echo "═══════════════════════════════════════════"
  echo "  ❌ DEPLOY FAILED — SMOKE TESTS FAILED"
  echo "  Services are running but some pages are broken."
  echo "  Check the failures above and fix before pushing."
  echo "═══════════════════════════════════════════"
  exit 1
fi
