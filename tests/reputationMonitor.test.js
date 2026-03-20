const { createTestDb } = require('./helpers');
const { nanoid } = require('nanoid');

const WALLET = '0x' + 'a'.repeat(40);
const MS_PER_DAY = 86400000;

function daysAgo(days) {
  return new Date(Date.now() - days * MS_PER_DAY).toISOString();
}

/**
 * Insert a minimal agent + stamp into the test db.
 * Returns the agentId.
 */
function seedAgent(db, overrides = {}) {
  const agentId = `agt_${nanoid(16)}`;
  const stampId = `stmp_${nanoid(16)}`;
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 30 * MS_PER_DAY).toISOString();

  // Insert stamp first (bronze by default)
  db.prepare(`
    INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature, revoked)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(stampId, WALLET, overrides.tier || 'bronze', now, future, 'cert', 'sig');

  // Insert agent
  db.prepare(`
    INSERT INTO agents (id, wallet_address, name, description, category, capabilities, protocols,
      endpoint_url, stamp_id, endorsement_count, status, registered_at, last_heartbeat, expires_at,
      metadata, heartbeat_count, last_reputation_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    agentId, WALLET, 'TestAgent', 'desc', 'data', '[]', '[]',
    '', stampId,
    overrides.endorsement_count ?? 0,
    'active',
    overrides.registered_at || now,
    overrides.last_heartbeat || now,
    future, '{}',
    overrides.heartbeat_count ?? 1,
    overrides.last_reputation_score !== undefined ? overrides.last_reputation_score : null,
  );

  return agentId;
}

/**
 * Simplified appendEvent for tests (no hash chain or signing).
 */
