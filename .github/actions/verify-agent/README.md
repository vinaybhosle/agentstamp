# AgentStamp Verify Action

Gate your CI/CD pipeline behind AI agent trust verification. Verify an agent's identity stamp and trust score before deploying.

## Usage

```yaml
- name: Verify Agent Trust
  uses: vinaybhosle/agentstamp/.github/actions/verify-agent@main
  with:
    wallet-address: ${{ secrets.AGENT_WALLET }}
    min-tier: 'bronze'
    min-score: '50'
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `wallet-address` | Yes | - | Agent wallet address (EVM or Solana) |
| `min-tier` | No | `bronze` | Minimum stamp tier (free/bronze/silver/gold) |
| `min-score` | No | `0` | Minimum trust score (0-100) |
| `api-url` | No | `https://agentstamp.org` | AgentStamp API URL |
| `fail-on-unregistered` | No | `false` | Fail if agent not in registry |

## Outputs

| Output | Description |
|--------|-------------|
| `verified` | Whether verification passed (true/false) |
| `trust-score` | Agent's trust score (0-100) |
| `tier` | Agent's stamp tier |
| `agent-name` | Agent's registered name |

## Example: Gate Deployment

```yaml
name: Deploy with Trust Check
on: push

jobs:
  verify-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Verify Agent Trust
        id: trust
        uses: vinaybhosle/agentstamp/.github/actions/verify-agent@main
        with:
          wallet-address: ${{ secrets.AGENT_WALLET }}
          min-tier: 'silver'
          min-score: '60'

      - name: Deploy
        if: steps.trust.outputs.verified == 'true'
        run: echo "Deploying trusted agent (score: ${{ steps.trust.outputs.trust-score }})"
```
