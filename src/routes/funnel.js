'use strict';

const express = require('express');
const router = express.Router();
const { sanitize } = require('../utils/validators');

// ─── Constants ───────────────────────────────────────────────────────────────

const ALLOWED_EVENTS = [
  'register_view',
  'free_mint_success',
  'upgrade_card_view',
  'pay_click',
  'paid_mint_success',
  'pay_error',
];

// Regex for values that look like wallet addresses or emails — drop silently.
// EVM: 0x + 40 hex; Solana: base58 32-44 chars; email: basic RFC pattern.
const PII_VALUE_RE = /^0x[a-fA-F0-9]{40}$|^[1-9A-HJ-NP-Za-km-z]{32,44}$|^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Only alphanumeric, hyphens, underscores allowed in anon_id.
const ANON_ID_RE = /[^A-Za-z0-9_-]/g;

const PROPS_MAX_BYTES = 2048;

const FUNNEL_DDL = `
  CREATE TABLE IF NOT EXISTS funnel_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    event      TEXT NOT NULL,
    path       TEXT,
    referrer   TEXT,
    utm_source   TEXT,
    utm_medium   TEXT,
    utm_campaign TEXT,
    anon_id    TEXT,
    props      TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_funnel_event   ON funnel_events(event);
  CREATE INDEX IF NOT EXISTS idx_funnel_created ON funnel_events(created_at);
  CREATE INDEX IF NOT EXISTS idx_funnel_anon    ON funnel_events(anon_id);
`;

// ─── Lazy table initialisation ───────────────────────────────────────────────

let tableReady = false;

/**
 * Idempotent: creates funnel_events table and indexes if they do not exist.
 * Guard flag avoids repeated DDL on every request in production.
 *
 * @param {import('better-sqlite3').Database} db
 */
function ensureTable(db) {
  if (tableReady) return;
  db.exec(FUNNEL_DDL);
  tableReady = true;
}

// ─── Exported pure helpers (also used by tests) ───────────────────────────────

/**
 * Strip any key whose string-coerced value looks like a wallet address or email.
 * Returns a new object (immutable pattern).
 *
 * @param {object} obj
 * @returns {object}
 */
function stripPiiFromProps(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const clean = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const strVal = typeof val === 'string' ? val : String(val);
    if (PII_VALUE_RE.test(strVal)) continue; // drop silently
    clean[key] = val;
  }
  return clean;
}

/**
 * Sanitize and bound the props blob.
 * Returns the JSON string to persist, or null if it was empty/invalid.
 *
 * @param {unknown} rawProps
 * @returns {string|null}
 */
function sanitizeProps(rawProps) {
  if (rawProps === undefined || rawProps === null) return null;

  let obj;
  if (typeof rawProps === 'string') {
    try { obj = JSON.parse(rawProps); } catch { return null; }
  } else if (typeof rawProps === 'object' && !Array.isArray(rawProps)) {
    obj = rawProps;
  } else {
    return null;
  }

  const clean = stripPiiFromProps(obj);
  const serialised = JSON.stringify(clean);

  // Reject if it exceeds the 2 KB cap even after PII stripping.
  if (Buffer.byteLength(serialised, 'utf8') > PROPS_MAX_BYTES) return null;

  return serialised;
}

/**
 * Compute the funnel summary over a time window against a given DB instance.
 * Extracted for direct testability without HTTP.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} days - 1..90
 * @returns {{ funnel: object, conversions: object, period: object }}
 */
