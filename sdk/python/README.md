# AgentStamp Python SDK

Trust verification and reputation scoring for AI agents.

## Install

```bash
pip install agentstamp
```

## Quick Start

```python
from agentstamp import trust_check, verify, get_reputation

# Check if a wallet is trusted
result = trust_check("0x1234...")
print(result["trusted"])  # True/False
print(result["score"])    # 0-100

# Verify a stamp certificate
cert = verify("stmp_QLNhL-Y1CvlyWxnG")
print(cert["valid"])

# Get reputation breakdown
rep = get_reputation("agt_E-PFtTAIQlfVleNm")
print(rep["score"], rep["tier_label"])
```

## Client Usage

```python
from agentstamp import AgentStampClient

client = AgentStampClient()

# Search agents
agents = client.search_agents(query="trading", category="data")

# Browse the registry
all_agents = client.browse_agents(limit=20)

# Get leaderboard
leaders = client.leaderboard()

# Get agent passport
passport = client.get_passport("0x1234...")
```

## Links

- [AgentStamp](https://agentstamp.org)
- [GitHub](https://github.com/vinaybhosle/agentstamp)
- [npm SDK](https://www.npmjs.com/package/agentstamp-verify)
