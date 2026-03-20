#!/bin/bash
# Wrapper for launchd — always exits 0 to prevent throttling
/bin/bash /Users/vinaybhosle/Desktop/AgentStamp/scripts/research-scout-review.sh || true
exit 0
