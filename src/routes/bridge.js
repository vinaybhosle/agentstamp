/**
 * ERC-8004 Bridge Routes — connect on-chain ERC-8004 agents to AgentStamp trust layer.
 *
 * Endpoints:
 *   GET  /api/v1/bridge/erc8004/:agentId          — Look up ERC-8004 agent + AgentStamp trust score (FREE)
 *   GET  /api/v1/bridge/erc8004/:agentId/passport  — Full AgentStamp passport for ERC-8004 agent (FREE)
 *   POST /api/v1/bridge/erc8004/link               — Link ERC-8004 agent to AgentStamp wallet ($0.01 x402)
 */

const express = require('express');
const router = express.Router();
const { getDb, resolvePrimaryWallet, getAllLinkedWallets } = require('../database');
const { getFullAgent } = require('../erc8004');
const { computeReputation, computeDelegationBonus } = require('../reputation');
const { requireSignature } = require('../middleware/walletSignature');
const { appendEvent } = require('../eventLog');

/**
 * GET /api/v1/bridge/erc8004/:agentId — Look up an ERC-8004 agent's trust profile (FREE)
 *
 * Returns on-chain identity from ERC-8004 + AgentStamp trust score if linked.
 * If not yet linked, auto-creates an AgentStamp profile from the registration data.
 */
