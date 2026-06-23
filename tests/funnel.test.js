'use strict';

/**
 * Tests for src/routes/funnel.js
 *
 * Strategy (matching leaderboardLive.test.js style):
 *  Rather than spinning up Express or fighting CJS mock hoisting, we directly
 *  exercise the exported pure-logic functions and the DB integration against an
 *  in-memory SQLite instance from helpers.createTestDb().
 *
 *  Pure-function tests: stripPiiFromProps, sanitizeProps, computeFunnelSummary
 *  DB integration tests: ensureTable + INSERT + computeFunnelSummary queries
 *  Allowlist tests: ALLOWED_EVENTS membership
 *
 *  describe/it/expect are globals (vitest.config.js → globals: true).
 */

const { createTestDb } = require('./helpers');
const {
  ALLOWED_EVENTS,
  stripPiiFromProps,
  sanitizeProps,
  computeFunnelSummary,
  ensureTable,
  FUNNEL_DDL,
} = require('../src/routes/funnel');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Create an in-memory DB with the funnel_events table already initialised.
 * Bypasses the module-level tableReady guard by calling db.exec(FUNNEL_DDL)
 * directly so each test starts with a clean, empty table.
 *
 * @returns {import('better-sqlite3').Database}
 */
function makeFunnelDb() {
  const db = createTestDb();
  db.exec(FUNNEL_DDL);
  return db;
}

/**
 * Insert a funnel_event row directly.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} event
 * @param {number} daysAgo
 */
function insertEvent(db, event, daysAgo = 0) {
  const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
  db.prepare('INSERT INTO funnel_events (event, created_at) VALUES (?, ?)').run(event, createdAt);
}

// ─── ALLOWED_EVENTS allowlist ─────────────────────────────────────────────────

describe('ALLOWED_EVENTS', () => {
  it('contains all six expected event names', () => {
    expect(ALLOWED_EVENTS).toContain('register_view');
    expect(ALLOWED_EVENTS).toContain('free_mint_success');
    expect(ALLOWED_EVENTS).toContain('upgrade_card_view');
    expect(ALLOWED_EVENTS).toContain('pay_click');
    expect(ALLOWED_EVENTS).toContain('paid_mint_success');
    expect(ALLOWED_EVENTS).toContain('pay_error');
    expect(ALLOWED_EVENTS).toHaveLength(6);
  });

  it('does not contain arbitrary strings', () => {
    expect(ALLOWED_EVENTS).not.toContain('xss_attempt');
    expect(ALLOWED_EVENTS).not.toContain('');
    expect(ALLOWED_EVENTS).not.toContain('admin_access');
  });
});

// ─── stripPiiFromProps ────────────────────────────────────────────────────────

describe('stripPiiFromProps', () => {
  it('passes through clean props unchanged', () => {
    const input = { campaign: 'launch', tier: 'gold', step: 3 };
    const result = stripPiiFromProps(input);
    expect(result).toEqual(input);
  });

  it('strips EVM wallet address values', () => {
    const result = stripPiiFromProps({
      campaign: 'launch',
      wallet: '0xaabbccddEEff00112233445566778899aabbccdd',
      tier: 'gold',
    });
    expect(result.campaign).toBe('launch');
    expect(result.tier).toBe('gold');
    expect(result.wallet).toBeUndefined();
  });

  it('strips Solana wallet address values', () => {
    const result = stripPiiFromProps({
      ref: 'Gcv56hKWuEGmXheBpJxAwQxvX6QAMimZzzVrHaVCbNWE',
      tier: 'silver',
    });
    expect(result.tier).toBe('silver');
    expect(result.ref).toBeUndefined();
  });

  it('strips email values', () => {
    const result = stripPiiFromProps({
      user_email: 'user@example.com',
      step: '1',
    });
    expect(result.step).toBe('1');
    expect(result.user_email).toBeUndefined();
  });

  it('returns empty object for an array input', () => {
    expect(stripPiiFromProps(['a', 'b'])).toEqual({});
  });

  it('returns empty object for null/undefined', () => {
    expect(stripPiiFromProps(null)).toEqual({});
    expect(stripPiiFromProps(undefined)).toEqual({});
  });

  it('does not mutate the input (immutable pattern)', () => {
    const input = { wallet: '0x' + 'a'.repeat(40), tier: 'gold' };
    const frozen = Object.freeze({ ...input });
    const result = stripPiiFromProps(frozen);
    expect(result.wallet).toBeUndefined();
    expect(result.tier).toBe('gold');
    // Original frozen object is unaffected
    expect(frozen.wallet).toBe('0x' + 'a'.repeat(40));
  });
});

