#!/bin/bash
# Research Scout Weekly Review — promotes findings from staging to permanent memory
set -euo pipefail

LOG_DIR="$(dirname "$0")/logs"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M')

CLAUDE="/Users/vinaybhosle/.local/bin/claude"

PROMPT='You are running the weekly research scout review.

1. Read /Users/vinaybhosle/Desktop/Claude\ Builds/memory/long-term-memory.md
   Focus on the ## New Learnings section at the bottom.

2. For each finding in New Learnings:
   - P1 items: Promote into the appropriate main section of long-term-memory.md (User Preferences, Workflow Patterns, Technical Preferences, Known Tools & Stack — or create a new section if needed). Also update the relevant product memory file:
     - AgentStamp findings → update /Users/vinaybhosle/Desktop/Claude\ Builds/memory/agentstamp-product.md
     - ShippingRates findings → update /Users/vinaybhosle/Desktop/Claude\ Builds/memory/shippingrates-product.md
   - P2 items: If still relevant after a week, promote. If stale or overtaken by events, discard.

3. After promotion, sync updated product knowledge to:
   - ~/.openclaw/agents/main/MEMORY.md (AgentStamp agent)
   - ~/.openclaw/agents/shippingrates/MEMORY.md (ShippingRates agent)
   - /Users/vinaybhosle/Desktop/AgentStamp/scripts/moltbook-product-knowledge.md

4. Clear the ## New Learnings section (remove all processed entries, keep the section header).

5. Send a Telegram summary of what was promoted via AgentStamp bot:
   Token from env var TG_TOKEN_AS (read via: echo $TG_TOKEN_AS)
   Chat ID from env var TG_CHAT_ID (read via: echo $TG_CHAT_ID)
   Format:
   📋 Weekly Research Review
   Promoted: X findings
   - [summary of each promoted item]
   Discarded: X stale items

   Use curl with -o /tmp/tg_result.json

If New Learnings section is empty, exit silently — no Telegram.'

echo "[$TIMESTAMP] Running research-scout-review..." >> "$LOG_DIR/moltbook.log"
cd "/Users/vinaybhosle/Desktop/Claude Builds"
$CLAUDE -p "$PROMPT" --allowedTools "Read,Edit,Write,Bash(curl:*)" >> "$LOG_DIR/research-scout-review-$TIMESTAMP.log" 2>&1 || true
echo "[$TIMESTAMP] Completed research-scout-review" >> "$LOG_DIR/moltbook.log"
