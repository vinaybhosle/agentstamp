#!/bin/bash
# Wrapper for launchd — sources env vars and starts the backend
source "$HOME/.zshenv" 2>/dev/null
cd /Users/vinaybhosle/Desktop/AgentStamp
exec /opt/homebrew/bin/node server.js
