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
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { valid: false, error: 'Invalid wallet address format (expected 0x + 40 hex chars)' };
  }
  return { valid: true, error: null };
}

function validateStampMint(body) {
  const agentName = sanitize(body.agent_name || '');
  if (agentName.length > 100) {
    return { valid: false, error: 'agent_name must be 100 characters or less' };
  }
  return { valid: true, error: null, data: { agent_name: agentName, metadata: body.metadata || {} } };
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
      capabilities: Array.isArray(body.capabilities) ? body.capabilities : [],
      protocols: Array.isArray(body.protocols) ? body.protocols : [],
      endpoint_url: sanitize(body.endpoint_url || ''),
      stamp_id: body.stamp_id || null,
      metadata: body.metadata || {},
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

module.exports = {
  AGENT_CATEGORIES,
  WISH_CATEGORIES,
  STAMP_TIERS,
  sanitize,
  validateWalletAddress,
  validateStampMint,
  validateAgentRegister,
  validateWish,
};