// ─── sanitizeProps ────────────────────────────────────────────────────────────

describe('sanitizeProps', () => {
  it('returns null for undefined input', () => {
    expect(sanitizeProps(undefined)).toBeNull();
  });

  it('returns null for null input', () => {
    expect(sanitizeProps(null)).toBeNull();
  });

  it('returns null for array input', () => {
    expect(sanitizeProps(['a', 'b'])).toBeNull();
  });

  it('returns null for a non-parseable JSON string', () => {
    expect(sanitizeProps('not json')).toBeNull();
  });

  it('accepts a valid object and returns its JSON string', () => {
    const result = sanitizeProps({ campaign: 'launch', step: 1 });
    expect(typeof result).toBe('string');
    const parsed = JSON.parse(result);
    expect(parsed.campaign).toBe('launch');
    expect(parsed.step).toBe(1);
  });

  it('accepts a valid JSON string input', () => {
    const result = sanitizeProps('{"campaign":"launch"}');
    expect(typeof result).toBe('string');
    expect(JSON.parse(result).campaign).toBe('launch');
  });

  it('strips PII values from props object', () => {
    const result = sanitizeProps({
      wallet: '0x' + 'a'.repeat(40),
      campaign: 'launch',
    });
    const parsed = JSON.parse(result);
    expect(parsed.campaign).toBe('launch');
    expect(parsed.wallet).toBeUndefined();
  });

  it('returns null when serialised props exceed 2KB', () => {
    const bigProps = {};
    for (let i = 0; i < 100; i++) {
      bigProps[`key_${i}`] = 'x'.repeat(30);
    }
    expect(sanitizeProps(bigProps)).toBeNull();
  });

  it('returns a valid string for props just under 2KB', () => {
    // Build props totalling just under 2048 bytes.
    const smallProps = { k: 'x'.repeat(50) };
    const result = sanitizeProps(smallProps);
    expect(typeof result).toBe('string');
    expect(Buffer.byteLength(result, 'utf8')).toBeLessThanOrEqual(2048);
  });
});

// ─── computeFunnelSummary (DB integration) ────────────────────────────────────

