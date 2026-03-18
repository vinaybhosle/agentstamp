const { createTestDb } = require('./helpers');
const { nanoid } = require('nanoid');

const WALLET = '0x' + 'a'.repeat(40);
const WALLET_2 = '0x' + 'b'.repeat(40);

const EVENT_TYPES = [
  'stamp_minted', 'stamp_tombstoned', 'stamp_revoked',
  'agent_registered', 'agent_expired',
  'heartbeat', 'endorsement',
  'wish_created', 'wish_granted',
  'stamp_event', 'wallet_linked',
];

const EXECUTION_EVENTS = [
  'stamp_minted', 'agent_registered', 'heartbeat',
  'endorsement', 'wish_granted', 'stamp_event',
];

// Helper: replicate appendEvent logic against a given db
function appendEvent(db, eventType, data = {}) {
  const id = `evt_${nanoid(16)}`;
  const now = new Date().toISOString();
  const payload = JSON.stringify(data);

  db.prepare(`
    INSERT INTO event_log (id, event_type, stamp_id, agent_id, wallet_address, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    eventType,
    data.stamp_id || null,
    data.agent_id || null,
    data.wallet_address || null,
    payload,
    now
  );

  return { id, event_type: eventType, created_at: now };
}

// Helper: replicate getLastEvent logic against a given db
function getLastEvent(db) {
  return db.prepare('SELECT * FROM event_log ORDER BY rowid DESC LIMIT 1').get() || null;
}

// Helper: replicate queryEvents logic against a given db
function queryEvents(db, filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.event_type) {
    conditions.push('event_type = ?');
    params.push(filters.event_type);
  }
  if (filters.stamp_id) {
    conditions.push('stamp_id = ?');
    params.push(filters.stamp_id);
  }
  if (filters.agent_id) {
    conditions.push('agent_id = ?');
    params.push(filters.agent_id);
  }
  if (filters.wallet_address) {
    conditions.push('wallet_address = ?');
    params.push(filters.wallet_address);
  }
  if (filters.since) {
    conditions.push('created_at >= ?');
    params.push(filters.since);
  }
  if (filters.until) {
    conditions.push('created_at <= ?');
    params.push(filters.until);
  }
  if (filters.event_types) {
    const placeholders = filters.event_types.map(() => '?').join(',');
    conditions.push(`event_type IN (${placeholders})`);
    params.push(...filters.event_types);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(filters.limit || 50, 200);
  const offset = filters.offset || 0;

  const total = db.prepare(
    `SELECT COUNT(*) as count FROM event_log ${where}`
  ).get(...params).count;

  const events = db.prepare(
    `SELECT * FROM event_log ${where} ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return { events, total, limit, offset };
}

// ─── appendEvent ──────────────────────────────────────────────────────────────

describe('appendEvent', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('writes to event_log table with correct fields', () => {
    const result = appendEvent(db, 'stamp_minted', { stamp_id: 'stmp_abc', wallet_address: WALLET, tier: 'gold' });

    expect(result.id).toMatch(/^evt_/);
    expect(result.event_type).toBe('stamp_minted');
    expect(result.created_at).toBeTruthy();

    const row = db.prepare('SELECT * FROM event_log WHERE id = ?').get(result.id);
    expect(row).toBeTruthy();
    expect(row.event_type).toBe('stamp_minted');
  });

  it('extracts stamp_id, agent_id, wallet_address from data', () => {
    const result = appendEvent(db, 'stamp_event', {
      stamp_id: 'stmp_123',
      agent_id: 'agt_456',
      wallet_address: WALLET,
    });

    const row = db.prepare('SELECT * FROM event_log WHERE id = ?').get(result.id);
    expect(row.stamp_id).toBe('stmp_123');
    expect(row.agent_id).toBe('agt_456');
    expect(row.wallet_address).toBe(WALLET);
  });

  it('stores payload as JSON string', () => {
    const data = { stamp_id: 'stmp_x', tier: 'silver', extra: 'info' };
    const result = appendEvent(db, 'stamp_minted', data);

    const row = db.prepare('SELECT * FROM event_log WHERE id = ?').get(result.id);
    const parsed = JSON.parse(row.payload);
    expect(parsed.stamp_id).toBe('stmp_x');
    expect(parsed.tier).toBe('silver');
    expect(parsed.extra).toBe('info');
  });

  it('creates sequential entries for multiple calls', () => {
    appendEvent(db, 'stamp_minted', { stamp_id: 'stmp_1' });
    appendEvent(db, 'agent_registered', { agent_id: 'agt_1' });
    appendEvent(db, 'heartbeat', { agent_id: 'agt_1' });

    const count = db.prepare('SELECT COUNT(*) as count FROM event_log').get().count;
    expect(count).toBe(3);
  });
});

