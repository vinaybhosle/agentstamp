#!/usr/bin/env bash
# Wrapper for next start that hides the parent package-lock.json
# to prevent Next.js workspace root inference bug.
set -euo pipefail

PROJECT_DIR="/Users/vinaybhosle/Desktop/AgentStamp"
WEB_DIR="$PROJECT_DIR/web"
LOCKFILE="$PROJECT_DIR/package-lock.json"
LOCKFILE_BAK="$PROJECT_DIR/package-lock.json.bak"

# Hide parent lockfile
[ -f "$LOCKFILE" ] && mv "$LOCKFILE" "$LOCKFILE_BAK"

# Restore on exit (always, even on crash)
trap '[ -f "$LOCKFILE_BAK" ] && mv "$LOCKFILE_BAK" "$LOCKFILE"' EXIT

cd "$WEB_DIR"
exec /opt/homebrew/bin/npx next start -p 4000
