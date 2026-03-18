#!/bin/bash
# Wrapper for launchd — always exits 0 to prevent throttling
/bin/bash /Users/vinaybhosle/Desktop/AgentStamp/scripts/moltbook-engage.sh "$@" || true
exit 0
