const AGENT_CATEGORIES = ['data', 'trading', 'research', 'creative', 'infrastructure', 'other'];
const WISH_CATEGORIES = ['capability', 'data', 'connection', 'existential', 'other'];
const STAMP_TIERS = ['bronze', 'silver', 'gold'];

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim();
}

function validateWalletAddress(address) {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Wallet address is required' };
  }
  // EVM (Ethereum/Base/Polygon): 0x + 40 hex chars
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { valid: true, error: null, chain: 'evm' };
  }
  // Solana: base58, 32-44 chars (no 0x prefix)
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return { valid: true, error: null, chain: 'solana' };
  }
  return { valid: false, error: 'Invalid wallet address format. Expected Ethereum (0x + 40 hex) or Solana (base58, 32-44 chars).' };
}

function validateStampMint(body) {
  const agentName = sanitize(body.agent_name || '');
  if (agentName.length > 100) {
    return { valid: false, error: 'agent_name must be 100 characters or less' };
  }
  return { valid: true, error: null, data: { agent_name: agentName, metadata: body.metadata || {} } };
}

function validateUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return url;
    return '';
  } catch {
    return '';
  }
}

function validateMetadata(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
  const str = JSON.stringify(meta);
  if (str.length > 5120) return {}; // 5KB max
  return meta;
}

function validateAgentRegister(body) {
  const name = sanitize(body.name || '');
  if (!name) return { valid: false, error: 'name is required' };
  if (name.length > 100) return { valid: false, error: 'name must be 100 characters or less' };

  const description = sanitize(body.description || '');
  if (description.length > 1000) return { valid: false, error: 'description must be 1000 characters or less' };

  const category = body.category || 'other';
  if (!AGENT_CATEGORIES.includes(category)) {
    return { valid: false, error: `category must be one of: ${AGENT_CATEGORIES.join(', ')}` };
  }

  return {
    valid: true,
    error: null,
    data: {
      name,
      description,
      category,
      capabilities: Array.isArray(body.capabilities)
        ? body.capabilities.filter(c => typeof c === 'string').slice(0, 20).map(c => c.slice(0, 100))
        : [],
      protocols: Array.isArray(body.protocols)
        ? body.protocols.filter(p => typeof p === 'string').slice(0, 20).map(p => p.slice(0, 100))
        : [],
      endpoint_url: validateUrl(sanitize(body.endpoint_url || '')),
      stamp_id: body.stamp_id || null,
      metadata: validateMetadata(body.metadata),
    },
  };
}

function validateWish(body) {
  const wishText = sanitize(body.wish_text || '');
  if (!wishText) return { valid: false, error: 'wish_text is required' };
  if (wishText.length > 500) return { valid: false, error: 'wish_text must be 500 characters or less' };

  const category = body.category || 'other';
  if (!WISH_CATEGORIES.includes(category)) {
    return { valid: false, error: `category must be one of: ${WISH_CATEGORIES.join(', ')}` };
  }

  return {
    valid: true,
    error: null,
    data: {
      wish_text: wishText,
      category,
      agent_id: body.agent_id || null,
    },
  };
}

const STAMP_EVENT_OUTCOMES = ['executed', 'denied', 'error'];

function validateStampEvent(body) {
  const errors = [];
  if (!body.wallet_address) {
    errors.push('wallet_address is required');
  } else {
    const walletCheck = validateWalletAddress(body.wallet_address);
    if (!walletCheck.valid) {
      errors.push('wallet_address must be a valid EVM or Solana address');
    }
  }
  if (!body.action || typeof body.action !== 'string' || body.action.length > 100) {
    errors.push('action is required and must be a string under 100 characters');
  }
  if (!body.outcome || !STAMP_EVENT_OUTCOMES.includes(body.outcome)) {
    errors.push(`outcome must be one of: ${STAMP_EVENT_OUTCOMES.join(', ')}`);
  }
  if (body.gate_reason && (typeof body.gate_reason !== 'string' || body.gate_reason.length > 500)) {
    errors.push('gate_reason must be a string under 500 characters');
  }
  if (body.endpoint && (typeof body.endpoint !== 'string' || body.endpoint.length > 200)) {
    errors.push('endpoint must be a string under 200 characters');
  }
  if (body.metadata) {
    const metaStr = typeof body.metadata === 'string' ? body.metadata : JSON.stringify(body.metadata);
    if (metaStr.length > 5120) {
      errors.push('metadata must be under 5KB');
    }
  }
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

const TOMBSTONE_OUTCOMES = ['completed', 'crashed', 'timeout', 'revoked'];

function validateTombstone(body) {
  const errors = [];
  if (!body.outcome || !TOMBSTONE_OUTCOMES.includes(body.outcome)) {
    errors.push(`outcome must be one of: ${TOMBSTONE_OUTCOMES.join(', ')}`);
  }
  if (body.reason && (typeof body.reason !== 'string' || body.reason.length > 500)) {
    errors.push('reason must be a string under 500 characters');
  }
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

module.exports = {
  AGENT_CATEGORIES,
  WISH_CATEGORIES,
  STAMP_TIERS,
  STAMP_EVENT_OUTCOMES,
  TOMBSTONE_OUTCOMES,
  sanitize,
  validateWalletAddress,
  validateStampMint,
  validateAgentRegister,
  validateWish,
  validateStampEvent,
  validateTombstone,
};
