const { createTestDb } = require('./helpers');
const { validateStampEvent, STAMP_EVENT_OUTCOMES } = require('../src/utils/validators');
const { generateStampEventId, generateEventId } = require('../src/utils/generateId');

const GOOD_WALLET = '0x' + 'a'.repeat(40);
const NOW = new Date().toISOString();

// ─── Validator Tests ────────────────────────────────────────────────────────

describe('validateStampEvent', () => {
  it('accepts valid stamp event', () => {
    const result = validateStampEvent({
      wallet_address: GOOD_WALLET,
      action: 'access_check',
      outcome: 'executed',
    });
    expect(result).toEqual({ valid: true });
  });

  it('rejects missing wallet_address', () => {
    const result = validateStampEvent({
      action: 'access_check',
      outcome: 'executed',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('wallet_address is required');
  });

  it('rejects missing action', () => {
    const result = validateStampEvent({
      wallet_address: GOOD_WALLET,
      outcome: 'executed',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('action'))).toBe(true);
  });

  it('rejects invalid outcome', () => {
    const result = validateStampEvent({
      wallet_address: GOOD_WALLET,
      action: 'access_check',
      outcome: 'unknown',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('outcome'))).toBe(true);
  });

  it('rejects gate_reason over 500 characters', () => {
    const result = validateStampEvent({
      wallet_address: GOOD_WALLET,
      action: 'access_check',
      outcome: 'denied',
      gate_reason: 'x'.repeat(501),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('gate_reason'))).toBe(true);
  });

  it('rejects endpoint over 200 characters', () => {
    const result = validateStampEvent({
      wallet_address: GOOD_WALLET,
      action: 'access_check',
      outcome: 'executed',
      endpoint: '/'.repeat(201),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('endpoint'))).toBe(true);
  });

  it('accepts all valid outcomes', () => {
    for (const outcome of STAMP_EVENT_OUTCOMES) {
      const result = validateStampEvent({
        wallet_address: GOOD_WALLET,
        action: 'access_check',
        outcome,
      });
      expect(result.valid).toBe(true);
    }
  });
});

// ─── ID Generator Tests ─────────────────────────────────────────────────────

describe('generateStampEventId', () => {
  it('generates IDs with sevt_ prefix', () => {
    const id = generateStampEventId();
    expect(id).toMatch(/^sevt_/);
    expect(id.length).toBeGreaterThan(5);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateStampEventId()));
    expect(ids.size).toBe(100);
  });
});

describe('generateEventId', () => {
  it('generates IDs with evt_ prefix', () => {
    const id = generateEventId();
    expect(id).toMatch(/^evt_/);
    expect(id.length).toBeGreaterThan(4);
  });
});

// ─── Database Integration Tests ─────────────────────────────────────────────

describe('stamp_events table', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('inserts and retrieves a stamp event', () => {
    const eventId = generateStampEventId();
    db.prepare(`
      INSERT INTO stamp_events (id, stamp_id, agent_id, wallet_address, action, outcome, gate_reason, endpoint, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(eventId, 'stmp_abc', 'agt_xyz', GOOD_WALLET, 'access_check', 'executed', null, '/api/test', null, NOW);

    const event = db.prepare('SELECT * FROM stamp_events WHERE id = ?').get(eventId);
    expect(event).toBeDefined();
    expect(event.wallet_address).toBe(GOOD_WALLET);
    expect(event.action).toBe('access_check');
    expect(event.outcome).toBe('executed');
  });

  it('filters by wallet_address', () => {
    const wallet2 = '0x' + 'b'.repeat(40);
    db.prepare(`INSERT INTO stamp_events (id, wallet_address, action, outcome, created_at) VALUES (?, ?, ?, ?, ?)`).run('sevt_1', GOOD_WALLET, 'check', 'executed', NOW);
    db.prepare(`INSERT INTO stamp_events (id, wallet_address, action, outcome, created_at) VALUES (?, ?, ?, ?, ?)`).run('sevt_2', wallet2, 'check', 'denied', NOW);

    const results = db.prepare('SELECT * FROM stamp_events WHERE wallet_address = ?').all(GOOD_WALLET);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('sevt_1');
  });

  it('filters by outcome', () => {
    db.prepare(`INSERT INTO stamp_events (id, wallet_address, action, outcome, created_at) VALUES (?, ?, ?, ?, ?)`).run('sevt_a', GOOD_WALLET, 'check', 'executed', NOW);
    db.prepare(`INSERT INTO stamp_events (id, wallet_address, action, outcome, created_at) VALUES (?, ?, ?, ?, ?)`).run('sevt_b', GOOD_WALLET, 'check', 'denied', NOW);
    db.prepare(`INSERT INTO stamp_events (id, wallet_address, action, outcome, created_at) VALUES (?, ?, ?, ?, ?)`).run('sevt_c', GOOD_WALLET, 'check', 'error', NOW);

    const denied = db.prepare('SELECT * FROM stamp_events WHERE outcome = ?').all('denied');
    expect(denied).toHaveLength(1);
    expect(denied[0].id).toBe('sevt_b');
  });

  it('filters by created_at date', () => {
    const old = '2025-01-01T00:00:00.000Z';
    const recent = '2026-03-01T00:00:00.000Z';
    db.prepare(`INSERT INTO stamp_events (id, wallet_address, action, outcome, created_at) VALUES (?, ?, ?, ?, ?)`).run('sevt_old', GOOD_WALLET, 'check', 'executed', old);
    db.prepare(`INSERT INTO stamp_events (id, wallet_address, action, outcome, created_at) VALUES (?, ?, ?, ?, ?)`).run('sevt_new', GOOD_WALLET, 'check', 'executed', recent);

    const results = db.prepare('SELECT * FROM stamp_events WHERE created_at >= ?').all('2026-01-01');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('sevt_new');
  });

  it('respects limit and offset', () => {
    for (let i = 0; i < 10; i++) {
      db.prepare(`INSERT INTO stamp_events (id, wallet_address, action, outcome, created_at) VALUES (?, ?, ?, ?, ?)`)
        .run(`sevt_${i}`, GOOD_WALLET, 'check', 'executed', NOW);
    }

    const page1 = db.prepare('SELECT * FROM stamp_events ORDER BY created_at DESC LIMIT ? OFFSET ?').all(3, 0);
    expect(page1).toHaveLength(3);

    const page2 = db.prepare('SELECT * FROM stamp_events ORDER BY created_at DESC LIMIT ? OFFSET ?').all(3, 3);
    expect(page2).toHaveLength(3);

    const allIds = [...page1, ...page2].map(e => e.id);
    const unique = new Set(allIds);
    expect(unique.size).toBe(6);
  });

  it('stores and retrieves metadata as JSON', () => {
    const meta = JSON.stringify({ source: 'sdk', version: '1.0' });
    db.prepare(`INSERT INTO stamp_events (id, wallet_address, action, outcome, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('sevt_meta', GOOD_WALLET, 'check', 'executed', meta, NOW);

    const event = db.prepare('SELECT * FROM stamp_events WHERE id = ?').get('sevt_meta');
    const parsed = JSON.parse(event.metadata);
    expect(parsed.source).toBe('sdk');
    expect(parsed.version).toBe('1.0');
  });
});
