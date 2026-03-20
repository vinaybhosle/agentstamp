const express = require('express');
const router = express.Router();
const { getDb, resolvePrimaryWallet } = require('../database');
const { generateWishId, generateTransactionId } = require('../utils/generateId');
const { validateWish } = require('../utils/validators');
const { generateInsights } = require('../insights');
const { appendEvent } = require('../eventLog');
const { requireSignature } = require('../middleware/walletSignature');

// POST /api/v1/well/wish
router.post('/wish', requireSignature({ required: false, action: 'wish' }), (req, res) => {
  try {
    const validation = validateWish(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const walletAddress = req.headers['x-wallet-address'] || req.body.wallet_address;
    const { wish_text, category, agent_id } = validation.data;

    const db = getDb();

    if (agent_id) {
      const agent = db.prepare('SELECT id FROM agents WHERE id = ?').get(agent_id);
      if (!agent) {
        return res.status(400).json({ success: false, error: 'Referenced agent_id does not exist' });
      }
    }

    const wishId = generateWishId();
    db.prepare(`
      INSERT INTO wishes (id, wallet_address, agent_id, wish_text, category)
      VALUES (?, ?, ?, ?, ?)
    `).run(wishId, walletAddress, agent_id, wish_text, category);

    db.prepare(`
      INSERT INTO transactions (id, endpoint, wallet_address, amount, action, reference_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(generateTransactionId(), '/api/v1/well/wish', walletAddress, '$0.001', 'wish_create', wishId);

    appendEvent('wish_created', { wish_id: wishId, wallet_address: walletAddress, category });

    res.status(201).json({
      success: true,
      wish: {
        id: wishId,
        wish_text,
        category,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Well wish error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/well/grant/:wishId
router.post('/grant/:wishId', requireSignature({ required: false, action: 'grant' }), (req, res) => {
  try {
    const db = getDb();
    const wish = db.prepare('SELECT * FROM wishes WHERE id = ?').get(req.params.wishId);
    if (!wish) {
      return res.status(404).json({ success: false, error: 'Wish not found' });
    }

    const granterWallet = req.headers['x-wallet-address'] || req.body.wallet_address;

    // Prevent self-granting: resolve both wallets to primary before comparing
    if (granterWallet && wish.wallet_address) {
      const resolvedGranter = resolvePrimaryWallet(granterWallet);
      const resolvedWisher = resolvePrimaryWallet(wish.wallet_address);
      if (resolvedGranter === resolvedWisher) {
        return res.status(400).json({ success: false, error: 'Cannot grant your own wish' });
      }
    }

    // Check if this wallet already granted this wish
    const existingGrant = db.prepare(
      "SELECT id FROM transactions WHERE wallet_address = ? AND type = 'wish_grant' AND metadata LIKE ?"
    ).get(granterWallet, `%${req.params.wishId}%`);
    if (existingGrant) {
      return res.status(409).json({ success: false, error: 'You have already granted this wish' });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE wishes SET granted = 1, granted_by = ?, granted_at = ?, grant_count = grant_count + 1 WHERE id = ?
    `).run(granterWallet, now, req.params.wishId);

    db.prepare(`
      INSERT INTO transactions (id, endpoint, wallet_address, amount, action, reference_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(generateTransactionId(), '/api/v1/well/grant', granterWallet, '$0.005', 'wish_grant', req.params.wishId);

    appendEvent('wish_granted', { wish_id: req.params.wishId, granted_by: granterWallet });

    // Dispatch webhook to wish owner
    try { require('../webhookDispatcher').dispatch(wish.wallet_address, 'wish_granted', { wish_id: req.params.wishId, granter: granterWallet }); } catch (e) { /* best-effort */ }

    const updated = db.prepare('SELECT grant_count FROM wishes WHERE id = ?').get(req.params.wishId);
    res.json({ success: true, message: 'Wish granted', wish_id: req.params.wishId, grant_count: updated.grant_count });
  } catch (err) {
    console.error('Well grant error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/well/wishes
router.get('/wishes', (req, res) => {
  try {
    const db = getDb();
    const category = req.query.category;
    const sort = req.query.sort || 'newest';
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    let sql = 'SELECT * FROM wishes WHERE 1=1';
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    const sortMap = {
      newest: 'created_at DESC',
      most_granted: 'grant_count DESC',
      oldest: 'created_at ASC',
    };
    sql += ` ORDER BY ${sortMap[sort] || sortMap.newest} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const wishes = db.prepare(sql).all(...params);
    res.json({ success: true, wishes, limit, offset });
  } catch (err) {
    console.error('Well wishes error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/well/wish/:wishId
router.get('/wish/:wishId', (req, res) => {
  try {
    const db = getDb();
    const wish = db.prepare('SELECT * FROM wishes WHERE id = ?').get(req.params.wishId);
    if (!wish) {
      return res.status(404).json({ success: false, error: 'Wish not found' });
    }

    const grants = db.prepare("SELECT wallet_address, amount, created_at FROM transactions WHERE reference_id = ? AND action = 'wish_grant' ORDER BY created_at DESC").all(req.params.wishId);

    res.json({ success: true, wish, grants });
  } catch (err) {
    console.error('Well wish detail error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/well/trending
router.get('/trending', (req, res) => {
  try {
    const db = getDb();

    const topCategories = db.prepare('SELECT category, COUNT(*) as count FROM wishes GROUP BY category ORDER BY count DESC').all();
    const thisWeek = db.prepare("SELECT COUNT(*) as count FROM wishes WHERE created_at >= date('now', '-7 days')").get().count;
    const today = db.prepare("SELECT COUNT(*) as count FROM wishes WHERE created_at >= date('now')").get().count;

    res.json({
      success: true,
      trending: {
        top_categories: topCategories,
        wishes_today: today,
        wishes_this_week: thisWeek,
      },
    });
  } catch (err) {
    console.error('Well trending error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/well/stats
router.get('/stats', (req, res) => {
  try {
    const db = getDb();

    const totalWishes = db.prepare('SELECT COUNT(*) as count FROM wishes').get().count;
    const totalGrants = db.prepare('SELECT SUM(grant_count) as total FROM wishes').get().total || 0;
    const byCategory = db.prepare('SELECT category, COUNT(*) as count FROM wishes GROUP BY category').all();
    const today = db.prepare("SELECT COUNT(*) as count FROM wishes WHERE created_at >= date('now')").get().count;
    const thisWeek = db.prepare("SELECT COUNT(*) as count FROM wishes WHERE created_at >= date('now', '-7 days')").get().count;

    res.json({
      success: true,
      stats: {
        total_wishes: totalWishes,
        total_grants: totalGrants,
        by_category: byCategory.reduce((acc, r) => { acc[r.category] = r.count; return acc; }, {}),
        today,
        this_week: thisWeek,
      },
    });
  } catch (err) {
    console.error('Well stats error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/well/insights (paid via x402 — full market intelligence)
router.get('/insights', (req, res) => {
  try {
    const insights = generateInsights();
    res.json({ success: true, ...insights });
  } catch (err) {
    console.error('Well insights error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/well/insights/preview (free — summary for web dashboard)
router.get('/insights/preview', (req, res) => {
  try {
    const insights = generateInsights();
    // Return summary + category data (no keywords/unmet needs — those are paid)
    res.json({
      success: true,
      generated_at: insights.generated_at,
      summary: insights.summary,
      growth: insights.growth,
      velocity: insights.velocity,
      category_distribution: insights.category_distribution,
      // Teaser: truncated unmet needs and keywords
      unmet_needs: insights.unmet_needs.slice(0, 3).map(w => ({
        ...w,
        wish_text: w.wish_text.slice(0, 60) + (w.wish_text.length > 60 ? '...' : ''),
      })),
      emerging_keywords: insights.emerging_keywords.slice(0, 5),
    });
  } catch (err) {
    console.error('Well insights preview error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
