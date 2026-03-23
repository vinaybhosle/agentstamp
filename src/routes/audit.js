const express = require('express');
const router = express.Router();
const { getDb, resolvePrimaryWallet } = require('../database');
const { STAMP_EVENT_OUTCOMES, validateWalletAddress } = require('../utils/validators');
const { timingSafeCompare } = require('../utils/timingSafeCompare');
const { requireSignature } = require('../middleware/walletSignature');

// Middleware: require wallet-based auth (with signature) or admin key for audit endpoints
// Without signature verification, anyone who knows a wallet address could query its audit trail.
// Wallet addresses are public (leaderboards, profiles), so header-only auth is insufficient.
function requireWalletOrAdmin(req, res, next) {
  const adminKey = process.env.ADMIN_KEY;
  if (adminKey && req.headers['x-admin-key'] && timingSafeCompare(req.headers['x-admin-key'], adminKey, adminKey)) {
    req.isAdmin = true;
    return next();
  }
  // For non-admin callers, require wallet signature to prove ownership
  requireSignature({ required: true, action: 'audit_read' })(req, res, (err) => {
    if (err) return next(err);
    const wallet = req.headers['x-wallet-address'];
    if (!wallet) {
      return res.status(401).json({ success: false, error: 'x-wallet-address header with valid signature or x-admin-key required' });
    }
    req.scopedWallet = resolvePrimaryWallet(wallet);
    next();
  });
}

// Helper: validate ISO8601 date query params
function validateDateParams(req, res) {
  if (req.query.since && isNaN(Date.parse(req.query.since))) {
    res.status(400).json({ success: false, error: 'since must be a valid ISO8601 date' });
    return false;
  }
  if (req.query.until && isNaN(Date.parse(req.query.until))) {
    res.status(400).json({ success: false, error: 'until must be a valid ISO8601 date' });
    return false;
  }
  return true;
}

// GET /api/v1/audit/events — Query stamp verification events
router.get('/events', requireWalletOrAdmin, (req, res) => {
  try {
    const db = getDb();

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    if (!validateDateParams(req, res)) return;

    const conditions = [];
    const params = [];

    // Scope to caller's wallet unless admin
    if (req.scopedWallet) {
      conditions.push('wallet_address = ?');
      params.push(req.scopedWallet);
    } else if (req.query.wallet_address) {
      const walletCheck = validateWalletAddress(req.query.wallet_address);
      if (!walletCheck.valid) {
        return res.status(400).json({ success: false, error: 'Invalid wallet_address query parameter' });
      }
      conditions.push('wallet_address = ?');
      params.push(req.query.wallet_address);
    }

    if (req.query.stamp_id) {
      conditions.push('stamp_id = ?');
      params.push(req.query.stamp_id);
    }

    if (req.query.outcome && STAMP_EVENT_OUTCOMES.includes(req.query.outcome)) {
      conditions.push('outcome = ?');
      params.push(req.query.outcome);
    }

    if (req.query.since) {
      conditions.push('created_at >= ?');
      params.push(req.query.since);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const total = db.prepare(
      `SELECT COUNT(*) as count FROM stamp_events ${whereClause}`
    ).get(...params).count;

    const events = db.prepare(
      `SELECT * FROM stamp_events ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    const parsedEvents = events.map(e => ({
      ...e,
      metadata: e.metadata ? JSON.parse(e.metadata) : null,
    }));

    res.json({
      success: true,
      events: parsedEvents,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error('Audit events query error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/audit/execution — Only positive/execution events from event_log
router.get('/execution', requireWalletOrAdmin, (req, res) => {
  try {
    if (!validateDateParams(req, res)) return;

    const { queryEvents, EXECUTION_EVENTS } = require('../eventLog');
    const filters = {
      event_types: EXECUTION_EVENTS,
      stamp_id: req.query.stamp_id,
      agent_id: req.query.agent_id,
      wallet_address: req.scopedWallet || (() => {
        if (req.query.wallet_address) {
          const check = validateWalletAddress(req.query.wallet_address);
          return check.valid ? req.query.wallet_address : undefined;
        }
        return undefined;
      })(),
      since: req.query.since,
      until: req.query.until,
      limit: parseInt(req.query.limit, 10) || 50,
      offset: parseInt(req.query.offset, 10) || 0,
    };
    const result = queryEvents(filters);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Audit execution query error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/audit/compliance — Full event_log (all event types)
router.get('/compliance', requireWalletOrAdmin, (req, res) => {
  try {
    if (!validateDateParams(req, res)) return;

    const { queryEvents } = require('../eventLog');
    const filters = {
      stamp_id: req.query.stamp_id,
      agent_id: req.query.agent_id,
      wallet_address: req.scopedWallet || (() => {
        if (req.query.wallet_address) {
          const check = validateWalletAddress(req.query.wallet_address);
          return check.valid ? req.query.wallet_address : undefined;
        }
        return undefined;
      })(),
      since: req.query.since,
      until: req.query.until,
      limit: parseInt(req.query.limit, 10) || 50,
      offset: parseInt(req.query.offset, 10) || 0,
    };
    const result = queryEvents(filters);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Audit compliance query error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/audit/verify-chain — Full hash chain verification (auth required)
router.get('/verify-chain', requireWalletOrAdmin, (req, res) => {
  try {
    const db = getDb();
    const { verifyChain } = require('../hashChain');
    const limit = Math.min(parseInt(req.query.limit, 10) || 10000, 10000);
    const result = verifyChain(db, { limit });
    res.json({
      success: true,
      ...result,
      verified_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Chain verification error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/audit/chain-status — Quick chain health check (auth required)
router.get('/chain-status', requireWalletOrAdmin, (req, res) => {
  try {
    const db = getDb();

    const total = db.prepare(
      'SELECT COUNT(*) as count FROM event_log'
    ).get().count;
    const hashed = db.prepare(
      'SELECT COUNT(*) as count FROM event_log WHERE event_hash IS NOT NULL'
    ).get().count;
    const latest = db.prepare(
      'SELECT id, event_type, event_hash, created_at FROM event_log WHERE event_hash IS NOT NULL ORDER BY rowid DESC LIMIT 1'
    ).get();
    const first = db.prepare(
      'SELECT prev_hash FROM event_log WHERE event_hash IS NOT NULL ORDER BY rowid ASC LIMIT 1'
    ).get();

    res.json({
      success: true,
      chain_length: hashed,
      total_events: total,
      head_hash: latest ? latest.event_hash : null,
      latest_event_id: latest ? latest.id : null,
      latest_event_type: latest ? latest.event_type : null,
      latest_timestamp: latest ? latest.created_at : null,
      genesis_intact: first ? first.prev_hash === '0' : true,
    });
  } catch (err) {
    console.error('Chain status error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
