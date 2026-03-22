/**
 * AgentStamp Verify SDK
 *
 * Lightweight client for the AgentStamp trust API.
 * Zero dependencies — uses Node's built-in fetch (Node 18+).
 */

const DEFAULT_API_URL = 'https://agentstamp.org/api/v1';

const TIER_LEVELS = { none: 0, bronze: 1, silver: 2, gold: 3 };

/**
 * Check an agent's trust score.
 *
 * @param {string} walletAddress - The agent's wallet address
 * @param {object} [options]
 * @param {string} [options.apiUrl] - AgentStamp API base URL
 * @returns {Promise<object>} Trust verdict
 */
async function checkTrust(walletAddress, options = {}) {
  const apiUrl = options.apiUrl || process.env.AGENTSTAMP_API_URL || DEFAULT_API_URL;
  const url = `${apiUrl}/trust/check/${encodeURIComponent(walletAddress)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`AgentStamp trust check failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Verify an agent meets a minimum trust tier.
 *
 * @param {string} walletAddress
 * @param {string} minTier - 'bronze' | 'silver' | 'gold'
 * @param {object} [options]
 * @returns {Promise<{verified: boolean, tier: string, score: number, agent: object}>}
 */
async function verifyAgent(walletAddress, minTier = 'bronze', options = {}) {
  const result = await checkTrust(walletAddress, options);
  const agentTier = (result.tier || 'none').toLowerCase();
  const verified = (TIER_LEVELS[agentTier] || 0) >= (TIER_LEVELS[minTier] || 0);

  return {
    verified,
    tier: agentTier,
    score: result.score || 0,
    trusted: result.trusted || false,
    agent: result.agent || null,
  };
}

module.exports = { checkTrust, verifyAgent, TIER_LEVELS, DEFAULT_API_URL };
