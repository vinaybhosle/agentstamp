/**
 * AgentStamp Express Middleware
 *
 * Provides requireStamp() middleware for Express applications.
 * Verifies that incoming requests are from trusted AI agents.
 */

const { verifyAgent } = require('./index');

// Simple in-memory TTL cache
const cache = new Map();

function getCached(key, ttlSeconds) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlSeconds * 1000) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value) {
  // Cap cache size to prevent memory leaks
  if (cache.size > 10000) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, { value, timestamp: Date.now() });
}

/**
 * Create Express middleware that verifies agent trust stamps.
 *
 * @param {object} [options]
 * @param {string} [options.minTier='bronze'] - Minimum trust tier required
 * @param {number} [options.cacheTTL=300] - Cache TTL in seconds (default 5 min)
 * @param {boolean} [options.failOpen=false] - If true, allow requests when verification fails
 * @param {string} [options.apiUrl] - AgentStamp API base URL
 * @param {string} [options.walletHeader='x-wallet-address'] - Header containing wallet address
 * @returns {function} Express middleware
 */
function requireStamp(options = {}) {
  const {
    minTier = 'bronze',
    cacheTTL = 300,
    failOpen = false,
    apiUrl,
    walletHeader = 'x-wallet-address',
  } = options;

  return async function stampMiddleware(req, res, next) {
    const wallet = req.header(walletHeader);

    if (!wallet) {
      if (failOpen) return next();
      return res.status(401).json({
        error: 'Missing agent wallet address',
        message: `Provide your wallet address in the ${walletHeader} header`,
        docs: 'https://agentstamp.org/docs',
      });
    }

    try {
      // Check cache first
      const cacheKey = `${wallet}:${minTier}`;
      let result = getCached(cacheKey, cacheTTL);

      if (!result) {
        result = await verifyAgent(wallet, minTier, { apiUrl });
        setCache(cacheKey, result);
      }

      if (!result.verified) {
        if (failOpen) return next();
        return res.status(403).json({
          error: 'Insufficient trust level',
          message: `Agent requires ${minTier} tier or above. Current: ${result.tier}`,
          score: result.score,
          tier: result.tier,
          register: 'https://agentstamp.org',
        });
      }

      // Attach verified agent info to request
      req.verifiedAgent = {
        wallet,
        tier: result.tier,
        score: result.score,
        trusted: result.trusted,
        agent: result.agent,
      };

      next();
    } catch (err) {
      if (failOpen) {
        // Log but don't block
        if (process.env.NODE_ENV !== 'test') {
          console.warn('[agentstamp-verify] Trust check failed, failing open:', err.message);
        }
        return next();
      }
      return res.status(503).json({
        error: 'Trust verification unavailable',
        message: 'Unable to verify agent trust. Please try again.',
      });
    }
  };
}

module.exports = { requireStamp };
