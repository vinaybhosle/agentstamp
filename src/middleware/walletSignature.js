const { verifyWalletSignature, buildSignatureMessage, hashRequestBody, TIMESTAMP_WINDOW_SECONDS } = require('../walletAuth');

// Track legacy signature usage for deprecation monitoring
let _legacySignatureCount = 0;
function getLegacySignatureCount() { return _legacySignatureCount; }

function requireSignature(options = {}) {
  const { required = false, action = 'unknown' } = options;

  return (req, res, next) => {
    const walletAddress = req.headers['x-wallet-address'] || req.body?.wallet_address;
    const signature = req.headers['x-wallet-signature'];
    const timestamp = req.headers['x-wallet-timestamp'];

    // No signature provided
    if (!signature || !timestamp) {
      if (required) {
        return res.status(401).json({
          success: false,
          error: 'Wallet signature required. Send x-wallet-signature and x-wallet-timestamp headers.',
        });
      }
      req.walletVerified = false;
      req.walletSignatureInfo = null;
      return next();
    }

    // Validate timestamp
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts)) {
      return res.status(401).json({ success: false, error: 'Invalid signature timestamp' });
    }
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > TIMESTAMP_WINDOW_SECONDS) {
      return res.status(401).json({
        success: false,
        error: `Signature timestamp expired. Must be within ${TIMESTAMP_WINDOW_SECONDS} seconds.`,
      });
    }

    // Verify signature
    if (!walletAddress) {
      return res.status(401).json({ success: false, error: 'Wallet address required for signature verification' });
    }

    // Bind signature to request body hash for mutation requests (prevents payload tampering)
    const bodyHash = (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE')
      ? hashRequestBody(req.body)
      : null;

    // Try body-bound message first, then fall back to legacy format for backward compat
    const message = buildSignatureMessage(action, timestamp, bodyHash);
    let result = verifyWalletSignature(message, signature, walletAddress);

    // Backward compatibility: if body-bound verification fails, try without body hash
    // DEPRECATED: Legacy fallback will be removed after 2026-04-22. SDK users must include body hash.
    let legacyMode = false;
    if (!result.valid && bodyHash) {
      const legacyMessage = buildSignatureMessage(action, timestamp);
      result = verifyWalletSignature(legacyMessage, signature, walletAddress);
      if (result.valid) {
        legacyMode = true;
        _legacySignatureCount++;
        console.warn(`DEPRECATION: Signature accepted without body hash from wallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} — action: ${action} (total: ${_legacySignatureCount})`);
        res.setHeader('X-AgentStamp-Deprecation', 'body-hash-required-after-2026-04-22');
      }
    }

    if (!result.valid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid wallet signature',
      });
    }

    req.walletVerified = true;
    req.walletSignatureInfo = Object.freeze({
      chain: result.chain,
      timestamp: ts,
      verified: true,
      legacyMode,
    });

    // Mark wallet as verified in DB (first time only, best-effort)
    try {
      const { getDb } = require('../database');
      const db = getDb();
      if (db) {
        db.prepare(
          "UPDATE agents SET wallet_verified = 1 WHERE wallet_address = ? AND wallet_verified = 0 AND status = 'active'"
        ).run(walletAddress);
      }
    } catch (e) { /* best-effort */ }

    next();
  };
}

module.exports = { requireSignature, getLegacySignatureCount };
