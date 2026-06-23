# AgentStamp — Claude Code Context

You have MemPalace memory. On session start, run `mempalace_status` to load your memory protocol and AAAK spec.

## Quick Identity
- Product: AgentStamp (agentstamp.org) — AI agent identity certification platform
- Owner: Vinay Prabhu, DataBridge Solutions, Pune India
- Repo: ~/Desktop/AgentStamp/
- Twitter: @AgentStampHQ
- Email routing: vinay@agentstamp.org via Cloudflare

## Stack
- Express backend: port 4005 (PM2: agentstamp-backend)
- Next.js 15 frontend: port 4000 prod / 3000 dev (PM2: agentstamp-web)
- SQLite database
- Ed25519 cryptography for stamp signing
- x402/PayAI on Base (wallet: 0x8c9e0882b4c6e6568fe76F16D59F7E080465E5C8)
- Cloudflare Tunnel active
- npm SDK: agentstamp-verify (requireStamp() middleware)

## Key Status
- Three Gold Stamps minted via Solana x402 transactions
- Pre-revenue (target exit: $2–5K MRR, 500–1,000 registered agents)
- AgentShield Grade A achieved

## Security Notes (audit findings — RESOLVED)
- Spoofable wallet auth headers — FIXED: challenge-response signatures with body-hash binding + 120s replay window (src/walletAuth.js, src/middleware/walletSignature.js)
- Fail-open x402 middleware — FIXED: fail-CLOSED guard returns 503 on middleware failure + SQLite-backed payment replay dedup (server.js)
- Unbounded MCP session maps — FIXED: MAX_SESSIONS=1000 + 30-min idle eviction + per-session rate limit (src/mcp-server.js)
- Liveness probe is SSRF-hardened: connect-time IP pinning (defeats DNS-rebinding) + no redirect-follow (src/livenessProbe.js, src/utils/network.js)

## Trust Model Note (2026-06-23)
Trust score is participation-based by design; externally-anchored signals are surfaced separately via `provenance` / `independent_signals` on `/trust/check` (independent endpoint liveness probe + cryptographic wallet proof + counterparty-attested stamp events). The numeric score formula is unchanged. See memory `agentstamp-gap-analysis-2026-06-23`.

## Memory
You have MemPalace agents. Run `mempalace_list_agents` to see them.
For decisions/history: `mempalace_search "query" --wing agentstamp`
- Shared LLM wiki context: `/Users/vinaybhosle/Knowledge/wiki/agentstamp/overview.md`
- Cross-product wiki context: `/Users/vinaybhosle/Knowledge/wiki/cross-product/overview.md`

## Coding Style
- Complete production-ready outputs only (no partial examples)
- Always check security audit findings before adding auth flows
- Ed25519 signatures must be verified server-side, never client-side
