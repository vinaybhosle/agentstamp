const express = require('express');
const router = express.Router();
const { getDb, cleanupExpired, resolvePrimaryWallet } = require('../database');
const { signCertificate, verifyCertificate, getPublicKey } = require('../crypto');
const { generateStampId, generateTransactionId, generateStampEventId } = require('../utils/generateId');
const { validateStampMint, validateStampEvent, validateTombstone, validateBlindRegister } = require('../utils/validators');
const { appendEvent } = require('../eventLog');
const { getAllLinkedWallets } = require('../database');
const crypto = require('crypto');

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

// POST /api/v1/stamp/mint/free — Free 7-day stamp (no x402 payment required)
router.post('/mint/free', (req, res) => {
  try {
    const walletAddress = req.headers['x-wallet-address'] || req.body.wallet_address;
    if (!walletAddress || walletAddress === '0x0000000000000000000000000000000000000000') {
      return res.status(400).json({ success: false, error: 'wallet_address is required for free stamps' });
    }

    const db = getDb();

    // Resolve to primary wallet for cooldown checks (prevents bypass via linked wallets)
    const resolvedWallet = resolvePrimaryWallet(walletAddress);

    // Rate limit: 1 free stamp per wallet per 7 days (checked against primary)
    const cooldown = db.prepare('SELECT last_free_mint FROM free_stamp_cooldown WHERE wallet_address = ?').get(resolvedWallet);
    if (cooldown) {
      const lastMint = new Date(cooldown.last_free_mint);
      const daysSince = (Date.now() - lastMint.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) {
        const nextAvailable = new Date(lastMint.getTime() + 7 * 24 * 60 * 60 * 1000);
        return res.status(429).json({
          success: false,
          error: 'Free stamp cooldown active. One free stamp per wallet per 7 days.',
          next_available: nextAvailable.toISOString(),
        });
      }
    }

    const stampId = generateStampId();
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const certificate = {
      version: '1.0',
      issuer: 'AgentStamp',
      subject: walletAddress,
      tier: 'free',
      paid: false,
      claim: `This certifies that ${walletAddress} has been stamped as a verified AI agent identity at the free tier.`,
      issued_at: issuedAt,
      expires_at: expiresAt,
      stamp_id: stampId,
    };

    const signature = signCertificate(certificate);

    db.prepare(`
      INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(stampId, walletAddress, 'free', issuedAt, expiresAt, JSON.stringify(certificate), signature);

    // Write cooldown under both the resolved primary AND the actual wallet
    db.prepare(`
      INSERT OR REPLACE INTO free_stamp_cooldown (wallet_address, last_free_mint)
      VALUES (?, ?)
    `).run(resolvedWallet, issuedAt);
    if (resolvedWallet !== walletAddress) {
      db.prepare(`
        INSERT OR REPLACE INTO free_stamp_cooldown (wallet_address, last_free_mint)
        VALUES (?, ?)
      `).run(walletAddress, issuedAt);
    }

    db.prepare(`
      INSERT INTO transactions (id, endpoint, wallet_address, amount, action, reference_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(generateTransactionId(), '/api/v1/stamp/mint/free', walletAddress, '0', 'free_mint', stampId);

    appendEvent('stamp_minted', { stamp_id: stampId, wallet_address: walletAddress, tier: 'free' });

    // Dispatch webhook
    try { require('../webhookDispatcher').dispatch(walletAddress, 'stamp_minted', { stamp_id: stampId, tier: 'free' }); } catch (e) { /* best-effort */ }

    res.status(201).json({
      success: true,
      stamp: {
        id: stampId,
        tier: 'free',
        wallet_address: walletAddress,
        issued_at: issuedAt,
        expires_at: expiresAt,
        certificate,
        signature,
        verify_url: `/api/v1/stamp/verify/${stampId}`,
      },
      upgrade_info: {
        message: 'Upgrade to a paid tier for longer validity and higher reputation score.',
        tiers: {
          bronze: { price: '$0.001', validity: '24h' },
          silver: { price: '$0.005', validity: '7 days' },
          gold: { price: '$0.01', validity: '30 days' },
        },
      },
    });
  } catch (err) {
    console.error('Free stamp mint error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

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

    const walletAddress = req.headers['x-wallet-address'] || req.body.wallet_address;
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

    appendEvent('stamp_minted', { stamp_id: stampId, wallet_address: walletAddress, tier });

    // Dispatch webhook
    try { require('../webhookDispatcher').dispatch(walletAddress, 'stamp_minted', { stamp_id: stampId, tier }); } catch (e) { /* best-effort */ }

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
      return res.status(404).json({
        success: false,
        error: 'Certificate not found',
        message: 'This certificate ID does not exist in the AgentStamp registry. The agent may be unverified.',
        action: {
          register: 'https://agentstamp.org/register',
          docs: 'https://agentstamp.org/docs',
          message: 'If you are an agent without a stamp, register for free in 60 seconds to get verified.',
        },
      });
    }

    const certificate = JSON.parse(stamp.certificate);
    const isValid = verifyCertificate(certificate, stamp.signature);
    const isExpired = new Date(stamp.expires_at) < new Date();

    const active = !isExpired && !stamp.revoked && !stamp.outcome;

    res.json({
      success: true,
      valid: isValid && !isExpired && !stamp.revoked,
      expired: isExpired,
      revoked: !!stamp.revoked,
      active,
      outcome: stamp.outcome || null,
      tombstoned_at: stamp.tombstoned_at || null,
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

// POST /api/v1/stamp/event — Record a stamp verification event
router.post('/event', (req, res) => {
  try {
    // Authentication: require x-wallet-address header and verify it matches body
    const callerWallet = req.headers['x-wallet-address'];
    if (!callerWallet) {
      return res.status(401).json({ success: false, error: 'x-wallet-address header required' });
    }
    const resolvedCaller = resolvePrimaryWallet(callerWallet);
    const resolvedBody = resolvePrimaryWallet(req.body.wallet_address);
    if (resolvedCaller !== resolvedBody) {
      return res.status(403).json({ success: false, error: 'Wallet mismatch: caller does not match event wallet' });
    }

    const validation = validateStampEvent(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }

    const db = getDb();
    const eventId = generateStampEventId();
    const now = new Date().toISOString();
    const metadata = req.body.metadata ? JSON.stringify(req.body.metadata) : null;

    db.prepare(`
      INSERT INTO stamp_events (id, stamp_id, agent_id, wallet_address, action, outcome, gate_reason, endpoint, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      req.body.stamp_id || null,
      req.body.agent_id || null,
      req.body.wallet_address,
      req.body.action,
      req.body.outcome,
      req.body.gate_reason || null,
      req.body.endpoint || null,
      metadata,
      now
    );

    appendEvent('stamp_event', { stamp_id: req.body.stamp_id, agent_id: req.body.agent_id, wallet_address: req.body.wallet_address, action: req.body.action, outcome: req.body.outcome });

    res.status(201).json({
      success: true,
      event_id: eventId,
      recorded_at: now,
    });
  } catch (err) {
    console.error('Stamp event recording error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/stamp/:stampId/tombstone — Close a stamp's lifecycle
router.post('/:stampId/tombstone', (req, res) => {
  try {
    const validation = validateTombstone(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }

    const db = getDb();
    const stamp = db.prepare('SELECT * FROM stamps WHERE id = ?').get(req.params.stampId);

    if (!stamp) {
      return res.status(404).json({ success: false, error: 'Stamp not found' });
    }

    // Ownership check: caller must be the stamp owner (or a linked wallet)
    const callerWallet = req.headers['x-wallet-address'] || req.body.wallet_address;
    if (!callerWallet) {
      return res.status(401).json({ success: false, error: 'Wallet address required for authentication' });
    }
    const resolvedCaller = resolvePrimaryWallet(callerWallet);
    const resolvedOwner = resolvePrimaryWallet(stamp.wallet_address);
    if (resolvedCaller !== resolvedOwner) {
      return res.status(403).json({ success: false, error: 'Not authorized to tombstone this stamp' });
    }

    if (stamp.outcome || stamp.revoked) {
      return res.status(409).json({
        success: false,
        error: 'Stamp is already tombstoned or revoked',
        outcome: stamp.outcome || null,
        tombstoned_at: stamp.tombstoned_at || null,
      });
    }

    const result = db.prepare(
      "UPDATE stamps SET outcome = ?, tombstoned_at = datetime('now') WHERE id = ? AND outcome IS NULL AND revoked = 0"
    ).run(req.body.outcome, req.params.stampId);

    if (result.changes === 0) {
      return res.status(409).json({ success: false, error: 'Stamp could not be tombstoned (concurrent update)' });
    }

    const updated = db.prepare('SELECT tombstoned_at FROM stamps WHERE id = ?').get(req.params.stampId);

    appendEvent('stamp_tombstoned', { stamp_id: req.params.stampId, wallet_address: stamp.wallet_address, outcome: req.body.outcome });

    try {
      require('../webhookDispatcher').dispatch(stamp.wallet_address, 'stamp_tombstoned', {
        stamp_id: stamp.id,
        outcome: req.body.outcome,
        reason: req.body.reason || null,
      });
    } catch (e) { /* best-effort */ }

    res.json({
      success: true,
      stamp_id: stamp.id,
      outcome: req.body.outcome,
      tombstoned_at: updated.tombstoned_at,
    });
  } catch (err) {
    console.error('Stamp tombstone error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/stamp/blind-register — Register a blind verification token
router.post('/blind-register', (req, res) => {
  try {
    const validation = validateBlindRegister(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    // Auth: require x-wallet-address header matching body
    const callerWallet = req.headers['x-wallet-address'];
    if (!callerWallet) {
      return res.status(401).json({ success: false, error: 'x-wallet-address header required' });
    }

    // Validate header wallet format before comparing
    const { validateWalletAddress } = require('../utils/validators');
    const headerCheck = validateWalletAddress(callerWallet);
    if (!headerCheck.valid) {
      return res.status(400).json({ success: false, error: 'Invalid x-wallet-address header format' });
    }

    const resolvedCaller = resolvePrimaryWallet(callerWallet);
    const resolvedBody = resolvePrimaryWallet(req.body.wallet_address);
    if (resolvedCaller !== resolvedBody) {
      return res.status(403).json({ success: false, error: 'Wallet mismatch' });
    }

    const blindSecret = process.env.BLIND_TOKEN_SECRET;
    if (!blindSecret) {
      console.warn('WARNING: BLIND_TOKEN_SECRET is not set. Using fallback constant. Set this env var in production.');
    }
    const hmacKey = blindSecret || 'agentstamp-dev-blind-token-fallback';
    const token = crypto.createHmac('sha256', hmacKey)
      .update(req.body.wallet_address + req.body.nonce)
      .digest('hex');

    const db = getDb();

    // Check if token already exists to distinguish create vs replace
    const existing = db.prepare('SELECT token FROM blind_tokens WHERE token = ?').get(token);

    db.prepare(
      "INSERT OR REPLACE INTO blind_tokens (token, wallet_address, created_at) VALUES (?, ?, datetime('now'))"
    ).run(token, req.body.wallet_address);

    const statusCode = existing ? 200 : 201;
    res.status(statusCode).json({ success: true, token });
  } catch (err) {
    console.error('Blind register error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/stamp/verify-blind/:blindToken — Verify stamp via blind token (privacy-preserving)
router.get('/verify-blind/:blindToken', (req, res) => {
  try {
    const db = getDb();
    const tokenRow = db.prepare('SELECT * FROM blind_tokens WHERE token = ?').get(req.params.blindToken);
    if (!tokenRow) {
      return res.status(404).json({ success: false, error: 'Token not found' });
    }

    const wallet = tokenRow.wallet_address;

    // Look up stamps for this wallet (use resolvePrimaryWallet + getAllLinkedWallets)
    const primary = resolvePrimaryWallet(wallet);
    const allWallets = getAllLinkedWallets(primary);
    const walletList = allWallets.all || [primary];

    // Find best active stamp across all wallets
    const placeholders = walletList.map(() => '?').join(',');
    const stamp = db.prepare(
      `SELECT * FROM stamps WHERE wallet_address IN (${placeholders}) AND revoked = 0 AND expires_at > datetime('now') ORDER BY CASE tier WHEN 'gold' THEN 4 WHEN 'silver' THEN 3 WHEN 'bronze' THEN 2 ELSE 1 END DESC LIMIT 1`
    ).get(...walletList);

    // Get agent
    const agent = db.prepare(
      `SELECT * FROM agents WHERE wallet_address IN (${placeholders}) AND status = 'active' LIMIT 1`
    ).get(...walletList);

    // Compute reputation if agent exists
    let reputationLabel = 'new';
    let scoreRange = '0-25';
    if (agent) {
      const { computeReputation, getLabel: getRepLabel, getScoreRange } = require('../reputation');
      const rep = computeReputation(agent.id);
      if (rep) {
        reputationLabel = rep.label;
        scoreRange = getScoreRange(rep.score);
      }
    }

    // Log blind verification event (internal audit — wallet IS logged in event_log)
    appendEvent('blind_verified', { wallet_address: wallet, token: req.params.blindToken });

    // Return stripped response — NO wallet, NO exact score, NO stamp_id
    res.json({
      success: true,
      valid: !!stamp,
      tier: stamp ? stamp.tier : null,
      reputation_label: reputationLabel,
      score_range: scoreRange,
    });
  } catch (err) {
    console.error('Blind verify error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
