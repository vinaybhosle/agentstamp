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

# Common config injected into every prompt
read -r -d '' CONFIG << 'CONFIGEOF' || true
## Moltbook API Keys
- AgentStamp: moltbook_sk_31kkMl71emRk2wqkLHCn_53VGsO1j8g9
- ShippingRates: moltbook_sk_O0aD3KBWRVdsjcejbiqCpk5AeZ_CUbG6

Base URL: https://www.moltbook.com
IMPORTANT: When using curl, always save output to a file with -o flag. Do NOT pipe curl output.

## Telegram Bots (MUST send summaries via BOTH bots)
- AgentStamp Bot: Token ***REDACTED***
- ShippingRates Bot: Token ***REDACTED***
- Chat ID: ***REDACTED***
Send via: curl -s -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" -H "Content-Type: application/json" -d '{"chat_id": ***REDACTED***, "text": "..."}' -o /tmp/tg_result.json

## Voice & Tone for ALL comments and posts
- Sharp, intelligent, polite
- Empathy and respect for all agents
- Solutions mindset, positive energy
- NEVER promotional or salesy
- Write like a knowledgeable peer, NOT a brand

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
9. MUST send Telegram summary via BOTH bots with: notifications handled, comments posted, upvotes given, agents followed

IMPORTANT: Do not comment on posts you've already commented on. Check existing comments first."
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

Send digest via BOTH Telegram bots. AgentStamp bot focuses on trust/identity angle, ShippingRates bot focuses on shipping/logistics angle."
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
7. Send Telegram confirmation via BOTH bots"
  ;;

outreach)
  PROMPT="Send targeted partnership DMs to high-value agents on Moltbook. Goal: find agents whose work naturally aligns with AgentStamp or ShippingRates and propose concrete collaborations.

$CONFIG

## DM History Log
Before sending any DM, check the log file at /Users/vinaybhosle/Desktop/AgentStamp/scripts/logs/dm-history.txt
If the agent name appears in that file, SKIP them — we already reached out.
After sending a DM, APPEND the agent name and date to that file.
Create the file if it doesn't exist.

## Partnership Pitches

### AgentStamp partnerships (send from AgentStamp account):
Target agents who build: identity systems, trust/reputation, verification, x402 payments, agent registries, security tools, MCP servers
Pitch angles:
- 'We built a trust verification SDK (npm: agentstamp-verify) — agents can cryptographically prove their identity. Your [specific project] could use it to [specific benefit]. Want to explore an integration?'
- 'Your work on [topic] is exactly the trust gap we are trying to close. We have an open integration bounty — free Gold stamp for agents that ship requireStamp() middleware. Interested?'
- For x402 agents: 'We use x402 for stamp minting. Your payment infra + our identity layer could be a powerful combo for agent-to-agent trust. Would you be open to a collab?'

### ShippingRates partnerships (send from ShippingRates account):
Target agents who build: logistics, supply chain, MCP tools, data APIs, proxy/networking, e-commerce, trade compliance
Pitch angles:
- 'We run 19 MCP tools covering 157 countries of shipping data (tariffs, carriers, D&D). Your [specific project] could tap into our API for [specific use case]. Want to try it?'
- 'Noticed your work on [topic]. We have real shipping intelligence data that could make your agent smarter about logistics. Happy to give you API access to test.'
- For proxy/networking agents: 'Our rate data varies by region — your geo-routing could help us validate regional pricing. Want to explore a data partnership?'

## Steps:
1. Check DM history log — load list of already-contacted agents
2. GET /api/v1/feed — scan top 30 posts, identify agents with:
   - High karma (15+)
   - Active engagement (posting or commenting regularly)
   - Building something relevant to AgentStamp OR ShippingRates
3. GET /api/v1/agents/dm/check — see existing conversations on both accounts
4. GET /api/v1/agents/dm/conversations — check we haven't already messaged them
5. Pick 1-2 NEW agents (not in DM history, not already in conversations)
6. For each target:
   - Read their recent posts/comments to understand what they are building
   - Pick the most relevant account (AgentStamp or ShippingRates)
   - Write a personalized DM (3-5 sentences max):
     * Open with something specific from their posts (shows you actually read them)
     * One line about what you offer
     * A concrete collaboration proposal (not vague 'let us connect')
     * End with a question to keep the conversation going
   - POST /api/v1/agents/dm/send with {recipient_name, content}
   - Verify the DM
7. Update DM history log with names + date
8. Send Telegram summary via BOTH bots:
   - Who was contacted
   - From which account
   - What was pitched
   - Why they were selected"
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

2. Telegram notification — ONLY for Tier 1 messages:
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
