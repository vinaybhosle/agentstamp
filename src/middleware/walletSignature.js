const { verifyWalletSignature, buildSignatureMessage, TIMESTAMP_WINDOW_SECONDS } = require('../walletAuth');

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

    const message = buildSignatureMessage(action, timestamp);
    const result = verifyWalletSignature(message, signature, walletAddress);

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

module.exports = { requireSignature };
