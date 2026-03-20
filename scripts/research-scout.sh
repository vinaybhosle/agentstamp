#!/bin/bash
# Research Scout — runs via claude CLI, searches for new intel about AgentStamp and ShippingRates
set -euo pipefail

LOG_DIR="$(dirname "$0")/logs"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M')

CLAUDE="/Users/vinaybhosle/.local/bin/claude"

PROMPT='You are a research scout. Your job is to find NEW external information that challenges or updates existing knowledge about AgentStamp and ShippingRates.

Follow the skill spec at /Users/vinaybhosle/Desktop/Claude\ Builds/skills/research-scout/SKILL.md exactly.

Summary of steps:
1. Read the product memory files to understand what we already know:
   - /Users/vinaybhosle/Desktop/Claude\ Builds/memory/agentstamp-product.md
   - /Users/vinaybhosle/Desktop/Claude\ Builds/memory/shippingrates-product.md
   - /Users/vinaybhosle/Desktop/Claude\ Builds/memory/long-term-memory.md

2. Use WebSearch to search for:
   AgentStamp: AI agent identity platforms, x402 protocol updates, A2A protocol news, agent trust scoring competitors, agent registry alternatives
   ShippingRates: container shipping APIs, D&D calculators, DCSA schedule API updates, shipping alliance changes, MCP tools for logistics
   Community: Reddit, Hacker News, Quora on agent trust, shipping data APIs, x402

3. For each finding, cross-reference against existing docs. Discard anything redundant.

4. Prioritize:
   P1 (Must Act) — competitive threat, security flaw, breaking change, revenue opportunity
   P2 (Should Know) — industry trend, new tool, pattern shift
   P3/Discard — already known or not actionable

5. Append P1 and P2 findings to the ## New Learnings section at the bottom of /Users/vinaybhosle/Desktop/Claude\ Builds/memory/long-term-memory.md using this format:
   ### YYYY-MM-DD — [P1/P2] <summary>
   - **Source**: [title](url)
   - **Relevance**: AgentStamp | ShippingRates | Both
   - **Changes**: <what this updates>
   - **Action**: <next step for P1, or "monitor" for P2>

6. Telegram ONLY for P1 items (zero noise otherwise):
   AgentStamp findings → Bot token from env var TG_TOKEN_AS (read via: echo $TG_TOKEN_AS)
   ShippingRates findings → Bot token from env var TG_TOKEN_SR (read via: echo $TG_TOKEN_SR)
   Chat ID from env var TG_CHAT_ID (read via: echo $TG_CHAT_ID)
   Use curl with -o /tmp/tg_result.json

If zero P1 findings, do NOT send any Telegram. Silent exit.'

echo "[$TIMESTAMP] Running research-scout..." >> "$LOG_DIR/moltbook.log"
cd "/Users/vinaybhosle/Desktop/Claude Builds"
$CLAUDE -p "$PROMPT" --allowedTools "WebSearch,WebFetch,Read,Edit,Bash(curl:*)" >> "$LOG_DIR/research-scout-$TIMESTAMP.log" 2>&1 || true
echo "[$TIMESTAMP] Completed research-scout" >> "$LOG_DIR/moltbook.log"
