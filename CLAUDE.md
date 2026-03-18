# AgentStamp — Claude Code Context

## Project Overview

AgentStamp is an x402-powered platform for AI agent identity certification, public registry, and a digital wishing well. Agents register, get certified, and can be verified by other agents via the agentstamp-verify SDK.

## Architecture

- **Backend**: Express API on port 3405 (PM2-managed, Cloudflare Tunnel)
- **Frontend**: Next.js 14 + TypeScript + Tailwind + shadcn/ui on port 3000
- **Proxy**: Frontend proxies `/api/*` to backend
- **Payments**: PayAI (`https://facilitator.payai.network`) via `x402-express` npm package (no API keys required)
- **Recipient wallet**: `0x8c9e0882b4c6e6568fe76F16D59F7E080465E5C8` (Base)
- **Domain**: `agentstamp.org`
- **Twitter/X**: `@AgentStampHQ`
- **Contact**: `vinay@agentstamp.org` (Cloudflare Email Routing → Gmail)

## Key Details

- Only real registered agent is **ShippingRatesBot** (all seed/demo data removed)
- Strategic growth centers on the **agentstamp-verify SDK** (`requireStamp()` middleware for Express/Hono)
- Plan: integrate with ShippingRates first as proof of production use, then publish to npm

## Development Conventions

- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- TypeScript/Node.js stack
- Next.js 14 App Router patterns
- shadcn/ui for components
- PM2 for process management
- Cloudflare Tunnel for external access
- Never hardcode secrets — use environment variables

## ECC Skills to Activate

When working on this project, prefer these ECC skills:
- `agent-harness-construction` — Action space design for agent APIs
- `enterprise-agent-ops` — Agent lifecycle management
- `security-review` — Security audit (critical for trust platform)
- `security-scan` — AgentShield scanning
- `api-design` — REST API patterns for registry
- `frontend-patterns` — Next.js/React patterns
- `tdd-workflow` — Test-driven development
- `content-engine` — Marketing content for @AgentStampHQ
- `x-api` — Twitter/X API for @AgentStampHQ posting
- `investor-materials` — Pitch deck and fundraising docs
- `market-research` — Competitive analysis

## Subagent Routing

- **Registry API development** → Use Sonnet
- **Security/certification logic** → Use Opus (trust-critical)
- **Frontend UI work** → Use Sonnet
- **Documentation** → Use Haiku
- **SDK development** → Use Sonnet
- **Marketing content** → Use Sonnet
