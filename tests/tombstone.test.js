const { createTestDb } = require('./helpers');
const { validateTombstone, TOMBSTONE_OUTCOMES } = require('../src/utils/validators');

const GOOD_WALLET = '0x' + 'a'.repeat(40);
const NOW = new Date().toISOString();
const FUTURE = new Date(Date.now() + 86400000 * 30).toISOString();
const PAST = new Date(Date.now() - 86400000 * 30).toISOString();

function insertStamp(db, overrides = {}) {
  const defaults = {
    id: 'stmp_test1',
    wallet_address: GOOD_WALLET,
    tier: 'gold',
    issued_at: NOW,
    expires_at: FUTURE,
    certificate: '{"v":1}',
    signature: 'sig123',
    revoked: 0,
    outcome: null,
    tombstoned_at: null,
  };
  const row = { ...defaults, ...overrides };
  db.prepare(`
    INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature, revoked, outcome, tombstoned_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(row.id, row.wallet_address, row.tier, row.issued_at, row.expires_at, row.certificate, row.signature, row.revoked, row.outcome, row.tombstoned_at);
}

// ─── Tombstone Validator ─────────────────────────────────────────────────────

describe('validateTombstone', () => {
  it('accepts valid outcomes', () => {
    for (const outcome of TOMBSTONE_OUTCOMES) {
      expect(validateTombstone({ outcome })).toEqual({ valid: true });
    }
  });

  it('rejects missing outcome', () => {
    const result = validateTombstone({});
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('outcome must be one of');
  });

  it('rejects invalid outcome', () => {
    const result = validateTombstone({ outcome: 'exploded' });
    expect(result.valid).toBe(false);
  });

  it('rejects reason over 500 characters', () => {
    const result = validateTombstone({ outcome: 'completed', reason: 'x'.repeat(501) });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('reason');
  });

  it('accepts valid reason', () => {
    const result = validateTombstone({ outcome: 'crashed', reason: 'Out of memory' });
    expect(result.valid).toBe(true);
  });
});

// ─── Tombstone DB Operations ─────────────────────────────────────────────────

describe('tombstone database operations', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('sets outcome and tombstoned_at on a live stamp', () => {
    insertStamp(db);
    const result = db.prepare(
      "UPDATE stamps SET outcome = ?, tombstoned_at = datetime('now') WHERE id = ? AND outcome IS NULL AND revoked = 0"
    ).run('completed', 'stmp_test1');
    expect(result.changes).toBe(1);

    const stamp = db.prepare('SELECT outcome, tombstoned_at FROM stamps WHERE id = ?').get('stmp_test1');
    expect(stamp.outcome).toBe('completed');
    expect(stamp.tombstoned_at).toBeTruthy();
  });

  it('does not update already-tombstoned stamp', () => {
    insertStamp(db, { outcome: 'crashed', tombstoned_at: NOW });
    const result = db.prepare(
      "UPDATE stamps SET outcome = ?, tombstoned_at = datetime('now') WHERE id = ? AND outcome IS NULL AND revoked = 0"
    ).run('completed', 'stmp_test1');
    expect(result.changes).toBe(0);
  });

  it('does not update revoked stamp', () => {
    insertStamp(db, { revoked: 1 });
    const result = db.prepare(
      "UPDATE stamps SET outcome = ?, tombstoned_at = datetime('now') WHERE id = ? AND outcome IS NULL AND revoked = 0"
    ).run('completed', 'stmp_test1');
    expect(result.changes).toBe(0);
  });

  it('returns 0 changes for nonexistent stamp', () => {
    const result = db.prepare(
      "UPDATE stamps SET outcome = ?, tombstoned_at = datetime('now') WHERE id = ? AND outcome IS NULL AND revoked = 0"
    ).run('completed', 'stmp_nonexistent');
    expect(result.changes).toBe(0);
  });
});

// ─── cleanupExpired Tombstone Behavior ───────────────────────────────────────

describe('cleanupExpired tombstone behavior', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('sets outcome=timeout on untombstoned expired stamps', () => {
    insertStamp(db, { id: 'stmp_expired1', expires_at: PAST, revoked: 0, outcome: null });

    // Simulate the cleanup logic
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE stamps SET outcome = 'timeout', tombstoned_at = datetime('now'), revoked = 1 WHERE expires_at < ? AND revoked = 0 AND outcome IS NULL"
    ).run(now);

    const stamp = db.prepare('SELECT * FROM stamps WHERE id = ?').get('stmp_expired1');
    expect(stamp.outcome).toBe('timeout');
    expect(stamp.tombstoned_at).toBeTruthy();
    expect(stamp.revoked).toBe(1);
  });

  it('preserves existing outcome on already-tombstoned expired stamps', () => {
    insertStamp(db, { id: 'stmp_expired2', expires_at: PAST, revoked: 0, outcome: 'completed', tombstoned_at: NOW });

    const now = new Date().toISOString();
    // First pass: timeout untombstoned
    db.prepare(
      "UPDATE stamps SET outcome = 'timeout', tombstoned_at = datetime('now'), revoked = 1 WHERE expires_at < ? AND revoked = 0 AND outcome IS NULL"
    ).run(now);
    // Second pass: revoke tombstoned
    db.prepare(
      "UPDATE stamps SET revoked = 1 WHERE expires_at < ? AND revoked = 0 AND outcome IS NOT NULL"
    ).run(now);

    const stamp = db.prepare('SELECT * FROM stamps WHERE id = ?').get('stmp_expired2');
    expect(stamp.outcome).toBe('completed');
    expect(stamp.tombstoned_at).toBe(NOW);
    expect(stamp.revoked).toBe(1);
  });
});

// ─── Verify Endpoint Fields ──────────────────────────────────────────────────

describe('verify response includes tombstone fields', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('includes outcome, tombstoned_at, and active for live stamp', () => {
    insertStamp(db);
    const stamp = db.prepare('SELECT * FROM stamps WHERE id = ?').get('stmp_test1');
    const isExpired = new Date(stamp.expires_at) < new Date();
    const active = !isExpired && !stamp.revoked && !stamp.outcome;

    expect(active).toBe(true);
    expect(stamp.outcome).toBeNull();
    expect(stamp.tombstoned_at).toBeNull();
  });

  it('active is false for tombstoned stamp', () => {
    insertStamp(db, { outcome: 'completed', tombstoned_at: NOW });
    const stamp = db.prepare('SELECT * FROM stamps WHERE id = ?').get('stmp_test1');
    const isExpired = new Date(stamp.expires_at) < new Date();
    const active = !isExpired && !stamp.revoked && !stamp.outcome;

    expect(active).toBe(false);
    expect(stamp.outcome).toBe('completed');
  });

  it('active is false for expired stamp', () => {
    insertStamp(db, { expires_at: PAST });
    const stamp = db.prepare('SELECT * FROM stamps WHERE id = ?').get('stmp_test1');
    const isExpired = new Date(stamp.expires_at) < new Date();
    const active = !isExpired && !stamp.revoked && !stamp.outcome;

    expect(active).toBe(false);
  });

  it('active is false for revoked stamp', () => {
    insertStamp(db, { revoked: 1 });
    const stamp = db.prepare('SELECT * FROM stamps WHERE id = ?').get('stmp_test1');
    const isExpired = new Date(stamp.expires_at) < new Date();
    const active = !isExpired && !stamp.revoked && !stamp.outcome;

    expect(active).toBe(false);
  });
});
