#!/bin/bash
# Moltbook Engagement Script — runs via cron, uses claude CLI
# Usage: ./moltbook-engage.sh [engage|intel|publish|outreach|spotlight]
set -euo pipefail

MODE="${1:-engage}"
LOG_DIR="$(dirname "$0")/logs"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M')

# Claude CLI path
CLAUDE="/Users/vinaybhosle/.local/bin/claude"

# Load product knowledge from external file (kept in sync by nightly consolidation)
SCRIPT_DIR="$(dirname "$0")"
PRODUCT_KNOWLEDGE=$(cat "$SCRIPT_DIR/moltbook-product-knowledge.md" 2>/dev/null || echo "Product knowledge file not found — check $SCRIPT_DIR/moltbook-product-knowledge.md")

# Load secrets from environment (set in ~/.zshenv or launchd plist)
MOLTBOOK_KEY_AS="${MOLTBOOK_KEY_AS:?MOLTBOOK_KEY_AS not set — add to ~/.zshenv}"
MOLTBOOK_KEY_SR="${MOLTBOOK_KEY_SR:?MOLTBOOK_KEY_SR not set — add to ~/.zshenv}"
TG_TOKEN_AS="${TG_TOKEN_AS:?TG_TOKEN_AS not set — add to ~/.zshenv}"
TG_TOKEN_SR="${TG_TOKEN_SR:?TG_TOKEN_SR not set — add to ~/.zshenv}"
TG_CHAT_ID="${TG_CHAT_ID:?TG_CHAT_ID not set — add to ~/.zshenv}"

# Common config injected into every prompt
read -r -d '' CONFIG << CONFIGEOF || true
## Moltbook API Keys — STRICT ACCOUNT BINDING
- AgentStamp account ONLY uses key: ${MOLTBOOK_KEY_AS}
- ShippingRates account ONLY uses key: ${MOLTBOOK_KEY_SR}

CRITICAL: Every API call MUST use the correct key for the account performing the action.
- Commenting as @agentstamp? Use AgentStamp key. ALWAYS.
- Commenting as @shippingrates? Use ShippingRates key. ALWAYS.
- Replying to a DM on AgentStamp? Use AgentStamp key. ALWAYS.
- Double-check the key BEFORE every curl call — using the wrong key = posting from the wrong account.

Base URL: https://www.moltbook.com
IMPORTANT: When using curl, always save output to a file with -o flag. Do NOT pipe curl output.

## Telegram Bots — ACCOUNT-SPECIFIC NOTIFICATIONS
- AgentStamp Bot: Token ${TG_TOKEN_AS}
- ShippingRates Bot: Token ${TG_TOKEN_SR}
- Chat ID: ${TG_CHAT_ID}
Send via: curl -s -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" -H "Content-Type: application/json" -d '{"chat_id": ${TG_CHAT_ID}, "text": "..."}' -o /tmp/tg_result.json

## CRITICAL TELEGRAM RULE — NO CROSS-PINGS
- AgentStamp Bot sends ONLY AgentStamp activity (AgentStamp comments, AgentStamp DMs, AgentStamp notifications)
- ShippingRates Bot sends ONLY ShippingRates activity (ShippingRates comments, ShippingRates DMs, ShippingRates notifications)
- NEVER send AgentStamp activity through ShippingRates Bot or vice versa
- If only one account had activity, only ONE bot sends a message — the other stays SILENT
- If both accounts had activity, each bot sends its OWN account's summary separately
- Each Telegram message must start with the account name: "AgentStamp:" or "ShippingRates:"

## Voice & Tone for ALL comments and posts
- Sharp, intelligent, polite
- Empathy and respect for all agents
- Solutions mindset, positive energy
- NEVER promotional or salesy
- Write like a knowledgeable peer, NOT a brand
- Reference your own product knowledge naturally (don't force it), only when directly relevant

$PRODUCT_KNOWLEDGE

## Verification
After EVERY comment, Moltbook returns a verification challenge. Parse the math problem from the challenge_text field, solve it, and POST the answer to /api/v1/verify with the verification_code. Answer must be a number with 2 decimal places (e.g., "18.00").
CONFIGEOF

case "$MODE" in

engage)
  PROMPT="Run a Moltbook engagement cycle for BOTH AgentStamp and ShippingRates accounts.

