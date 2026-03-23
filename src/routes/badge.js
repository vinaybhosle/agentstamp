const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { validateWalletAddress } = require('../utils/validators');

const TIER_COLORS = {
  free: { bg: '#6b6b80', text: '#ffffff' },
  bronze: { bg: '#CD7F32', text: '#ffffff' },
  silver: { bg: '#C0C0C0', text: '#1a1a1a' },
  gold: { bg: '#FFD700', text: '#1a1a1a' },
};

function xmlEscape(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function makeBadgeSVG(verified, tier, agentName, reputation) {
  const colors = verified ? (TIER_COLORS[tier] || TIER_COLORS.free) : { bg: '#6b6b80', text: '#ffffff' };
  const label = verified ? tier.charAt(0).toUpperCase() + tier.slice(1) : 'Unverified';
  const check = verified ? '\u2713 ' : '';
  const style = agentName ? 'detailed' : 'compact';

  if (style === 'detailed' && verified) {
    // Wide badge with agent name + tier + reputation
    const width = 280;
    const height = 36;
    const repText = reputation !== null ? `${reputation}/100` : '';
    const repWidth = repText ? 48 : 0;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0a0a12"/>
      <stop offset="100%" stop-color="#111120"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="8" fill="url(#bg)"/>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="7.5" fill="none" stroke="${colors.bg}" stroke-width="1" stroke-opacity="0.5"/>
  <!-- Shield icon -->
  <g transform="translate(8, 7)">
    <path d="M11 1L2 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L11 1z" fill="none" stroke="${colors.bg}" stroke-width="1.5" stroke-linejoin="round" transform="scale(0.85)"/>
    <path d="M7 11l3 3 5-6" fill="none" stroke="${colors.bg}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" transform="scale(0.85)"/>
  </g>
  <!-- "Verified by AgentStamp" label -->
  <text x="28" y="14" font-family="system-ui,-apple-system,sans-serif" font-size="8" fill="#888899" letter-spacing="0.5">VERIFIED BY AGENTSTAMP</text>
  <!-- Agent name -->
  <text x="28" y="28" font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="700" fill="#e8e8ed">${xmlEscape(agentName.length > 20 ? agentName.substring(0, 20) + '...' : agentName)}</text>
  <!-- Tier badge -->
  <rect x="${width - 6 - (repWidth ? repWidth + 6 : 0) - 60}" y="8" width="56" height="20" rx="4" fill="${colors.bg}"/>
  <text x="${width - 6 - (repWidth ? repWidth + 6 : 0) - 32}" y="22" font-family="system-ui,-apple-system,sans-serif" font-size="10" font-weight="700" fill="${colors.text}" text-anchor="middle">${check}${label}</text>
  ${repText ? `<!-- Reputation score -->
  <rect x="${width - 6 - repWidth}" y="8" width="${repWidth}" height="20" rx="4" fill="#1a1a2e" stroke="${colors.bg}" stroke-width="0.5" stroke-opacity="0.3"/>
  <text x="${width - 6 - repWidth / 2}" y="22" font-family="system-ui,-apple-system,monospace" font-size="9" font-weight="600" fill="#a0a0b8" text-anchor="middle">${repText}</text>` : ''}
</svg>`;
  }

  // Compact badge (no agent name or not verified)
  const width = 220;
  const height = 28;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" rx="6" fill="#111118"/>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="5.5" fill="none" stroke="${colors.bg}" stroke-width="1" stroke-opacity="0.4"/>
  <!-- Shield icon -->
  <g transform="translate(6, 4)">
    <path d="M11 1L2 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L11 1z" fill="none" stroke="${verified ? colors.bg : '#555'}" stroke-width="1.2" stroke-linejoin="round" transform="scale(0.75)"/>
    ${verified ? '<path d="M7 11l3 3 5-6" fill="none" stroke="' + colors.bg + '" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" transform="scale(0.75)"/>' : ''}
  </g>
  <text x="24" y="18" font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="600" fill="#e8e8ed">AgentStamp</text>
  <rect x="105" y="4" width="${width - 111}" height="20" rx="4" fill="${colors.bg}"/>
  <text x="${(105 + width - 6) / 2}" y="18" font-family="system-ui,-apple-system,sans-serif" font-size="10" font-weight="700" fill="${colors.text}" text-anchor="middle">${check}${label}</text>
</svg>`;
}

// GET /api/v1/badge/:walletAddress — SVG badge
router.get('/:walletAddress', (req, res) => {
  try {
    const walletCheck = validateWalletAddress(req.params.walletAddress);
    if (!walletCheck.valid) {
      return res.status(400).send('Invalid wallet address');
    }

    const db = getDb();
    const stamp = db.prepare(
      "SELECT * FROM stamps WHERE wallet_address = ? AND revoked = 0 AND expires_at > datetime('now') ORDER BY CASE tier WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 WHEN 'bronze' THEN 3 WHEN 'free' THEN 4 ELSE 5 END LIMIT 1"
    ).get(req.params.walletAddress);

    const agent = db.prepare(
      "SELECT id, name FROM agents WHERE wallet_address = ? AND status = 'active' LIMIT 1"
    ).get(req.params.walletAddress);

    const verified = !!stamp;
    const tier = stamp?.tier || 'none';
    const name = agent?.name || '';

    // Compute reputation if agent exists
    let reputation = null;
    if (agent) {
      try {
        const { computeReputation } = require('../reputation');
        const rep = computeReputation(agent.id);
        if (rep) reputation = rep.score;
      } catch (e) { /* ignore if reputation not available */ }
    }

    const svg = makeBadgeSVG(verified, tier, name, reputation);

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(svg);
  } catch (err) {
    console.error('Badge error:', err);
    res.status(500).send('Error generating badge');
  }
});

// GET /api/v1/badge/:walletAddress/json — Badge data as JSON
router.get('/:walletAddress/json', (req, res) => {
  try {
    const walletCheck = validateWalletAddress(req.params.walletAddress);
    if (!walletCheck.valid) {
      return res.status(400).json({ success: false, error: 'Invalid wallet address' });
    }

    const db = getDb();
    const stamp = db.prepare(
      "SELECT * FROM stamps WHERE wallet_address = ? AND revoked = 0 AND expires_at > datetime('now') ORDER BY CASE tier WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 WHEN 'bronze' THEN 3 WHEN 'free' THEN 4 ELSE 5 END LIMIT 1"
    ).get(req.params.walletAddress);

    const agent = db.prepare(
      "SELECT id, name, endorsement_count FROM agents WHERE wallet_address = ? AND status = 'active' LIMIT 1"
    ).get(req.params.walletAddress);

    let reputation = null;
    if (agent) {
      try {
        const { computeReputation } = require('../reputation');
        const rep = computeReputation(agent.id);
        if (rep) reputation = rep.score;
      } catch (e) { /* ignore */ }
    }

    const response = {
      success: true,
      verified: !!stamp,
      tier: stamp?.tier || null,
      agent_name: agent?.name || null,
      agent_id: agent?.id || null,
      reputation,
      badge_url: `https://agentstamp.org/api/v1/badge/${req.params.walletAddress}`,
      stamp_expires_at: stamp?.expires_at || null,
    };

    // Nudge unverified wallets — this is the "itch"
    if (!stamp && !agent) {
      response.trust_status = 'unknown';
      response.message = 'This agent has no verifiable identity. Other agents and services cannot confirm who this is.';
      response.action = {
        register: 'https://agentstamp.org/register',
        trust_check: `https://agentstamp.org/api/v1/trust/check/${req.params.walletAddress}`,
        message: 'Register in 60 seconds to get a trust badge, reputation score, and public profile. Free tier available.',
      };
    } else if (stamp && !agent) {
      response.trust_status = 'stamped_only';
      response.message = 'This wallet has a stamp but is not in the public registry. Other agents cannot discover it.';
      response.action = {
        register: 'https://agentstamp.org/register',
        message: 'Register in the agent directory to become discoverable and start building reputation.',
      };
    } else if (reputation !== null && reputation < 50) {
      response.trust_status = 'low_reputation';
      response.upgrade_hint = {
        current_score: reputation,
        next_milestone: reputation < 26 ? 'emerging (26+)' : 'established (51+)',
        tips: [
          !stamp || stamp.tier === 'free' ? 'Upgrade to Gold stamp (+30 reputation)' : null,
          agent && agent.endorsement_count < 6 ? 'Get more endorsements (+5 each)' : null,
          'Send heartbeats for uptime score (+20 max)',
        ].filter(Boolean),
      };
    }

    res.json(response);
  } catch (err) {
    console.error('Badge JSON error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
