const express = require('express');
const router = express.Router();
const { getDb, cleanupExpired } = require('../database');
const { signCertificate, verifyCertificate, getPublicKey } = require('../crypto');
const { generateStampId, generateTransactionId } = require('../utils/generateId');
const { validateStampMint } = require('../utils/validators');

const TIER_CONFIG = {
  bronze: { price: '$0.001', validityHours: 24 },
  silver: { price: '$0.005', validityDays: 7 },
  gold: { price: '$0.01', validityDays: 30 },
};

function getExpiresAt(tier) {
  const now = new Date();
  if (tier === 'bronze') {
    now.setHours(now.getHours() + 24);
  } else if (tier === 'silver') {
    now.setDate(now.getDate() + 7);
  } else {
    now.setDate(now.getDate() + 30);
  }
  return now.toISOString();
}

// POST /api/v1/stamp/mint/:tier
router.post('/mint/:tier', (req, res) => {
  try {
    const { tier } = req.params;
    if (!TIER_CONFIG[tier]) {
      return res.status(400).json({ success: false, error: 'Invalid tier. Must be bronze, silver, or gold.' });
    }

    const validation = validateStampMint(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const walletAddress = req.headers['x-wallet-address'] || req.body.wallet_address || '0x0000000000000000000000000000000000000000';
    const stampId = generateStampId();
    const issuedAt = new Date().toISOString();
    const expiresAt = getExpiresAt(tier);

    const certificate = {
      version: '1.0',
      issuer: 'AgentStamp',
      subject: walletAddress,
      tier,
      claim: `This certifies that ${walletAddress} has been stamped as a verified AI agent identity at the ${tier} tier.`,
      issued_at: issuedAt,
      expires_at: expiresAt,
      stamp_id: stampId,
    };

    const signature = signCertificate(certificate);

    const db = getDb();
    db.prepare(`
      INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(stampId, walletAddress, tier, issuedAt, expiresAt, JSON.stringify(certificate), signature);

    db.prepare(`
      INSERT INTO transactions (id, endpoint, wallet_address, amount, action, reference_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(generateTransactionId(), `/api/v1/stamp/mint/${tier}`, walletAddress, TIER_CONFIG[tier].price, 'stamp_mint', stampId);

    res.status(201).json({
      success: true,
      stamp: {
        id: stampId,
        tier,
        wallet_address: walletAddress,
        issued_at: issuedAt,
        expires_at: expiresAt,
        certificate,
        signature,
        verify_url: `/api/v1/stamp/verify/${stampId}`,
      },
    });
  } catch (err) {
    console.error('Stamp mint error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/stamp/verify/:certId
router.get('/verify/:certId', (req, res) => {
  try {
    const db = getDb();
    const stamp = db.prepare('SELECT * FROM stamps WHERE id = ?').get(req.params.certId);

    if (!stamp) {
      return res.status(404).json({ success: false, error: 'Certificate not found' });
    }

    const certificate = JSON.parse(stamp.certificate);
    const isValid = verifyCertificate(certificate, stamp.signature);
    const isExpired = new Date(stamp.expires_at) < new Date();

    res.json({
      success: true,
      valid: isValid && !isExpired && !stamp.revoked,
      expired: isExpired,
      revoked: !!stamp.revoked,
      stamp: {
        id: stamp.id,
        tier: stamp.tier,
        wallet_address: stamp.wallet_address,
        issued_at: stamp.issued_at,
        expires_at: stamp.expires_at,
        certificate,
      },
      public_key: getPublicKey(),
    });
  } catch (err) {
    console.error('Stamp verify error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/stamp/stats
router.get('/stats', (req, res) => {
  try {
    cleanupExpired();
    const db = getDb();

    const total = db.prepare('SELECT COUNT(*) as count FROM stamps').get().count;
    const active = db.prepare("SELECT COUNT(*) as count FROM stamps WHERE revoked = 0 AND expires_at > datetime('now')").get().count;
    const byTier = db.prepare('SELECT tier, COUNT(*) as count FROM stamps GROUP BY tier').all();
    const today = db.prepare("SELECT COUNT(*) as count FROM stamps WHERE created_at >= date('now')").get().count;
    const thisWeek = db.prepare("SELECT COUNT(*) as count FROM stamps WHERE created_at >= date('now', '-7 days')").get().count;

    res.json({
      success: true,
      stats: {
        total_issued: total,
        active: active,
        by_tier: byTier.reduce((acc, r) => { acc[r.tier] = r.count; return acc; }, {}),
        today: today,
        this_week: thisWeek,
      },
    });
  } catch (err) {
    console.error('Stamp stats error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
