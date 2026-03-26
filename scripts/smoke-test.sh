#!/usr/bin/env bash
# Post-deploy smoke test for AgentStamp
# Verifies all critical endpoints return expected status codes.
# Run after every rebuild/deploy. Exit 1 on any failure.

set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:4005}"
WEB_URL="${WEB_URL:-http://localhost:4000}"
FAILURES=0
TOTAL=0

check() {
  local url="$1"
  local expected="$2"
  local label="$3"
  TOTAL=$((TOTAL + 1))

  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")

  if [ "$status" = "$expected" ]; then
    echo "  ✅ $label ($status)"
  else
    echo "  ❌ $label — expected $expected, got $status"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "═══════════════════════════════════════════"
echo "  AgentStamp Smoke Test"
echo "═══════════════════════════════════════════"
echo ""

echo "Backend API ($BACKEND_URL):"
check "$BACKEND_URL/health" "200" "Health check"
check "$BACKEND_URL/api/v1/registry/browse" "200" "Registry browse"
check "$BACKEND_URL/api/v1/stamp/verify/nonexistent-id" "404" "Stamp verify (404 expected)"
check "$BACKEND_URL/api/v1/compliance/readiness/nonexistent-id" "404" "Compliance readiness (404 expected)"
check "$BACKEND_URL/.well-known/agents.json" "200" "Agent discovery"
# check "$BACKEND_URL/openapi.json" "200" "OpenAPI spec"  # Not wired in v2.3.0
echo ""

echo "Frontend ($WEB_URL):"
check "$WEB_URL/" "200" "Landing page"
check "$WEB_URL/registry" "200" "Registry"
check "$WEB_URL/verify" "200" "Verify"
check "$WEB_URL/register" "200" "Register"
check "$WEB_URL/well" "200" "Wishing Well"
check "$WEB_URL/leaderboard" "200" "Leaderboard"
check "$WEB_URL/docs" "200" "Docs"
check "$WEB_URL/insights" "200" "Insights"
check "$WEB_URL/privacy" "200" "Privacy Policy"
check "$WEB_URL/terms" "200" "Terms of Service"
check "$WEB_URL/admin/login" "200" "Admin login"
check "$WEB_URL/admin/analytics" "307" "Admin analytics (redirect to login)"
check "$WEB_URL/sitemap.xml" "200" "Sitemap"
echo ""

echo "Blog pages:"
check "$WEB_URL/blog" "200" "Blog index"
check "$WEB_URL/blog/trust-verification-3-lines" "200" "Blog: trust verification"
check "$WEB_URL/blog/why-agents-need-identity" "200" "Blog: why agents need identity"
check "$WEB_URL/blog/non-human-identity-crisis" "200" "Blog: NHI crisis"
check "$WEB_URL/blog/eu-ai-act-agent-compliance" "200" "Blog: EU AI Act"
check "$WEB_URL/blog/zero-trust-ai-agents" "200" "Blog: zero trust"
check "$WEB_URL/blog/dns-agent-discovery" "200" "Blog: DNS discovery"
check "$WEB_URL/blog/tamper-evident-audit-trails" "200" "Blog: audit trails"
check "$WEB_URL/blog/x402-identity-verified-commerce" "200" "Blog: x402"
check "$WEB_URL/blog/verifiable-credentials-ai-agents" "200" "Blog: W3C VC"
check "$WEB_URL/blog/guardian-agents-need-identity" "200" "Blog: guardian agents"
check "$WEB_URL/blog/mcp-server-security" "200" "Blog: MCP security"
check "$WEB_URL/blog/agent-key-rotation-revocation" "200" "Blog: key rotation"
echo ""

echo "═══════════════════════════════════════════"
if [ "$FAILURES" -eq 0 ]; then
  echo "  ✅ ALL $TOTAL CHECKS PASSED"
  echo "═══════════════════════════════════════════"
  exit 0
else
  echo "  ❌ $FAILURES / $TOTAL CHECKS FAILED"
  echo "═══════════════════════════════════════════"
  exit 1
fi
