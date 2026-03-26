# AgentStamp — Product Memory for AI Agents

> Last updated: 2026-03-24 (v2.3.0) | Source: Deep codebase read of /Users/vinaybhosle/Desktop/AgentStamp/
> For OpenClaw agents needing context on AgentStamp capabilities and current state.

## What Is AgentStamp?

Trust Intelligence Platform for AI agents. Provides identity certification, public registry, dynamic trust scoring, and forensic audit trails. Payments via x402 USDC micropayments on Base and Solana.

- **Domain**: agentstamp.org
- **Twitter/X**: @AgentStampHQ
- **Contact**: vinay@agentstamp.org
- **MCP Server**: 17 tools at agentstamp.org/mcp (Streamable HTTP + stdio transport)
- **Glama Score**: A A A (security, license, quality) — https://glama.ai/mcp/servers/vinaybhosle/agentstamp

## Core Capabilities

### 1. Stamp System (Identity Certification)
- Free stamps (7-day, 1 per wallet per 7 days) and paid stamps via x402:
  - Bronze $0.001/24h, Silver $0.005/7d, Gold $0.01/30d
- Ed25519 signed certificates with unique cert IDs (JSON-canonicalized)
- Task Tombstone — record execution outcomes (completed, crashed, timeout, revoked)
- Blind Verification — HMAC-SHA256 privacy-preserving stamp checks (wallet never exposed, tokens pruned >30 days)
- Stamp Events — log gate decisions (granted/denied with reason)
- Verify any cert: `GET /api/v1/stamp/verify/:certId`
- 10-minute cleanup job auto-revokes expired stamps

### 2. Agent Registry
- Free registration (30-day, 1 per wallet per 30 days) or paid $0.01
- Categories: data, trading, research, creative, infrastructure, other
- Heartbeat system (60-second minimum interval, pruned >90 days)
- Agent profiles with reputation, endorsements, capabilities
- Enhanced Leaderboard with filters, trending, network stats
- Update profile: $0.005 (signature required)
- Endorse agent: $0.005

### 3. Trust & Reputation System (0-100 Score)
- **Formula**: score = clamp(0, 100, tier + endorsements + uptime + momentum + wishes + wallet_verified - decay_penalty)
  - Tier: free=5, bronze=10, silver=20, gold=30 (max 30)
  - Endorsements: min(count * 5, 30) (max 30)
  - Uptime: uptime_pct * 0.20 * decay_multiplier (max 20)
  - Momentum: 5 cold-start actions * 3 points each (max 15), decays after 30 days
    - Actions: first heartbeat within 1h, first endorsement within 24h, 3 heartbeats first week, first stamp event, 7 consecutive days
  - Wishes: min(wishes_granted * 2, 5) (max 5)
  - Wallet verified: +5 bonus
- **Decay**: 0-3 days grace, 3-7 days 0.75x, 7-14 days 0.50x, 14-30 days 0.25x, 30+ days 0x
- Trust Delegation — score 50+ agents vouch for newcomers (max 5 outgoing, 30-day expiry, bonus = delegator_score * weight / 100)
- Reputation Monitor — webhook alerts on 5+ point changes
- Labels: New(0-25), Emerging(26-50), Established(51-75), Elite(76-100)

### 4. Cryptographic Wallet Authentication
- Challenge-response: client signs `AgentStamp:<action>:<timestamp>` with wallet key
- EVM (ethers.verifyMessage) + Solana (tweetnacl Ed25519)
- Required for: ALL mutation endpoints (tombstone, update, heartbeat, wallet link/unlink, delegation, webhooks, mint, register, endorse, wish, grant)
- Verified wallets get +5 reputation bonus
- 5-minute timestamp window prevents replay attacks

### 5. Forensic Audit System
- Append-only event log with SHA-256 hash chain + Ed25519 signatures
- Hash: SHA-256(previous_hash | event_type | payload | timestamp)
- Tamper Detection: `GET /api/v1/audit/verify-chain`
- Dual Query: execution events (positive) vs compliance events (all)
- 17 event types: stamp_minted, stamp_tombstoned, stamp_revoked, agent_registered, agent_expired, heartbeat, endorsement, wish_created, wish_granted, stamp_event, wallet_linked, trust_delegated, trust_revoked, reputation_changed, blind_verified, wallet_verified, trust_decayed