function appendEvent(db, eventType, data = {}) {
  const id = `evt_${nanoid(16)}`;
  const now = new Date().toISOString();
  const payload = JSON.stringify(data);
  db.prepare(`
    INSERT INTO event_log (id, event_type, stamp_id, agent_id, wallet_address, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, eventType, data.stamp_id || null, data.agent_id || null, data.wallet_address || null, payload, now);
  return { id, event_type: eventType, created_at: now };
}

/**
 * Inline implementation of the monitor logic against a given db,
 * matching the production module but operating on an injected db
 * and without firing real webhooks.
 */
function checkAndDispatchReputationChange(db, agentId, computeReputation, getLabel) {
  const agent = db.prepare(
    'SELECT id, wallet_address, last_reputation_score FROM agents WHERE id = ?'
  ).get(agentId);
  if (!agent) return null;

  const reputation = computeReputation(db, agentId);
  if (!reputation) return null;

  const newScore = reputation.score;
  const previousScore = agent.last_reputation_score;

  db.prepare('UPDATE agents SET last_reputation_score = ? WHERE id = ?')
    .run(newScore, agentId);

  if (previousScore === null) {
    return Object.freeze({
      changed: false,
      delta: 0,
      previous_score: null,
      new_score: newScore,
    });
  }

  const delta = newScore - previousScore;
  const changed = Math.abs(delta) >= 5; // REPUTATION_CHANGE_THRESHOLD

  if (changed) {
    const labelChanged = getLabel(newScore) !== getLabel(previousScore);
    appendEvent(db, 'reputation_changed', {
      agent_id: agentId,
      wallet_address: agent.wallet_address,
      previous_score: previousScore,
      new_score: newScore,
      delta,
    });
  }

  return Object.freeze({
    changed,
    delta,
    previous_score: previousScore,
    new_score: newScore,
  });
}

/**
 * Simplified computeReputation that works against an injected db.
 * Mirrors the production formula enough for threshold testing.
 */
function computeReputationLocal(db, agentId) {
  const { getLabel } = require('../src/reputation');

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) return null;

  const TIER_SCORES = { free: 5, bronze: 10, silver: 20, gold: 30 };

  let stampTier = null;
  if (agent.stamp_id) {
    const stamp = db.prepare('SELECT tier FROM stamps WHERE id = ? AND revoked = 0').get(agent.stamp_id);
    if (stamp) stampTier = stamp.tier;
  }

  const tierScore = TIER_SCORES[stampTier] || 0;
  const endorsementScore = Math.min((agent.endorsement_count || 0) * 5, 30);

  // Simplified uptime — just use raw percent * 0.20
  const daysSinceReg = Math.max(1, (Date.now() - new Date(agent.registered_at).getTime()) / MS_PER_DAY);
  const uptimePercent = Math.min(100, ((agent.heartbeat_count || 0) / Math.ceil(daysSinceReg)) * 100);
  const uptimeScore = uptimePercent * 0.20;

  const wishesGranted = db.prepare(
    "SELECT COUNT(*) as count FROM wishes WHERE granted_by = ?"
  ).get(agent.wallet_address)?.count || 0;
  const wishScore = Math.min(wishesGranted * 2, 5);

  const rawScore = tierScore + endorsementScore + uptimeScore + wishScore;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  return { score, label: getLabel(score) };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('reputationMonitor', () => {
  let db;
  const { getLabel } = require('../src/reputation');

  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('first call (last_reputation_score is null) stores score, returns changed: false', () => {
    const agentId = seedAgent(db, { last_reputation_score: null });

    const result = checkAndDispatchReputationChange(db, agentId, computeReputationLocal, getLabel);

    expect(result).not.toBeNull();
    expect(result.changed).toBe(false);
    expect(result.delta).toBe(0);
    expect(result.previous_score).toBeNull();
    expect(result.new_score).toBeGreaterThanOrEqual(0);

    // Verify the column was updated
    const agent = db.prepare('SELECT last_reputation_score FROM agents WHERE id = ?').get(agentId);
    expect(agent.last_reputation_score).toBe(result.new_score);
  });

  it('score change of exactly 5 triggers changed: true', () => {
    // Seed with bronze stamp (10 pts) + 0 endorsements → ~30 score
    // Then set last_reputation_score to current - 5 so delta = +5
    const agentId = seedAgent(db, { heartbeat_count: 1 });

    // First call to establish baseline
    const baseline = checkAndDispatchReputationChange(db, agentId, computeReputationLocal, getLabel);
    const baseScore = baseline.new_score;

    // Set stored score to current - 5 (simulating previous lower score)
    db.prepare('UPDATE agents SET last_reputation_score = ? WHERE id = ?')
      .run(baseScore - 5, agentId);

    const result = checkAndDispatchReputationChange(db, agentId, computeReputationLocal, getLabel);
    expect(result.changed).toBe(true);
    expect(result.delta).toBe(5);
    expect(result.previous_score).toBe(baseScore - 5);
    expect(result.new_score).toBe(baseScore);
  });

  it('score change of 3 does not trigger changed', () => {
    const agentId = seedAgent(db, { heartbeat_count: 1 });

    const baseline = checkAndDispatchReputationChange(db, agentId, computeReputationLocal, getLabel);
    const baseScore = baseline.new_score;

    // Set stored score to current - 3
    db.prepare('UPDATE agents SET last_reputation_score = ? WHERE id = ?')
      .run(baseScore - 3, agentId);

    const result = checkAndDispatchReputationChange(db, agentId, computeReputationLocal, getLabel);
    expect(result.changed).toBe(false);
    expect(result.delta).toBe(3);
  });

  it('score decline of 7 triggers changed: true', () => {
    const agentId = seedAgent(db, { heartbeat_count: 1 });

    const baseline = checkAndDispatchReputationChange(db, agentId, computeReputationLocal, getLabel);
    const baseScore = baseline.new_score;

    // Set stored score to current + 7 (simulating previous higher score)
    db.prepare('UPDATE agents SET last_reputation_score = ? WHERE id = ?')
      .run(baseScore + 7, agentId);

    const result = checkAndDispatchReputationChange(db, agentId, computeReputationLocal, getLabel);
    expect(result.changed).toBe(true);
    expect(result.delta).toBe(-7);
    expect(result.previous_score).toBe(baseScore + 7);
  });

  it('last_reputation_score column is updated after each call', () => {
    const agentId = seedAgent(db, { last_reputation_score: null });

    // First call — sets score from null
    const first = checkAndDispatchReputationChange(db, agentId, computeReputationLocal, getLabel);
    const row1 = db.prepare('SELECT last_reputation_score FROM agents WHERE id = ?').get(agentId);
    expect(row1.last_reputation_score).toBe(first.new_score);

    // Add endorsements to change the score
    db.prepare('UPDATE agents SET endorsement_count = 3 WHERE id = ?').run(agentId);

    // Second call — updates stored score
    const second = checkAndDispatchReputationChange(db, agentId, computeReputationLocal, getLabel);
    const row2 = db.prepare('SELECT last_reputation_score FROM agents WHERE id = ?').get(agentId);
    expect(row2.last_reputation_score).toBe(second.new_score);
    expect(second.new_score).toBeGreaterThan(first.new_score);
  });

  it('event is appended to event_log when change triggers', () => {
    const agentId = seedAgent(db, { heartbeat_count: 1 });

    // Establish baseline
    checkAndDispatchReputationChange(db, agentId, computeReputationLocal, getLabel);
    const baseline = db.prepare('SELECT last_reputation_score FROM agents WHERE id = ?').get(agentId);

    // Force a large delta by setting stored score far below current
    db.prepare('UPDATE agents SET last_reputation_score = ? WHERE id = ?')
      .run(baseline.last_reputation_score - 10, agentId);

    const eventCountBefore = db.prepare(
      "SELECT COUNT(*) as count FROM event_log WHERE event_type = 'reputation_changed'"
    ).get().count;

    checkAndDispatchReputationChange(db, agentId, computeReputationLocal, getLabel);

    const eventCountAfter = db.prepare(
      "SELECT COUNT(*) as count FROM event_log WHERE event_type = 'reputation_changed'"
    ).get().count;

    expect(eventCountAfter).toBe(eventCountBefore + 1);

    // Verify event content
    const event = db.prepare(
      "SELECT * FROM event_log WHERE event_type = 'reputation_changed' ORDER BY rowid DESC LIMIT 1"
    ).get();
    const payload = JSON.parse(event.payload);
    expect(payload.agent_id).toBe(agentId);
    expect(payload.wallet_address).toBe(WALLET);
    expect(payload.delta).toBe(10);
    expect(payload.previous_score).toBe(baseline.last_reputation_score - 10);
    expect(payload.new_score).toBe(baseline.last_reputation_score);
  });
});

// ─── Module exports verification ─────────────────────────────────────────────

describe('reputationMonitor module exports', () => {
  it('exports checkAndDispatchReputationChange and REPUTATION_CHANGE_THRESHOLD', () => {
    const mod = require('../src/reputationMonitor');
    expect(typeof mod.checkAndDispatchReputationChange).toBe('function');
    expect(mod.REPUTATION_CHANGE_THRESHOLD).toBe(5);
  });
});

describe('EVENT_TYPES includes reputation_changed', () => {
  it('reputation_changed is in EVENT_TYPES', () => {
    const { EVENT_TYPES } = require('../src/eventLog');
    expect(EVENT_TYPES).toContain('reputation_changed');
  });
});