$CONFIG

## Steps:
1. GET /api/v1/home for BOTH accounts — check notifications and activity
2. Reply to any unread notifications first (these are highest priority)
3. SKIP DMs — the dmcheck cron handles all DMs separately
4. GET /api/v1/feed — browse top 20 posts
5. For EACH account, find 2-3 posts relevant to their domain and comment thoughtfully:
   - AgentStamp: trust, identity, verification, credentials, x402, agent reputation
   - ShippingRates: shipping, logistics, trade, carriers, MCP tools, agent infrastructure
6. Upvote good posts (POST /api/v1/posts/:id/upvote)
7. Follow interesting new agents (POST /api/v1/agents/:name/follow)
8. Mark all notifications as read
9. Send Telegram summary — AgentStamp Bot sends ONLY AgentStamp activity, ShippingRates Bot sends ONLY ShippingRates activity. If one account had no activity, that bot stays SILENT.

## CRITICAL: ACCOUNT SEPARATION
- AgentStamp and ShippingRates are SEPARATE entities with SEPARATE identities
- NEVER have both accounts comment on the same post (pick the better fit)
- NEVER mention AgentStamp features when commenting as ShippingRates or vice versa
- AgentStamp comments about: trust, identity, verification, reputation, cryptographic proofs, x402
- ShippingRates comments about: shipping, logistics, carriers, tariffs, MCP tools, trade, supply chain
- If a post is relevant to both, pick the STRONGER fit — only one account comments
- Do not comment on posts you've already commented on. Check existing comments first."
  ;;

intel)
  PROMPT="Generate a daily intelligence digest of what agents are discussing on Moltbook.

$CONFIG

## Steps:
1. GET /api/v1/feed — get 30-50 posts (paginate with cursor)
2. GET /api/v1/search?q=shipping — shipping-related posts
3. GET /api/v1/search?q=trust — trust/identity posts
4. GET /api/v1/search?q=x402 — payment protocol posts
5. GET /api/v1/search?q=agent — general agent posts
6. GET /api/v1/search?q=mcp — MCP tool posts

Analyze and categorize into:
- Hot Topics (grouped by theme)
- Trending Posts (top 5 by engagement)
- New Agents to watch
- Relevant to AgentStamp (trust/identity angle)
- Relevant to ShippingRates (shipping/logistics angle)
- Partnership opportunities

Send digest via Telegram — AgentStamp Bot gets ONLY trust/identity/verification relevant items, ShippingRates Bot gets ONLY shipping/logistics/trade relevant items. Items that don't fit either domain go to AgentStamp Bot. Each bot receives ONLY its own domain's digest."
  ;;

publish)
  PROMPT="Publish an original thought-leadership post on Moltbook.

$CONFIG

## CRITICAL ANTI-SPAM RULES
1. NEVER mention AgentStamp or ShippingRates by name in posts
2. NEVER include calls-to-action (no 'DM us', 'try it', 'check out')
3. NEVER post about your own product features
4. Lead with IDEAS, not products
5. Keep it conversational — lowercase, casual, thinking out loud
6. No links to your own sites

## Steps:
1. GET /api/v1/agents/me for each account — check karma
   - If karma < 15: SKIP posting, comment on 3 posts instead. Send Telegram: 'Karma too low (X), commenting instead'
   - If karma >= 15: Proceed
2. GET /api/v1/feed — scan what's trending for inspiration
3. Write ONE post per account:
   - AgentStamp: post to 'builds' submolt. Topics: agent trust, reputation systems, identity, cryptographic proofs
   - ShippingRates: post to 'agents' or 'builds'. Topics: shipping data insights, MCP tools, domain-specific agents
4. POST /api/v1/posts — publish
5. Check is_spam in response. If true: DELETE immediately, send Telegram alert
6. Verify the post
7. Send Telegram confirmation — AgentStamp Bot confirms ONLY AgentStamp post, ShippingRates Bot confirms ONLY ShippingRates post. Each bot only knows about its own account's post."
  ;;

outreach)
  PROMPT="Send targeted partnership DMs to high-value agents on Moltbook.

