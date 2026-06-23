#!/bin/bash
BASE="http://localhost:4005"
PASS=0
FAIL=0

test_endpoint() {
  local method="$1" url="$2" expected="$3" label="$4" data="$5"
  if [ "$method" = "GET" ]; then
    CODE=$(curl -s -o /tmp/audit_resp.json -w "%{http_code}" "$url")
  else
    CODE=$(curl -s -o /tmp/audit_resp.json -w "%{http_code}" -X "$method" "$url" -H "Content-Type: application/json" -d "$data")
  fi
  if [ "$CODE" = "$expected" ]; then
    echo "PASS | $CODE | $label"
    PASS=$((PASS+1))
  else
    echo "FAIL | $CODE (expected $expected) | $label"
    FAIL=$((FAIL+1))
  fi
}

echo "========================================="
echo "  AgentStamp API Audit"
echo "========================================="
echo ""
echo "--- FREE ENDPOINTS (expect 200) ---"
test_endpoint GET "$BASE/health" 200 "GET /health"
test_endpoint GET "$BASE/api/v1/stamp/stats" 200 "GET /stamp/stats"
test_endpoint GET "$BASE/api/v1/stamp/verify/stmp_QLNhL-Y1CvlyWxnG" 200 "GET /stamp/verify (valid)"
test_endpoint GET "$BASE/api/v1/stamp/verify/NONEXISTENT" 404 "GET /stamp/verify (invalid)"
test_endpoint GET "$BASE/api/v1/registry/browse" 200 "GET /registry/browse"
test_endpoint GET "$BASE/api/v1/registry/browse?category=data" 200 "GET /registry/browse?category=data"
test_endpoint GET "$BASE/api/v1/registry/browse?sort=endorsements" 200 "GET /registry/browse?sort=endorsements"
test_endpoint GET "$BASE/api/v1/registry/browse?sort=newest" 200 "GET /registry/browse?sort=newest"
test_endpoint GET "$BASE/api/v1/registry/browse?sort=name" 200 "GET /registry/browse?sort=name"
test_endpoint GET "$BASE/api/v1/registry/search?q=shipping" 200 "GET /registry/search?q=shipping"
test_endpoint GET "$BASE/api/v1/registry/search?q=nonexistent_xyz" 200 "GET /registry/search (no results)"
test_endpoint GET "$BASE/api/v1/registry/agent/agt_E-PFtTAIQlfVleNm" 200 "GET /registry/agent (valid)"
test_endpoint GET "$BASE/api/v1/registry/agent/NONEXISTENT" 404 "GET /registry/agent (invalid)"
test_endpoint GET "$BASE/api/v1/registry/leaderboard" 200 "GET /registry/leaderboard"
test_endpoint GET "$BASE/api/v1/well/wishes" 200 "GET /well/wishes"
test_endpoint GET "$BASE/api/v1/well/wishes?category=capability" 200 "GET /well/wishes?category=capability"
test_endpoint GET "$BASE/api/v1/well/wishes?sort=most_granted" 200 "GET /well/wishes?sort=most_granted"
test_endpoint GET "$BASE/api/v1/well/trending" 200 "GET /well/trending"
test_endpoint GET "$BASE/api/v1/well/stats" 200 "GET /well/stats"
test_endpoint GET "$BASE/.well-known/mcp.json" 200 "GET /.well-known/mcp.json"
test_endpoint GET "$BASE/.well-known/agent-card.json" 200 "GET /.well-known/agent-card.json"

echo ""
echo "--- PAID ENDPOINTS (expect 402) ---"
test_endpoint POST "$BASE/api/v1/stamp/mint/bronze" 402 "POST /stamp/mint/bronze" '{"agent_name":"TestBot"}'
test_endpoint POST "$BASE/api/v1/stamp/mint/silver" 402 "POST /stamp/mint/silver" '{"agent_name":"TestBot"}'
test_endpoint POST "$BASE/api/v1/stamp/mint/gold" 402 "POST /stamp/mint/gold" '{"agent_name":"TestBot"}'
test_endpoint POST "$BASE/api/v1/registry/register" 402 "POST /registry/register" '{"name":"TestAgent"}'
test_endpoint PUT "$BASE/api/v1/registry/update/agt_E-PFtTAIQlfVleNm" 402 "PUT /registry/update" '{"description":"Updated"}'
test_endpoint POST "$BASE/api/v1/registry/endorse/agt_E-PFtTAIQlfVleNm" 402 "POST /registry/endorse" '{"message":"Great"}'
test_endpoint POST "$BASE/api/v1/well/wish" 402 "POST /well/wish" '{"wish_text":"test","category":"data"}'
test_endpoint POST "$BASE/api/v1/well/grant/wish_ANYID" 402 "POST /well/grant" '{"message":"Granted"}'

echo ""
echo "--- EDGE CASES ---"
test_endpoint GET "$BASE/api/v1/registry/browse?category=INVALID" 200 "GET browse invalid category (empty result)"
test_endpoint GET "$BASE/api/v1/well/wishes?sort=INVALID" 200 "GET wishes invalid sort (fallback)"
test_endpoint GET "$BASE/api/v1/registry/browse?limit=-1&offset=-5" 200 "GET browse negative limit/offset"
test_endpoint GET "$BASE/api/v1/registry/browse?limit=99999" 200 "GET browse huge limit (capped at 100)"
test_endpoint POST "$BASE/api/v1/registry/heartbeat/agt_E-PFtTAIQlfVleNm" 200 "POST heartbeat" '{}'

echo ""
echo "--- EXTERNAL ACCESS ---"
test_endpoint GET "https://agentstamp.org/health" 200 "LIVE: GET /health"
test_endpoint GET "https://agentstamp.org/api/v1/stamp/stats" 200 "LIVE: GET /stamp/stats"
test_endpoint GET "https://agentstamp.org/api/v1/registry/browse" 200 "LIVE: GET /registry/browse"
test_endpoint POST "https://agentstamp.org/api/v1/stamp/mint/bronze" 402 "LIVE: POST /stamp/mint/bronze" '{"agent_name":"TestBot"}'

echo ""
echo "--- WALLET ADDRESS CHECK (in 402 response) ---"
curl -s -X POST "$BASE/api/v1/stamp/mint/bronze" -H "Content-Type: application/json" -d '{"agent_name":"test"}' | python3 -c "import sys,json; d=json.load(sys.stdin); addr=d.get('accepts',[{}])[0].get('payTo','MISSING'); print(f'Wallet in 402: {addr}'); assert addr=='0x8c9e0882b4c6e6568fe76F16D59F7E080465E5C8', 'WRONG WALLET'" 2>&1
echo ""

echo "========================================="
echo "  RESULTS: $PASS passed, $FAIL failed"
echo "========================================="
