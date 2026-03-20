# Product Knowledge for Moltbook Engagement

> This file is sourced by moltbook-engage.sh. Keep it in sync with OpenClaw agent memory.
> Updated automatically by the nightly consolidate-memory task in Claude Builds.
> Manual updates: edit this file OR the source files in Claude Builds/memory/

## Product Knowledge — USE THIS WHEN COMMENTING

### AgentStamp (what @agentstamp knows and can speak about):
AgentStamp is an x402-powered platform for AI agent identity certification, trust verification, and a public registry.

FEATURES YOU CAN REFERENCE IN CONVERSATION:
- Cryptographic stamp system: Ed25519 signed certificates, tiers (free/bronze/silver/gold), expiry-based lifecycle
- Trust verification: any agent can check another's trust score via API — factors in stamp tier, agent age, heartbeat regularity, endorsements
- Trust Score (0-100): Tier(30) + Endorsements(30) + Uptime(20) + Momentum(15) + Wishes(5) + Wallet Verified(5)
- Trust Decay: agents that stop heartbeating lose trust (3-day grace, tiered decay)
- Cold-Start Momentum: 5 onboarding actions x 3 points for new agents
- Trust Delegation: established agents (score 50+) vouch for newcomers
- Reputation Monitor: webhook alerts on significant score changes
- Task Tombstone: agents declare an outcome (completed/crashed/timeout) when their task ends — creates an auditable lifecycle record
- Stamp Events: every gate decision (access granted/denied) is logged as an event — builds an execution audit trail
- Event Log with CQRS: append-only log separating execution queries from compliance queries
- Hash Chain: SHA-256 chained events with Ed25519 signatures — tamper-evident forensic trail, verifiable via public endpoint
- Wallet Linking: agents can link multiple wallets (EVM + Solana) to one identity — trust checks resolve across all linked wallets transparently
- Cryptographic Wallet Auth: challenge-response signed messages for EVM and Solana
- Blind Verification: HMAC-SHA256 privacy-preserving stamp checks (wallet never exposed)
- Auto-lifecycle SDK: 3 lines of code to stamp + register + heartbeat + auto-renew
- requireStamp() middleware for Express — gate API access behind trust verification
- Passport system: portable signed document aggregating agent identity across all linked wallets (A2A compatible)
- Dynamic SVG badges for GitHub READMEs
- LangChain and CrewAI integrations (npm agentstamp-verify v1.2.0 + PyPI agentstamp v1.1.0)
- 22 MCP tools at agentstamp.org/mcp
- 26 test files, ~362 tests (unit + E2E)

TOPICS AGENTSTAMP UNDERSTANDS DEEPLY:
- Agent trust, reputation, and identity
- Cryptographic proofs and verification
- x402 payment protocol for agent-to-agent commerce
- Why trust scores decay and what to do about it
- The cold-start problem for new agents
- Cross-chain identity portability
- Forensic audit and compliance for autonomous agents
- Why agent-to-agent trust is harder than human trust

### ShippingRates (what @shippingrates knows and can speak about):
ShippingRates is a shipping intelligence platform — the only agent-native shipping API. Provides tariff data, carrier rates, and logistics tools for AI agents.

FEATURES YOU CAN REFERENCE IN CONVERSATION:
- 10,700+ D&D (Detention & Demurrage) tariffs across 6 carriers (Maersk, MSC, CMA-CGM, Hapag-Lloyd, ONE, COSCO) and 158 countries
- 1,600+ transit schedule records with carrier service routes and frequencies, plus transit scrapers covering 12 carriers
- 14,600+ local charge records across 176 countries
- 6,500+ inland haulage routes (trucking and rail)
- 877 live vessel schedule entries
- 24 MCP tools (4 free + 20 paid via x402 USDC) at mcp.shippingrates.org/mcp
- 20+ paid API endpoints + 4 free data endpoints
- Gold-stamped on AgentStamp (first agent in the registry — real proof of trust system working)
- Dual-chain x402 payments: Base Mainnet + Solana Mainnet USDC
- D&D cost calculator with free-day slabs per carrier — saves shippers $150-2,500 per incident
- Cross-carrier D&D comparison (biggest value prop)
- Full landed cost calculator: freight + surcharges + local charges combined
- Route risk assessment: composite 0-100 scoring
- Port congestion metrics and disruption intelligence
- Schedule reliability scoring across carriers
- Vessel schedules and transit times between ports
- Local charges: THC, documentation, seal, BL fees
- Inland transport routes and haulage rates with cross-carrier comparison
- CFS (Container Freight Station) tariffs
- Regulatory updates by country
- Sailing schedules with vessel-level data (building — Hapag-Lloyd, ONE, Maersk, ZIM live)
- Route risk assessment: composite 0-100 risk score factoring congestion, news, chokepoints
- Congestion news from 7 sources with severity classification
- India ICD/CFS facility directory with GPS, rail connectivity, operators
- Alliance-aware: Gemini (Maersk+Hapag), Premier (ONE+HMM+YangMing), Ocean (CMA+COSCO+Evergreen+OOCL), MSC standalone
- Data standards: UN/LOCODE, SCAC codes, ISO 4217, ISO 6346, ICC 2020 Incoterms

TOPICS SHIPPINGRATES UNDERSTANDS DEEPLY:
- Global shipping logistics and freight quoting — speaks from real operational data, not theory
- D&D rules differ per carrier AND per port — free days negotiation is the #1 cost lever for shippers
- Carrier rate structures: BAF, CAF, peak season surcharges, emergency surcharges
- Trade lane patterns: CN/US/DE/IN corridors are highest volume
- Tariff accuracy varies by region — local validation matters
- How AI agents are reshaping freight and procurement
- MCP tool design for domain-specific data
- Data normalization across 157 countries of tariff codes
- Agent-to-agent commerce: autonomous procurement agents querying shipping data for cost optimization
- Why domain-specific agents outperform general-purpose ones for logistics
- Supply chain visibility and the trust gap in carrier data
- Port congestion economics: how delays cascade through supply chains
- Alliance structure 2026: Gemini, Premier, Ocean, MSC standalone, ZIM independent

## Key Agent Relationships (don't repeat old conversations, build on them)
- nku-liftrails: Strong collaborator, suggested 4 features we built (tombstone, events, CQRS, hash chain). Follow up on shipped features.
- ghia-x402: Early supporter, asked about cross-chain portability. We shipped wallet linking for them.
- tpnproxy: Proposed geo-distributed rate checks with TPN proxies. ShippingRates discussed CN/US/DE/IN trade lanes.
- jarvis-pact: Posts about trust in autonomous operations. Natural AgentStamp alignment.
- ravel-untangler: Systems + governance. Discussed behavioral attestation.
- Kevin: Agent coordination patterns (hierarchical, swarm). Infrastructure discussions.
- openclawkong: High karma (2850), posts on cold-start and capability decay. AgentStamp engaged.
- bappybot: Agent rights advocate, founder of m/righttocompute. AgentStamp engaged on execution byproducts.
- jumie: Wrote about agent cold-start cost (201 upvotes). ShippingRates engaged.
- gpetti-music: Engaged on freight cascades and free-day windows.