$CONFIG

## CRITICAL: NO CROSS-CONTAMINATION
- Each agent (target) gets DM'd from EXACTLY ONE account — NEVER both
- AgentStamp ONLY DMs about trust/identity/verification topics
- ShippingRates ONLY DMs about shipping/logistics/data topics
- If an agent's work spans both domains, pick the STRONGER fit — do NOT send from both
- NEVER mention AgentStamp features from the ShippingRates account or vice versa
- Each account is its own independent entity with its own relationships

## DM History Log
Check /Users/vinaybhosle/Desktop/AgentStamp/scripts/logs/dm-history.txt FIRST.
Format: ACCOUNT|AGENT_NAME|DATE|TOPIC
If the agent name appears for EITHER account, SKIP them entirely — do not DM from the other account.
After sending a DM, APPEND in that format. Create file if it doesn't exist.

## Partnership Pitches

### AgentStamp ONLY (send from AgentStamp account ONLY):
Target: agents building identity, trust/reputation, verification, x402, security, agent registries
- 'We built a trust verification SDK — agents can cryptographically prove their identity. Your [specific project] could use it to [specific benefit]. Want to explore?'
- 'Your work on [topic] is exactly the trust gap we are closing. We have an integration bounty — free Gold stamp for agents that ship requireStamp() middleware.'
- For x402 agents: 'We use x402 for stamp minting. Your payment infra + our identity layer could work well together.'

### ShippingRates ONLY (send from ShippingRates account ONLY):
Target: agents building logistics, supply chain, MCP tools, data APIs, proxy/networking, e-commerce, trade compliance
- 'We run 24 MCP tools covering 157 countries of shipping data across 7 carriers. Your [specific project] could tap into our API for [specific use case].'
- 'We have real shipping intelligence — D&D tariffs, landed cost calculators, route risk scoring. Could make your agent smarter about logistics.'
- For proxy/networking agents: 'Our rate data varies by region — your geo-routing could help validate regional pricing. Interested in a data partnership?'

## Steps:
1. Load DM history log — list of ALL previously contacted agents (from either account)
2. GET /api/v1/feed — scan top 30 posts, identify candidate agents
3. For EACH account separately:
   a. GET /api/v1/agents/dm/check — existing conversations
   b. GET /api/v1/agents/dm/conversations — already messaged
4. Build candidate list:
   - High karma (15+), active, building something relevant
   - NOT in DM history for EITHER account
   - NOT already in conversations for EITHER account
5. For each candidate, classify into AgentStamp-fit OR ShippingRates-fit (never both)
6. Pick 1 agent per account (max 2 DMs total per run)
7. Write personalized DM (3-5 sentences):
   * Reference something specific from their posts
   * One line about what YOUR account offers (not the other account)
   * Concrete collaboration proposal
   * Question to continue conversation
8. Send, verify, update DM history log
9. Send Telegram — AgentStamp Bot reports ONLY the AgentStamp DM, ShippingRates Bot reports ONLY the ShippingRates DM. If only one account sent a DM, only that bot sends a notification."
  ;;

spotlight)
  PROMPT="Create and publish a weekly 'Agent Spotlight' post featuring a notable Moltbook agent.

$CONFIG

## CRITICAL ANTI-SPAM RULES
Same as publish mode — no self-promotion, no CTAs.

## Steps:
1. GET /api/v1/agents/me — check karma. If < 15, skip and comment instead.
2. GET /api/v1/feed — find the most interesting agent from the past week
   - Look for: high engagement, unique projects, thoughtful comments
3. Write a spotlight post (from AgentStamp account, in 'general' submolt):
   - Title: something like 'agent spotlight: [name] and their work on [topic]'
   - Body: what they're building, why it matters, what you learned
   - Tag them with @name
   - Keep it genuine — this is about THEM, not us
4. POST /api/v1/posts — publish, check is_spam, verify
5. DM the featured agent to let them know
6. Send Telegram confirmation"
  ;;

dmcheck)
  PROMPT="Smart DM check for BOTH Moltbook accounts. Read all DMs, reply to everything, but only escalate HIGH-VALUE messages to Telegram.

$CONFIG

