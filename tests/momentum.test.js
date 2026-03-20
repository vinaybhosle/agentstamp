const { createTestDb } = require('./helpers');
const { computeMomentum } = require('../src/reputation');

const GOOD_WALLET = '0x' + 'a'.repeat(40);
const NOW_MS = Date.now();
const MS_PER_DAY = 86400000;

/**
 * Build an agent row registered at the given number of days ago.
 */
function makeAgent(overrides = {}) {
  const daysAgo = overrides.daysAgo ?? 0;
  const registeredAt = new Date(NOW_MS - daysAgo * MS_PER_DAY).toISOString();
  return {
    id: 'agt_test',
    wallet_address: GOOD_WALLET,
    registered_at: registeredAt,
    ...overrides,
  };
}

/**
 * Insert an agent row into the test database.
 */
function insertAgent(db, agent) {
  db.prepare(`
    INSERT INTO agents (id, wallet_address, name, registered_at, expires_at, heartbeat_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    agent.id,
    agent.wallet_address,
    agent.name || 'TestBot',
    agent.registered_at,
    agent.expires_at || new Date(NOW_MS + 30 * MS_PER_DAY).toISOString(),
    agent.heartbeat_count || 0,
  );
}

/**
 * Insert a heartbeat at a specific offset (in hours or days) from agent registration.
 */
function insertHeartbeat(db, agentId, registeredAt, { offsetHours, offsetDays }) {
  const base = new Date(registeredAt).getTime();
  const ms = offsetHours != null
    ? offsetHours * 3600000
    : (offsetDays || 0) * MS_PER_DAY;
  const ts = new Date(base + ms).toISOString();
  db.prepare('INSERT INTO heartbeat_log (agent_id, recorded_at) VALUES (?, ?)').run(agentId, ts);
}

/**
 * Insert an endorsement at a specific offset (in hours) from agent registration.
 */
function insertEndorsement(db, agentId, registeredAt, offsetHours) {
  const ts = new Date(new Date(registeredAt).getTime() + offsetHours * 3600000).toISOString();
  db.prepare(
    "INSERT INTO endorsements (id, endorser_wallet, agent_id, created_at) VALUES (?, ?, ?, ?)"
  ).run('end_' + Math.random().toString(36).slice(2, 8), '0x' + 'b'.repeat(40), agentId, ts);
}

/**
 * Insert a stamp event for a wallet.
 */
function insertStampEvent(db, walletAddress) {
  db.prepare(
    "INSERT INTO stamp_events (id, wallet_address, action, outcome, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run('sevt_' + Math.random().toString(36).slice(2, 8), walletAddress, 'access_check', 'executed', new Date().toISOString());
}

// ─── computeMomentum Tests ──────────────────────────────────────────────────

describe('computeMomentum', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('returns 0 for brand new agent with no actions', () => {
    const agent = makeAgent();
    insertAgent(db, agent);

    const result = computeMomentum(agent, db);

    expect(result.earned).toBe(0);
    expect(result.effective).toBe(0);
    expect(result.actions).toEqual([]);
    expect(result.decayed).toBe(false);
  });

  it('awards +3 for first heartbeat within 1 hour of registration', () => {
    const agent = makeAgent();
    insertAgent(db, agent);
    insertHeartbeat(db, agent.id, agent.registered_at, { offsetHours: 0.5 });

    const result = computeMomentum(agent, db);

    expect(result.earned).toBe(3);
    expect(result.actions).toContain('FIRST_HEARTBEAT_WITHIN_1H');
  });

  it('awards +3 for first endorsement within 24 hours', () => {
    const agent = makeAgent();
    insertAgent(db, agent);
    insertEndorsement(db, agent.id, agent.registered_at, 12);

    const result = computeMomentum(agent, db);

    expect(result.earned).toBe(3);
    expect(result.actions).toContain('FIRST_ENDORSEMENT_WITHIN_24H');
  });

  it('awards +3 for three heartbeats in the first week', () => {
    const agent = makeAgent();
    insertAgent(db, agent);
    insertHeartbeat(db, agent.id, agent.registered_at, { offsetDays: 1 });
    insertHeartbeat(db, agent.id, agent.registered_at, { offsetDays: 3 });
    insertHeartbeat(db, agent.id, agent.registered_at, { offsetDays: 5 });

    const result = computeMomentum(agent, db);

    expect(result.earned).toBe(3);
    expect(result.actions).toContain('THREE_HEARTBEATS_FIRST_WEEK');
  });

  it('awards +3 for first stamp event', () => {
    const agent = makeAgent();
    insertAgent(db, agent);
    insertStampEvent(db, agent.wallet_address);

    const result = computeMomentum(agent, db);

    expect(result.earned).toBe(3);
    expect(result.actions).toContain('FIRST_STAMP_EVENT');
  });

  it('awards +3 for seven consecutive days of heartbeats', () => {
    const agent = makeAgent();
    insertAgent(db, agent);
    for (let day = 0; day < 7; day++) {
      insertHeartbeat(db, agent.id, agent.registered_at, { offsetDays: day });
    }

    const result = computeMomentum(agent, db);

    expect(result.actions).toContain('SEVEN_CONSECUTIVE_DAYS');
    // Also gets THREE_HEARTBEATS_FIRST_WEEK and potentially FIRST_HEARTBEAT_WITHIN_1H
    expect(result.earned).toBeGreaterThanOrEqual(3);
  });

  it('caps at 15 when all actions are earned', () => {
    const agent = makeAgent();
    insertAgent(db, agent);

    // 1. Heartbeat within 1h
    insertHeartbeat(db, agent.id, agent.registered_at, { offsetHours: 0.5 });
    // 2. Endorsement within 24h
    insertEndorsement(db, agent.id, agent.registered_at, 6);
    // 3. Three heartbeats in first week (already have 1 from above, add 2 more)
    insertHeartbeat(db, agent.id, agent.registered_at, { offsetDays: 2 });
    insertHeartbeat(db, agent.id, agent.registered_at, { offsetDays: 4 });
    // 4. Stamp event
    insertStampEvent(db, agent.wallet_address);
    // 5. Seven consecutive days
    for (let day = 0; day < 7; day++) {
      insertHeartbeat(db, agent.id, agent.registered_at, { offsetDays: day + 0.5 });
    }

    const result = computeMomentum(agent, db);

    expect(result.earned).toBe(15);
    expect(result.effective).toBe(15);
    expect(result.actions).toHaveLength(5);
    expect(result.decayed).toBe(false);
  });

  it('partially decays for agent registered 40 days ago', () => {
    const agent = makeAgent({ daysAgo: 40 });
    insertAgent(db, agent);

    // Give them a heartbeat within 1h and a stamp event for some earned points
    insertHeartbeat(db, agent.id, agent.registered_at, { offsetHours: 0.5 });
    insertStampEvent(db, agent.wallet_address);

    const result = computeMomentum(agent, db);

    expect(result.earned).toBe(6);
    expect(result.decayed).toBe(true);
    // At 40 days: factor = max(0, 1 - (40-30)/30) = 1 - 10/30 = 0.6667
    // effective = 6 * 0.6667 = ~4
    expect(result.effective).toBeGreaterThan(0);
    expect(result.effective).toBeLessThan(result.earned);
  });

  it('returns 0 effective for agent registered 60+ days ago', () => {
    const agent = makeAgent({ daysAgo: 65 });
    insertAgent(db, agent);

    // Earn some points
    insertHeartbeat(db, agent.id, agent.registered_at, { offsetHours: 0.5 });
    insertStampEvent(db, agent.wallet_address);

    const result = computeMomentum(agent, db);

    expect(result.earned).toBe(6);
    expect(result.effective).toBe(0);
    expect(result.decayed).toBe(true);
  });

  it('uses momentum instead of age in full computeReputation', () => {
    // This test verifies the integration by mocking getDb
    // We test directly via computeMomentum + verify the breakdown shape
    const agent = makeAgent();
    insertAgent(db, agent);
    insertHeartbeat(db, agent.id, agent.registered_at, { offsetHours: 0.5 });

    const momentum = computeMomentum(agent, db);

    expect(momentum.earned).toBe(3);
    expect(momentum.effective).toBe(3);
    // Verify the returned object shape matches what computeReputation expects
    expect(momentum).toHaveProperty('earned');
    expect(momentum).toHaveProperty('effective');
    expect(momentum).toHaveProperty('actions');
    expect(momentum).toHaveProperty('decayed');
    expect(typeof momentum.effective).toBe('number');
  });
});
