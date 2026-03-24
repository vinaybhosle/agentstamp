const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { computeReputation } = require('../reputation');
const { TRANSPARENCY_ALLOWED_KEYS } = require('../constants');

// GET /api/v1/compliance/report/:agentId — Structured EU AI Act compliance report
router.get('/report/:agentId', (req, res) => {
  try {
    const db = getDb();
    const agent = db.prepare(
      "SELECT id, name, wallet_address, category, status, registered_at, last_heartbeat, human_sponsor, ai_act_risk_level, transparency_declaration, wallet_verified FROM agents WHERE id = ?"
    ).get(req.params.agentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
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
    let transparencyFields = {};
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

    res.json(report);
  } catch (err) {
    console.error('Compliance report error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
