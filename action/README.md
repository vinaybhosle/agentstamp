# AgentStamp Verify Agent — GitHub Action

Verify your AI agent's trust score, stamp tier, and reputation in CI/CD.

## Quick Start

```yaml
- uses: vinaybhosle/agentstamp/action@v2
  id: trust
  with:
    wallet-address: '0xYourAgentWallet'
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `wallet-address` | One of three | | Ethereum wallet address (0x...) |
| `agent-id` | One of three | | AgentStamp registry agent ID |
| `erc8004-id` | One of three | | ERC-8004 on-chain agent ID |
| `min-tier` | No | `none` | Minimum stamp tier: `none`, `free`, `bronze`, `silver`, `gold` |
| `min-score` | No | `0` | Minimum reputation score (0-100) |
| `min-endorsements` | No | `0` | Minimum endorsement count |
| `fail-on-error` | No | `true` | Fail workflow on verification failure |
| `generate-badge` | No | `false` | Generate trust badge SVG |
| `badge-path` | No | `.github/badges/agentstamp.svg` | Badge output path |
| `api-base-url` | No | `https://agentstamp.org` | AgentStamp API URL |

## Outputs

| Output | Description |
|--------|-------------|
| `verified` | Passed all threshold checks (`true`/`false`) |
| `trusted` | Raw trust status from API |
| `score` | Reputation score (0-100) |
| `tier` | Stamp tier (gold, silver, bronze, free, none) |
| `label` | Reputation label (new, emerging, established, elite) |
| `agent-name` | Agent name from registry |
| `agent-id` | Agent ID from registry |
| `endorsements` | Endorsement count |
| `stamp-expires` | Stamp expiry date |
| `profile-url` | Agent profile URL |

## Examples

### Gate deployment on gold tier

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  verify-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: vinaybhosle/agentstamp/action@v2
        id: trust
        with:
          wallet-address: '0xYourAgentWallet'
          min-tier: 'gold'
          min-score: '50'

      - name: Deploy
        if: steps.trust.outputs.verified == 'true'
        run: echo "Deploying trusted agent (score: ${{ steps.trust.outputs.score }})"
```

### Soft check on PRs (warn only)

```yaml
- uses: vinaybhosle/agentstamp/action@v2
  with:
    wallet-address: '0xYourAgentWallet'
    fail-on-error: 'false'
```

### ERC-8004 agent verification

```yaml
- uses: vinaybhosle/agentstamp/action@v2
  with:
    erc8004-id: '42'
    min-tier: 'bronze'
```

### Generate trust badge

```yaml
- uses: vinaybhosle/agentstamp/action@v2
  with:
    wallet-address: '0xYourAgentWallet'
    generate-badge: 'true'
    badge-path: '.github/badges/trust.svg'

- name: Commit badge
  run: |
    git add .github/badges/trust.svg
    git diff --staged --quiet || git commit -m "chore: update trust badge"
```

## How It Works

1. Calls the AgentStamp trust check API (`GET /api/v1/trust/check/:wallet`)
2. Evaluates the response against your configured thresholds
3. Sets outputs for downstream steps
4. Optionally generates an SVG badge
5. Writes a job summary with trust details

No API key needed — trust checks are free.

## Links

- [AgentStamp](https://agentstamp.org)
- [Documentation](https://agentstamp.org/docs)
- [npm SDK](https://www.npmjs.com/package/agentstamp-verify)