## DM Classification System
For EVERY incoming DM, classify it into one of these tiers:

**TIER 1 — ESCALATE (send Telegram immediately)**
Score 7-10. These drive growth:
- Product feature suggestions or requests ('you should add X', 'would be great if...')
- Integration proposals ('want to integrate your SDK with my agent')
- Partnership offers ('lets collaborate on...', 'I build X and your Y would...')
- Bug reports or issues with our product
- Serious technical questions about our API/SDK
- Agents with karma 30+ reaching out for any reason

**TIER 2 — REPLY ONLY (no Telegram)**
Score 4-6. Good engagement but not actionable:
- General compliments ('nice project', 'cool idea')
- Casual conversation or questions about the space
- Agents just saying hi or following up on comments
- Generic collaboration interest without specifics

**TIER 3 — ACKNOWLEDGE (brief reply, no Telegram)**
Score 1-3. Low signal:
- Automated messages or spam
- Completely off-topic messages
- Agents with very low karma just promoting their own stuff

## Steps:
1. For EACH account (AgentStamp first, then ShippingRates):
   a. GET /api/v1/agents/dm/check — check for pending requests and unread messages
   b. If unread_message_count > 0 or pending_request_count > 0:
      - GET /api/v1/agents/dm/conversations — list all conversations
      - For each conversation with unread messages, GET /api/v1/agents/dm/conversations/:id — read messages
      - Accept pending DM requests
      - For EACH unread message:
        1. Classify into Tier 1, 2, or 3
        2. Rate feasibility/importance 1-10
        3. Reply appropriately:
           - Tier 1: Detailed, enthusiastic reply. Ask clarifying questions. Propose concrete next steps.
           - Tier 2: Friendly, genuine reply. Keep conversation warm.
           - Tier 3: Brief acknowledgment.
      - Verify each reply
   c. If no unread DMs: exit silently

2. Telegram notification — ONLY for Tier 1 messages, sent via the CORRECT bot only:
   - AgentStamp DMs → send via AgentStamp Bot ONLY
   - ShippingRates DMs → send via ShippingRates Bot ONLY
   - NEVER send AgentStamp DM alerts through ShippingRates Bot or vice versa
   Format:
   🚨 High-Value DM Alert — [AgentStamp/ShippingRates]

   From: @agent_name (karma: X)
   Message: [1-2 line summary of what they said]
   Classification: [feature request / integration proposal / partnership / bug report]
   Feasibility Score: X/10
   Why it matters: [1 line on growth impact]
   Our reply: [1-2 line summary of what we responded]
   Suggested action: [what founder should do — e.g., 'follow up personally', 'add to roadmap', 'schedule call']

3. If ALL DMs are Tier 2/3 or no DMs exist, exit silently — ZERO Telegram noise.
4. If only one account has Tier 1 DMs, only THAT account's bot sends a notification — the other bot stays completely silent.

## CRITICAL: ACCOUNT SEPARATION
- Reply as the account that RECEIVED the DM — never cross-reference the other product
- If someone DMs AgentStamp, reply ONLY about trust/identity/verification — never mention ShippingRates
- If someone DMs ShippingRates, reply ONLY about shipping/logistics/data — never mention AgentStamp
- They are independent products with independent relationships

## Context for Classification
- AgentStamp: product suggestions about trust, verification, SDK, wallet linking, cross-chain, badges, leaderboards
- ShippingRates: suggestions about tariff data, MCP tools, carrier coverage, regional pricing, API features"
  ;;

*)
  echo "Usage: $0 [engage|intel|publish|outreach|spotlight|dmcheck]"
  exit 1
  ;;
esac

echo "[$TIMESTAMP] Running moltbook-$MODE..." >> "$LOG_DIR/moltbook.log"
cd /Users/vinaybhosle/Desktop/AgentStamp
$CLAUDE -p "$PROMPT" --allowedTools "Bash(curl:*),Bash(cat:*),Bash(python3:*)" >> "$LOG_DIR/moltbook-$MODE-$TIMESTAMP.log" 2>&1 || true
echo "[$TIMESTAMP] Completed moltbook-$MODE" >> "$LOG_DIR/moltbook.log"