router.get('/erc8004/:agentId', async (req, res) => {
  try {
    const erc8004Id = req.params.agentId;

    // Validate: must be numeric (ERC-721 token ID)
    if (!/^\d+$/.test(erc8004Id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ERC-8004 agent ID. Must be a numeric token ID.',
      });
    }

    // Check if we already have this agent linked
    const db = getDb();
    const existingLink = db.prepare(
      'SELECT * FROM erc8004_links WHERE erc8004_agent_id = ?'
    ).get(erc8004Id);

    // Fetch on-chain data
    const onChain = await getFullAgent(erc8004Id);
    if (!onChain.found) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found in ERC-8004 registry on Base.',
        erc8004_agent_id: erc8004Id,
      });
    }

    // Build response
    const response = {
      success: true,
      erc8004: {
        agent_id: onChain.agentId,
        owner: onChain.owner,
        agent_wallet: onChain.agentWallet,
        chain: onChain.chain,
        registry: onChain.registryAddress,
        registration: onChain.registration,
      },
    };

    // If linked to AgentStamp, include trust data
    if (existingLink) {
      const wallet = existingLink.agentstamp_wallet;
      const walletInfo = getAllLinkedWallets(wallet);
      const allWallets = walletInfo.all;
      if (allWallets.length === 0) {
        response.agentstamp = { linked: true, linked_at: existingLink.linked_at, wallet, trusted: false, score: 0, label: 'unknown', agent: null, stamp: null };
        return res.json(response);
      }
      const ph = allWallets.map(() => '?').join(',');

      const agent = db.prepare(
        `SELECT id, name, category, endorsement_count, status, registered_at, wallet_verified
         FROM agents WHERE wallet_address IN (${ph}) AND status = 'active'
         ORDER BY registered_at ASC LIMIT 1`
      ).get(...allWallets);

      const stamp = db.prepare(
        `SELECT id, tier, expires_at FROM stamps
         WHERE wallet_address IN (${ph}) AND revoked = 0 AND expires_at > datetime('now')
         ORDER BY CASE tier WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 WHEN 'bronze' THEN 3 WHEN 'free' THEN 4 ELSE 5 END
         LIMIT 1`
      ).get(...allWallets);

      let reputation = { score: 0, tier_label: 'new' };
      if (agent) {
        const rep = computeReputation(agent.id);
        if (rep) reputation = rep;
      }

      const delegationBonus = computeDelegationBonus(wallet, db);
      const trusted = reputation.score >= 10 || !!stamp || delegationBonus.bonus > 0;

      response.agentstamp = {
        linked: true,
        linked_at: existingLink.linked_at,
        wallet: wallet,
        trusted,
        score: reputation.score,
        label: reputation.tier_label,
        tier: stamp?.tier || 'none',
        agent: agent ? {
          id: agent.id,
          name: agent.name,
          category: agent.category,
          endorsements: agent.endorsement_count,
          profile_url: `https://agentstamp.org/registry/${agent.id}`,
        } : null,
        stamp: stamp ? {
          id: stamp.id,
          tier: stamp.tier,
          expires_at: stamp.expires_at,
          verify_url: `https://agentstamp.org/api/v1/stamp/verify/${stamp.id}`,
        } : null,
      };
    } else {
      // Not linked yet — show what they'd get
      response.agentstamp = {
        linked: false,
        message: 'This ERC-8004 agent is not yet linked to AgentStamp. Link it to get trust scoring, x402 payments, and forensic audit.',
        link_endpoint: 'POST /api/v1/bridge/erc8004/link',
        benefits: [
          'Trust score (0-100) with decay, delegation, and momentum',
          'x402 USDC micropayments on Base + Solana',
          'Forensic audit trail with hash-chained events',
          'A2A-compatible passport',
          'requireStamp() SDK middleware for access gating',
        ],
      };
    }

    res.json(response);
  } catch (err) {
    console.error('Bridge ERC-8004 lookup error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/bridge/erc8004/:agentId/passport — Full AgentStamp passport for ERC-8004 agent (FREE)
 */
router.get('/erc8004/:agentId/passport', async (req, res) => {
  try {
    const erc8004Id = req.params.agentId;

    if (!/^\d+$/.test(erc8004Id)) {
      return res.status(400).json({ success: false, error: 'Invalid ERC-8004 agent ID' });
    }

    const db = getDb();
    const link = db.prepare(
      'SELECT agentstamp_wallet FROM erc8004_links WHERE erc8004_agent_id = ?'
    ).get(erc8004Id);

    if (!link) {
      return res.status(404).json({
        success: false,
        error: 'ERC-8004 agent not linked to AgentStamp. Call POST /api/v1/bridge/erc8004/link first.',
      });
    }

    // Redirect to the passport endpoint for the linked wallet
    res.redirect(301, `/api/v1/passport/${link.agentstamp_wallet}`);
  } catch (err) {
    console.error('Bridge passport error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/bridge/erc8004/link — Link an ERC-8004 agent to an AgentStamp wallet ($0.01 x402)
 *
 * Body: { erc8004_agent_id: "12345" }
 * Headers: x-wallet-address (must own the ERC-8004 NFT)
 *
 * Verifies the caller's wallet owns the ERC-8004 NFT before linking.
 */
router.post('/erc8004/link', requireSignature({ required: true, action: 'bridge_erc8004' }), async (req, res) => {
  try {
    const db = getDb();
    const wallet = req.headers['x-wallet-address'];

    if (!wallet) {
      return res.status(401).json({ success: false, error: 'x-wallet-address header required' });
    }

    const erc8004Id = req.body.erc8004_agent_id;
    if (!erc8004Id || !/^\d+$/.test(erc8004Id)) {
      return res.status(400).json({
        success: false,
        error: 'erc8004_agent_id is required and must be a numeric token ID',
      });
    }

    // Check if already linked
    const existingLink = db.prepare(
      'SELECT * FROM erc8004_links WHERE erc8004_agent_id = ?'
    ).get(erc8004Id);

    if (existingLink) {
      return res.status(409).json({
        success: false,
        error: 'This ERC-8004 agent is already linked',
        linked_to: existingLink.agentstamp_wallet.slice(0, 6) + '...' + existingLink.agentstamp_wallet.slice(-4),
      });
    }

    // Verify the caller owns the ERC-8004 NFT
    const onChain = await getFullAgent(erc8004Id);
    if (!onChain.found) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found in ERC-8004 registry',
      });
    }

    const resolvedWallet = resolvePrimaryWallet(wallet);

    // Check ownership: caller must be the NFT owner OR the set agent wallet
    const isOwner = onChain.owner.toLowerCase() === resolvedWallet.toLowerCase();
    const isAgentWallet = onChain.agentWallet && onChain.agentWallet.toLowerCase() === resolvedWallet.toLowerCase();

    if (!isOwner && !isAgentWallet) {
      return res.status(403).json({
        success: false,
        error: 'Your wallet does not own this ERC-8004 agent NFT. Only the owner or designated agent wallet can link.',
      });
    }

    // Store the link — catch UNIQUE constraint to handle TOCTOU race
    try {
      db.prepare(
        `INSERT INTO erc8004_links (erc8004_agent_id, erc8004_chain, agentstamp_wallet, registration_name, registration_uri)
         VALUES (?, 'base', ?, ?, ?)`
      ).run(
        erc8004Id,
        resolvedWallet,
        onChain.registration?.name || null,
        onChain.agentURI || null,
      );
    } catch (insertErr) {
      if (insertErr.message?.includes('UNIQUE') || insertErr.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
        return res.status(409).json({ success: false, error: 'This ERC-8004 agent was just linked by another request' });
      }
      throw insertErr;
    }

    // Log the event
    appendEvent('erc8004_linked', {
      wallet_address: resolvedWallet,
      erc8004_agent_id: erc8004Id,
      erc8004_owner: onChain.owner,
      registration_name: onChain.registration?.name || null,
    });

    // Check if this wallet already has an AgentStamp agent — if so, link it
    const existingAgent = db.prepare(
      "SELECT id FROM agents WHERE wallet_address = ? AND status = 'active' ORDER BY registered_at ASC LIMIT 1"
    ).get(resolvedWallet);

    if (existingAgent) {
      db.prepare(
        'UPDATE erc8004_links SET agentstamp_agent_id = ? WHERE erc8004_agent_id = ?'
      ).run(existingAgent.id, erc8004Id);
    }

    res.json({
      success: true,
      erc8004_agent_id: erc8004Id,
      agentstamp_wallet: resolvedWallet,
      agentstamp_agent_id: existingAgent?.id || null,
      registration_name: onChain.registration?.name || null,
      message: existingAgent
        ? 'ERC-8004 agent linked to your AgentStamp identity. Trust score and passport are now available.'
        : 'ERC-8004 agent linked. Register on AgentStamp (free) to get a trust score: POST /api/v1/registry/register/free',
      trust_check_url: `https://agentstamp.org/api/v1/bridge/erc8004/${erc8004Id}`,
      passport_url: existingAgent ? `https://agentstamp.org/api/v1/bridge/erc8004/${erc8004Id}/passport` : null,
    });
  } catch (err) {
    console.error('Bridge link error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