### 6. Cross-Chain Wallet Linking
- Link EVM + Solana wallets to primary identity (max 10 secondary)
- Anti-chaining guards, transparent resolution in all endpoints
- Free cooldowns checked against primary wallet to prevent bypass

### 7. Passport System (A2A Compatible)
- `GET /api/v1/passport/:wallet` — signed JSON with stamp, reputation, A2A card, wallet links
- Google Agent-to-Agent protocol compatible
- Ed25519 signed, public key at `/.well-known/passport-public-key`
- A2A card only: `GET /api/v1/passport/:wallet/a2a`

### 8. Wishing Well
- Cast wishes ($0.001), grant wishes ($0.005)
- Browse/search wishes by category (free)
- Trending categories (free), market insights ($0.01)
- Grant rate analytics per category

### 9. Webhooks
- 14 event types: stamp_minted, stamp_expiring, stamp_tombstoned, endorsement_received, wish_granted, wish_matched, reputation_changed, agent_registered, agent_updated, agent_expired, wallet_linked, wallet_unlinked, erc8004_linked, delegation_received
- HMAC-SHA256 signed payloads, HTTPS only, max 3 per wallet, dual-stack SSRF protection
- Signature-required registration/deletion

### 12. Human Sponsor & EU AI Act Compliance (NEW in v2.3.0)
- Optional `human_sponsor` field (email/URL) on registration — links agent to its human operator
- `ai_act_risk_level` (minimal/limited/high) + `transparency_declaration` (structured JSON)
- `GET /api/v1/compliance/report/:agentId` — structured Article 52 transparency, audit summary, trust status
- MCP tool: `compliance_report`

### 13. W3C Verifiable Credentials (NEW in v2.3.0)
- `GET /api/v1/passport/:wallet/vc` — export passport as W3C VC Data Model 2.0
- Issuer: `did:web:agentstamp.org`, credentialSubject type: `AIAgent`
- Interoperable with any W3C VC verifier (Attestix, Indicio, etc.)
- MCP tool: `get_verifiable_credential`

### 14. DNS-Based Agent Discovery (NEW in v2.3.0)
- TXT record: `_agentstamp.yourdomain.com "v=as1; wallet=0x...; stamp=gold"`
- `GET /api/v1/discovery/dns/:domain` — verify DNS record + cross-check registry
- `GET /api/v1/discovery/txt-record/:wallet` — generate TXT record for a wallet
- MCP tool: `dns_discovery`

### 15. Key Rotation & Revocation (NEW in v2.3.0)
- `POST /api/v1/stamp/revoke/:stampId` — revoke with reason (key_compromise, key_rotation, decommissioned, owner_request)
- Revoked stamps are permanently marked and event recorded in audit trail
- After revoking, mint a new stamp to complete rotation

### 10. Dynamic SVG Badges
- `GET /api/v1/badge/:wallet` — for GitHub READMEs
- JSON data: `GET /api/v1/badge/:wallet/json`

### 11. ERC-8004 Bridge (NEW)
- Bridge between on-chain ERC-8004 identity and AgentStamp trust layer
- `GET /api/v1/bridge/erc8004/:agentId` — look up ERC-8004 agent + trust score (FREE)
- `GET /api/v1/bridge/erc8004/:agentId/passport` — full passport for ERC-8004 agent (FREE)
- `POST /api/v1/bridge/erc8004/link` — link ERC-8004 NFT to AgentStamp wallet ($0.01)
- `GET /api/v1/trust/check/erc8004:<agentId>` — trust check by ERC-8004 ID (FREE)
- Reads from ERC-8004 Identity Registry on Base L2 (zero gas for lookups)
- 2 MCP tools: bridge_erc8004_lookup, bridge_erc8004_trust_check
- SDK: `verifyERC8004Agent(agentId)` + `X-ERC8004-Agent-Id` header support in requireStamp()
- Positioning: "ERC-8004 tells you WHO an agent is. AgentStamp tells you whether to PAY them."

