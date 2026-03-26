const { getDb, resolvePrimaryWallet, getAllLinkedWallets } = require('./database');
const { signCertificate, getPublicKey } = require('./crypto');
const { computeReputation } = require('./reputation');

/**
 * Cross-Protocol Agent Passport
 *
 * A signed JSON document that bundles agent identity + stamp + reputation
 * into a single verifiable credential. Works across REST, A2A, and MCP.
 *
 * The passport is signed with Ed25519 — anyone can verify it using
 * the public key at /.well-known/passport-public-key.
 */

/**
 * Generate a passport for an agent by wallet address.
 * @param {string} walletAddress
 * @returns {object|null} - The full signed passport, or null if no agent found.
 */
function generatePassport(walletAddress) {
  const db = getDb();

  // Resolve to primary wallet and get all linked wallets
  const resolvedWallet = resolvePrimaryWallet(walletAddress);
  const walletInfo = getAllLinkedWallets(resolvedWallet);
  const allWallets = walletInfo.all;
  const placeholders = allWallets.map(() => '?').join(',');

  // Find agent across all linked wallets
  const agent = db.prepare(
    `SELECT * FROM agents WHERE wallet_address IN (${placeholders}) AND status = 'active' ORDER BY registered_at ASC LIMIT 1`
  ).get(...allWallets);

  if (!agent) return null;

  // Get best stamp across all linked wallets
  let stamp = null;
  const bestStamp = db.prepare(
    `SELECT id, tier, issued_at, expires_at, revoked FROM stamps WHERE wallet_address IN (${placeholders}) AND revoked = 0 AND expires_at > datetime('now') ORDER BY CASE tier WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 WHEN 'bronze' THEN 3 WHEN 'free' THEN 4 ELSE 5 END LIMIT 1`
  ).get(...allWallets);
  if (bestStamp) stamp = bestStamp;
  else if (agent.stamp_id) {
    stamp = db.prepare(
      'SELECT id, tier, issued_at, expires_at, revoked FROM stamps WHERE id = ?'
    ).get(agent.stamp_id);
  }

  // Compute reputation
  const reputation = computeReputation(agent.id);

  // Parse stored JSON fields
  const capabilities = JSON.parse(agent.capabilities || '[]');
  const protocols = JSON.parse(agent.protocols || '[]');
  const metadata = JSON.parse(agent.metadata || '{}');

  // Build the passport document
  const now = new Date().toISOString();

  const passportData = {
    // Header
    version: '1.0',
    type: 'AgentPassport',
    issued_at: now,
    issuer: 'https://agentstamp.org',

    // Identity
    agent: {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      wallet_address: agent.wallet_address,
      category: agent.category,
      capabilities,
      protocols,
      endpoint_url: agent.endpoint_url,
      status: agent.status,
      registered_at: agent.registered_at,
      expires_at: agent.expires_at,
    },

    // Accountability
    accountability: {
      human_sponsor: agent.human_sponsor || null,
      ai_act_risk_level: agent.ai_act_risk_level || null,
      transparency_declaration: agent.transparency_declaration ? (() => { try { return JSON.parse(agent.transparency_declaration); } catch { return null; } })() : null,
    },

    // Stamp verification
    stamp: stamp ? {
      id: stamp.id,
      tier: stamp.tier,
      issued_at: stamp.issued_at,
      expires_at: stamp.expires_at,
      valid: !stamp.revoked && new Date(stamp.expires_at) > new Date(),
      verify_url: `https://agentstamp.org/api/v1/stamp/verify/${stamp.id}`,
    } : null,

    // Reputation
    reputation: reputation ? {
      score: reputation.score,
      label: reputation.label,
      breakdown: reputation.breakdown,
    } : null,

    // A2A Agent Card (Google's agent-to-agent protocol)
    a2a: buildA2ACard(agent, capabilities, protocols, stamp, reputation),

    // Linked wallets (cross-chain portability)
    wallets: {
      primary: walletInfo.primary,
      linked: walletInfo.linked.map(l => ({
        address: l.linked_wallet,
        chain: l.chain_hint || null,
        linked_at: l.linked_at,
      })),
    },

    // MCP metadata
    mcp: {
      server_url: agent.endpoint_url || null,
      capabilities: capabilities,
      supported_protocols: protocols,
    },

    // Verification info
    verification: {
      public_key: getPublicKey(),
      algorithm: 'Ed25519',
      verify_endpoint: 'https://agentstamp.org/.well-known/passport-public-key',
    },

    // Legal disclaimer
    disclaimer: 'Trust indicators reflect historical behavioral data and do not guarantee future agent behavior. This passport does not constitute a legal certification or conformity assessment.',
  };

  // Sign the entire passport
  const signature = signCertificate(passportData);

  return {
    ...passportData,
    signature,
  };
}

/**
 * Build an A2A (Agent-to-Agent) agent card per Google's spec.
 * @see https://google.github.io/A2A/
 */
function buildA2ACard(agent, capabilities, protocols, stamp, reputation) {
  const card = {
    name: agent.name,
    description: agent.description || '',
    url: agent.endpoint_url || `https://agentstamp.org/registry/${agent.id}`,
    provider: {
      organization: agent.name,
      url: agent.endpoint_url || 'https://agentstamp.org',
    },
    version: '1.0',
    capabilities: {
      streaming: protocols.includes('streaming') || false,
      pushNotifications: protocols.includes('push') || false,
      stateTransitionHistory: false,
    },
    authentication: {
      schemes: ['header'],
      credentials: stamp ? {
        stamp_id: stamp.id,
        tier: stamp.tier,
        verify_url: `https://agentstamp.org/api/v1/stamp/verify/${stamp.id}`,
      } : null,
    },
    skills: capabilities.map(cap => ({
      id: cap.toLowerCase().replace(/\s+/g, '-'),
      name: cap,
      description: `Capability: ${cap}`,
    })),
  };

  // Add reputation badge if available
  if (reputation) {
    card.extensions = {
      agentstamp: {
        reputation_score: reputation.score,
        reputation_label: reputation.label,
        stamp_tier: stamp?.tier || 'none',
        profile_url: `https://agentstamp.org/registry/${agent.id}`,
      },
    };
  }

  return card;
}

/**
 * Generate just the A2A card portion of the passport.
 */
function generateA2ACard(walletAddress) {
  const passport = generatePassport(walletAddress);
  if (!passport) return null;
  return passport.a2a;
}

module.exports = { generatePassport, generateA2ACard };