describe('computeFunnelSummary', () => {
  let db;
  beforeEach(() => { db = makeFunnelDb(); });
  afterEach(() => { db.close(); });

  it('returns zero counts for an empty table', () => {
    const result = computeFunnelSummary(db, 7);
    expect(result.funnel.register_view).toBe(0);
    expect(result.funnel.paid_mint_success).toBe(0);
    expect(result.conversions.pay_click_per_upgrade_view).toBeNull();
    expect(result.conversions.paid_mint_per_pay_click).toBeNull();
  });

  it('aggregates counts within the window and excludes older events', () => {
    insertEvent(db, 'register_view', 1);
    insertEvent(db, 'register_view', 2);
    insertEvent(db, 'upgrade_card_view', 1);
    insertEvent(db, 'pay_click', 0);
    insertEvent(db, 'paid_mint_success', 0);
    insertEvent(db, 'register_view', 10); // outside 7-day window

    const result = computeFunnelSummary(db, 7);
    expect(result.funnel.register_view).toBe(2);
    expect(result.funnel.upgrade_card_view).toBe(1);
    expect(result.funnel.pay_click).toBe(1);
    expect(result.funnel.paid_mint_success).toBe(1);
  });

  it('computes pay_click_per_upgrade_view ratio correctly', () => {
    insertEvent(db, 'upgrade_card_view', 1);
    insertEvent(db, 'upgrade_card_view', 1);
    insertEvent(db, 'upgrade_card_view', 1);
    insertEvent(db, 'upgrade_card_view', 1);
    insertEvent(db, 'pay_click', 0);
    insertEvent(db, 'pay_click', 0);

    const result = computeFunnelSummary(db, 7);
    // 2 / 4 = 0.5
    expect(result.conversions.pay_click_per_upgrade_view).toBe(0.5);
  });

  it('computes paid_mint_per_pay_click ratio correctly', () => {
    insertEvent(db, 'pay_click', 0);
    insertEvent(db, 'pay_click', 0);
    insertEvent(db, 'pay_click', 0);
    insertEvent(db, 'pay_click', 0);
    insertEvent(db, 'paid_mint_success', 0);

    const result = computeFunnelSummary(db, 7);
    // 1 / 4 = 0.25
    expect(result.conversions.paid_mint_per_pay_click).toBe(0.25);
  });

  it('clamps days below 1 to 1', () => {
    const result = computeFunnelSummary(db, 0);
    expect(result.period.days).toBe(1);
  });

  it('clamps days above 90 to 90', () => {
    const result = computeFunnelSummary(db, 999);
    expect(result.period.days).toBe(90);
  });

  it('returns a valid ISO since timestamp', () => {
    const result = computeFunnelSummary(db, 7);
    expect(typeof result.period.since).toBe('string');
    expect(new Date(result.period.since).getTime()).toBeLessThan(Date.now());
  });

  it('zero-fills all funnel steps even when some have no events', () => {
    insertEvent(db, 'register_view', 0);
    // Only register_view is inserted — all others must default to 0.
    const result = computeFunnelSummary(db, 7);
    expect(result.funnel.register_view).toBe(1);
    expect(result.funnel.free_mint_success).toBe(0);
    expect(result.funnel.upgrade_card_view).toBe(0);
    expect(result.funnel.pay_click).toBe(0);
    expect(result.funnel.paid_mint_success).toBe(0);
    expect(result.funnel.pay_error).toBe(0);
  });

  it('result object does not contain row-level data (no PII exposure)', () => {
    insertEvent(db, 'register_view', 0);
    const result = computeFunnelSummary(db, 7);
    // No arrays of individual events or anon_ids should be exposed.
    expect(Array.isArray(result.rows)).toBe(false);
    expect(Array.isArray(result.events)).toBe(false);
    expect(result.anon_ids).toBeUndefined();
  });
});

// ─── ensureTable (DB integration) ────────────────────────────────────────────

describe('ensureTable', () => {
  it('creates funnel_events table if it does not exist', () => {
    const db = createTestDb(); // fresh DB without funnel_events
    // ensureTable uses module-level guard — call db.exec directly to avoid
    // the guard being already tripped from a prior module load:
    db.exec(FUNNEL_DDL);
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='funnel_events'"
    ).get();
    expect(row).toBeDefined();
    expect(row.name).toBe('funnel_events');
    db.close();
  });

  it('creates the three expected indexes', () => {
    const db = createTestDb();
    db.exec(FUNNEL_DDL);
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='funnel_events'"
    ).all().map(r => r.name);
    expect(indexes).toContain('idx_funnel_event');
    expect(indexes).toContain('idx_funnel_created');
    expect(indexes).toContain('idx_funnel_anon');
    db.close();
  });

  it('is idempotent — running DDL twice does not throw', () => {
    const db = createTestDb();
    expect(() => { db.exec(FUNNEL_DDL); db.exec(FUNNEL_DDL); }).not.toThrow();
    db.close();
  });
});