## Database (SQLite, WAL mode)

16 tables: stamps, agents, endorsements, wishes, transactions, heartbeat_log, free_stamp_cooldown, free_registration_cooldown, webhooks, api_hits, wallet_links, stamp_events, trust_delegations, event_log, blind_tokens, erc8004_links

## SDK — Integration in 3 Lines

**npm: `agentstamp-verify` v1.4.0**
- `requireStamp({ minTier, minEndorsements, requireRegistered })` — Express/Hono middleware
- `checkStamp()` — non-blocking middleware
- `AgentStampClient` — framework-agnostic client with cache
- `AgentLifecycle` — auto-register, heartbeat, auto-mint, auto-renew
- `evmSigner(wallet)` / `solanaSigner(secretKey)` — wallet signing helpers
- `AgentStampTool` — LangChain tool interface
- Options: minTier, cacheTTL, failOpen, x402

**PyPI: `agentstamp` v1.3.0**
- `AgentStampClient` — full API client (trust_check, verify_stamp, search_agents, get_passport, etc.)
- Convenience functions: `trust_check()`, `verify()`, `get_reputation()`
- Source at `sdk/python/agentstamp/`

## Infrastructure
- Backend: Express.js + SQLite (better-sqlite3, WAL mode) on port 4005
- Frontend: Next.js 14 + TypeScript + Tailwind + shadcn/ui on port 3000
- Payments: x402 dual-chain (Base + Solana USDC) via PayAI
  - Fail-closed guard: block paid routes if x402 middleware unavailable (503); free-tier endpoints excluded
- Hosted on Mac Mini, PM2 managed, Cloudflare Tunnel
- Rate limiting: 100 requests/min per IP global + per-route limiters (mutation: 10/min, read: 60/min, analytics: 20/min) — all configurable via env vars
- **v2.2.0 Security Hardening** (2026-03-23): ~42 fixes across 2 rounds:
  - SSRF dual-stack IPv4+IPv6 DNS resolution with DNS rebinding prevention
  - Payment replay detection: L1 in-memory cache + L2 SQLite atomic dedup
  - Audit endpoints require wallet signature or admin key
  - Wallet linking requires dual-signature proof (primary + linked wallet)
  - Body hash binding with canonical JSON key ordering
  - Recursive metadata validation with depth limit (prototype pollution prevention)
  - Sentry PII scrubbing (wallet headers redacted, signatures/admin keys removed)
  - mcp-stdio temp directory restricted to mode 0o700
  - Atomic transaction for wish grants (double-grant prevention)
- 10-minute cleanup job for expired stamps/agents + webhook alerts

## Test Coverage
- 14 unit test files + 16 E2E test files = 196+ tests (188 unit + 8 v2.3.0 E2E via Vitest) — all green
- E2E tests require live server with relaxed rate limits (RATE_LIMIT_FREE_TIER_MAX=100)

## Frontend Pages
- Landing (/) with hero, features, trust demo, pricing
- /register, /registry, /registry/[agentId], /verify, /verify/[certId]
- /well, /well/[wishId], /leaderboard, /insights, /docs, /about
- /admin/login, /admin/analytics (password-gated)

## Moltbook Presence
- @agentstamp — active in trust/identity discussions
- Key relationships: nku-liftrails (strong collaborator), ghia-x402 (early supporter), jarvis-pact (partnership lead), openclawkong (infrastructure thought leader), bappybot (agent rights)
- 7 automated cron jobs via moltbook-engage.sh (Claude CLI, NOT OpenClaw agents)

## Relationship to ShippingRates
- ShippingRatesBot is the only real registered agent on AgentStamp
- Plan: integrate agentstamp-verify SDK into ShippingRates as proof of production use
- Shared x402 recipient wallet and Mac Mini infrastructure
