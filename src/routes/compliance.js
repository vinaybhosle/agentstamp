const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { computeReputation } = require('../reputation');
const { TRANSPARENCY_ALLOWED_KEYS } = require('../constants');

const READINESS_DISCLAIMER = 'This is an informational readiness checklist only. It does not constitute a conformity assessment, legal advice, or certification under the EU AI Act. Consult a qualified legal professional or notified body for formal compliance assessment.';

/**
 * Build the compliance readiness report for an agent.
 * Returns a new object each time (immutable pattern — no mutation).
 * @param {string} agentId
 * @returns {{ report: object|null, error: { status: number, body: object }|null }}
 */
function buildComplianceReport(agentId) {
  const db = getDb();
  const agent = db.prepare(
    "SELECT id, name, wallet_address, category, status, registered_at, last_heartbeat, human_sponsor, ai_act_risk_level, transparency_declaration, wallet_verified FROM agents WHERE id = ?"
  ).get(agentId);
  if (!agent) {
    return { report: null, error: { status: 404, body: { success: false, error: 'Agent not found' } } };
  }

  const reputation = computeReputation(agent.id);

  // Count audit events for this agent
  const eventCount = db.prepare(
    "SELECT COUNT(*) as count FROM event_log WHERE json_extract(payload, '$.agent_id') = ? OR json_extract(payload, '$.wallet_address') = ?"
  ).get(agent.id, agent.wallet_address);

  // Get stamp info
  const stamp = db.prepare(
    "SELECT id, tier, expires_at, revoked FROM stamps WHERE wallet_address = ? AND revoked = 0 AND expires_at > datetime('now') ORDER BY CASE tier WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 WHEN 'bronze' THEN 3 WHEN 'free' THEN 4 ELSE 5 END LIMIT 1"
  ).get(agent.wallet_address);

  // Get delegation count
  const delegations = db.prepare(
    "SELECT COUNT(*) as count FROM trust_delegations WHERE delegatee_wallet = ? AND expires_at > datetime('now')"
  ).get(agent.wallet_address);

  // Chain integrity (sample check — last 100 entries)
  let chainIntegrity = 'not_checked';
  if (eventCount?.count > 0) {
    try {
      const { verifyChain } = require('../hashChain');
      const chainResult = verifyChain(db, { limit: 100 });
      chainIntegrity = chainResult.valid ? 'verified' : 'broken';
    } catch (e) {
      chainIntegrity = 'error';
    }
  } else {
    chainIntegrity = 'no_events';
  }

  // Parse and allowlist transparency_declaration fields
  const transparencyFields = {};
  if (agent.transparency_declaration) {
    try {
      const raw = JSON.parse(agent.transparency_declaration);
      for (const key of TRANSPARENCY_ALLOWED_KEYS) {
        if (raw[key] !== undefined && typeof raw[key] === 'string') {
          transparencyFields[key] = raw[key].slice(0, 500);
        }
      }
    } catch (e) { /* invalid JSON — skip */ }
  }

  const report = {
    success: true,
    agent_id: agent.id,
    agent_name: agent.name,
    generated_at: new Date().toISOString(),

    ai_act: {
      risk_level: agent.ai_act_risk_level || 'not_declared',
      transparency: {
        is_ai_agent: true,
        human_sponsor: agent.human_sponsor || null,
        category: agent.category,
        ...transparencyFields,
      },
      article_52_disclosure: {
        is_ai_system: true,
        system_name: agent.name,
        operator: agent.human_sponsor || null,
        registry: 'agentstamp.org',
      },
    },

    audit_summary: {
      total_events: eventCount?.count || 0,
      chain_integrity: chainIntegrity,
      audit_endpoint: `/api/v1/audit/compliance?agent_id=${agent.id}`,
    },

    trust_status: {
      score: reputation?.score || 0,
      tier: reputation?.tier_label || 'new',
      active_stamp: stamp ? { tier: stamp.tier, expires_at: stamp.expires_at } : null,
      delegation_count: delegations?.count || 0,
      registered_at: agent.registered_at,
      last_heartbeat: agent.last_heartbeat,
    },

    verification: {
      wallet_verified: !!agent.wallet_verified,
      stamp_verified: !!stamp && !stamp.revoked,
      trust_check_url: `https://agentstamp.org/api/v1/trust/check/${agent.wallet_address}`,
      passport_url: `https://agentstamp.org/api/v1/passport/${agent.wallet_address}`,
    },
  };

  return { report, error: null };
}

// GET /api/v1/compliance/report/:agentId — Redirect to /readiness/:agentId
router.get('/report/:agentId', (req, res) => {
  res.redirect(301, `/api/v1/compliance/readiness/${req.params.agentId}`);
});

// GET /api/v1/compliance/readiness/:agentId — Readiness checklist with disclaimer
router.get('/readiness/:agentId', (req, res) => {
  try {
    const { report, error } = buildComplianceReport(req.params.agentId);

    if (error) {
      return res.status(error.status).json(error.body);
    }

    // Return a new object with the disclaimer added (immutable — no mutation of report)
    res.json({
      ...report,
      disclaimer: READINESS_DISCLAIMER,
    });
  } catch (err) {
    console.error('Compliance readiness error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