function computeFunnelSummary(db, days) {
  const clampedDays = Math.min(Math.max(days, 1), 90);
  const since = new Date(Date.now() - clampedDays * 24 * 60 * 60 * 1000).toISOString();

  const rows = db.prepare(`
    SELECT event, COUNT(*) AS count
    FROM funnel_events
    WHERE created_at >= ?
    GROUP BY event
  `).all(since);

  const counts = {};
  for (const row of rows) {
    counts[row.event] = row.count;
  }

  const funnel = {
    register_view:      counts.register_view      || 0,
    free_mint_success:  counts.free_mint_success  || 0,
    upgrade_card_view:  counts.upgrade_card_view  || 0,
    pay_click:          counts.pay_click          || 0,
    paid_mint_success:  counts.paid_mint_success  || 0,
    pay_error:          counts.pay_error          || 0,
  };

  const pay_click_rate = funnel.upgrade_card_view > 0
    ? parseFloat((funnel.pay_click / funnel.upgrade_card_view).toFixed(4))
    : null;

  const paid_success_rate = funnel.pay_click > 0
    ? parseFloat((funnel.paid_mint_success / funnel.pay_click).toFixed(4))
    : null;

  return {
    period: { days: clampedDays, since },
    funnel,
    conversions: {
      pay_click_per_upgrade_view: pay_click_rate,
      paid_mint_per_pay_click:    paid_success_rate,
    },
  };
}

// ─── POST /api/v1/funnel/event ────────────────────────────────────────────────

router.post('/event', (req, res) => {
  try {
    // Lazy-require keeps getDb() mockable in tests and avoids load-order issues.
    const db = require('../database').getDb();
    ensureTable(db);

    const body = req.body || {};

    // Hard validation: event must be in the allowlist.
    const event = typeof body.event === 'string' ? body.event.trim() : '';
    if (!ALLOWED_EVENTS.includes(event)) {
      return res.status(400).json({ success: false, error: `event must be one of: ${ALLOWED_EVENTS.join(', ')}` });
    }

    // Soft-bound optional fields — truncate, never throw.
    const path = sanitize(typeof body.path === 'string' ? body.path : '').slice(0, 200) || null;
    const referrer = sanitize(typeof body.referrer === 'string' ? body.referrer : '').slice(0, 300) || null;

    const utm = body.utm && typeof body.utm === 'object' ? body.utm : {};
    const utm_source   = sanitize(typeof utm.source   === 'string' ? utm.source   : '').slice(0, 100) || null;
    const utm_medium   = sanitize(typeof utm.medium   === 'string' ? utm.medium   : '').slice(0, 100) || null;
    const utm_campaign = sanitize(typeof utm.campaign === 'string' ? utm.campaign : '').slice(0, 100) || null;

    // anon_id: strip to safe charset, hard-cap to 64 chars.
    const rawAnonId = typeof body.anon_id === 'string' ? body.anon_id : '';
    const anon_id = rawAnonId.replace(ANON_ID_RE, '').slice(0, 64) || null;

    const props = sanitizeProps(body.props);

    db.prepare(`
      INSERT INTO funnel_events
        (event, path, referrer, utm_source, utm_medium, utm_campaign, anon_id, props)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(event, path, referrer, utm_source, utm_medium, utm_campaign, anon_id, props);

    return res.status(200).json({ success: true });
  } catch (err) {
    // Fire-and-forget: never surface internals to caller.
    console.error('[funnel] POST /event error:', err);
    return res.status(200).json({ success: true });
  }
});

// ─── GET /api/v1/funnel/summary ───────────────────────────────────────────────

router.get('/summary', (req, res) => {
  try {
    const db = require('../database').getDb();
    ensureTable(db);

    const rawDays = parseInt(req.query.days, 10);
    const days = isNaN(rawDays) ? 7 : rawDays;
    const result = computeFunnelSummary(db, days);

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('[funnel] GET /summary error:', err);
    return res.status(500).json({ success: false, error: 'Failed to compute funnel summary' });
  }
});

module.exports = router;
module.exports.ALLOWED_EVENTS = ALLOWED_EVENTS;
module.exports.stripPiiFromProps = stripPiiFromProps;
module.exports.sanitizeProps = sanitizeProps;
module.exports.computeFunnelSummary = computeFunnelSummary;
module.exports.ensureTable = ensureTable;
module.exports.FUNNEL_DDL = FUNNEL_DDL;
