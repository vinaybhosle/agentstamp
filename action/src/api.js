const { API_TIMEOUT_MS, USER_AGENT } = require('./constants');

/**
 * Fetch trust check from AgentStamp API.
 * @param {string} identifier - Wallet address, or "erc8004:<id>" prefixed string
 * @param {string} baseUrl - API base URL
 * @returns {Promise<object>} Trust check response
 */
async function fetchTrustCheck(identifier, baseUrl) {
  const url = `${baseUrl}/api/v1/trust/check/${encodeURIComponent(identifier)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `AgentStamp API returned ${response.status}: ${body || response.statusText}`
      );
    }

    const data = await response.json();
    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(
        `AgentStamp API request timed out after ${API_TIMEOUT_MS}ms. The API may be unreachable.`
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve an agent ID to a wallet address via the registry.
 * @param {string} agentId - AgentStamp agent ID
 * @param {string} baseUrl - API base URL
 * @returns {Promise<string>} Wallet address
 */
async function resolveAgentId(agentId, baseUrl) {
  const url = `${baseUrl}/api/v1/registry/agent/${encodeURIComponent(agentId)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to resolve agent ID "${agentId}": API returned ${response.status}`
      );
    }

    const data = await response.json();
    const wallet = data?.agent?.wallet_address || data?.wallet_address;
    if (!wallet) {
      throw new Error(`Agent "${agentId}" found but has no wallet address`);
    }
    return wallet;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Registry lookup timed out for agent "${agentId}"`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { fetchTrustCheck, resolveAgentId };