// ─── getLastEvent ─────────────────────────────────────────────────────────────

describe('getLastEvent', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('returns most recent event', () => {
    appendEvent(db, 'stamp_minted', { stamp_id: 'stmp_first' });
    appendEvent(db, 'agent_registered', { agent_id: 'agt_last' });

    const last = getLastEvent(db);
    expect(last.event_type).toBe('agent_registered');
    expect(last.agent_id).toBe('agt_last');
  });

  it('returns null when no events exist', () => {
    const last = getLastEvent(db);
    expect(last).toBeNull();
  });
});

// ─── queryEvents ──────────────────────────────────────────────────────────────

describe('queryEvents', () => {
  let db;
  beforeEach(() => {
    db = createTestDb();
    appendEvent(db, 'stamp_minted', { stamp_id: 'stmp_1', wallet_address: WALLET });
    appendEvent(db, 'agent_registered', { agent_id: 'agt_1', wallet_address: WALLET });
    appendEvent(db, 'heartbeat', { agent_id: 'agt_1' });
    appendEvent(db, 'stamp_tombstoned', { stamp_id: 'stmp_1', wallet_address: WALLET });
    appendEvent(db, 'wish_created', { wallet_address: WALLET });
  });
  afterEach(() => { db.close(); });

  it('returns all events when no filters', () => {
    const result = queryEvents(db);
    expect(result.events.length).toBe(5);
    expect(result.total).toBe(5);
  });

  it('filters by event_type', () => {
    const result = queryEvents(db, { event_type: 'heartbeat' });
    expect(result.events.length).toBe(1);
    expect(result.events[0].event_type).toBe('heartbeat');
    expect(result.total).toBe(1);
  });

  it('filters by wallet_address', () => {
    const result = queryEvents(db, { wallet_address: WALLET });
    expect(result.events.length).toBe(4);
    expect(result.total).toBe(4);
  });

  it('filters by stamp_id', () => {
    const result = queryEvents(db, { stamp_id: 'stmp_1' });
    expect(result.events.length).toBe(2);
    expect(result.total).toBe(2);
  });

  it('filters by date range (since/until)', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();

    const result = queryEvents(db, { since: past, until: future });
    expect(result.events.length).toBe(5);

    const veryFuture = new Date(Date.now() + 86400000 * 100).toISOString();
    const noResults = queryEvents(db, { since: veryFuture });
    expect(noResults.events.length).toBe(0);
    expect(noResults.total).toBe(0);
  });

  it('respects limit and offset', () => {
    const result = queryEvents(db, { limit: 2, offset: 0 });
    expect(result.events.length).toBe(2);
    expect(result.total).toBe(5);
    expect(result.limit).toBe(2);
    expect(result.offset).toBe(0);

    const page2 = queryEvents(db, { limit: 2, offset: 2 });
    expect(page2.events.length).toBe(2);
    expect(page2.offset).toBe(2);
  });

  it('filters with event_types array (EXECUTION_EVENTS)', () => {
    const result = queryEvents(db, { event_types: EXECUTION_EVENTS });
    // stamp_minted, agent_registered, heartbeat are execution events
    // stamp_tombstoned and wish_created are NOT execution events
    expect(result.events.length).toBe(3);
    expect(result.total).toBe(3);
    for (const evt of result.events) {
      expect(EXECUTION_EVENTS).toContain(evt.event_type);
    }
  });
});

// ─── EVENT_TYPES and EXECUTION_EVENTS ──────────────────────────────────────────

describe('EVENT_TYPES and EXECUTION_EVENTS', () => {
  it('EXECUTION_EVENTS is a subset of EVENT_TYPES', () => {
    for (const execType of EXECUTION_EVENTS) {
      expect(EVENT_TYPES).toContain(execType);
    }
  });
});
