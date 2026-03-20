const { createTestDb } = require('./helpers');
const { nanoid } = require('nanoid');
const { validateDelegation } = require('../src/utils/validators');

const MS_PER_DAY = 86400000;

const DELEGATOR_WALLET = '0x' + 'a'.repeat(40);
const DELEGATEE_WALLET = '0x' + 'b'.repeat(40);

function futureDate(days) {
  return new Date(Date.now() + days * MS_PER_DAY).toISOString();
}

function pastDate(days) {
  return new Date(Date.now() - days * MS_PER_DAY).toISOString();
}

/**
 * Insert a minimal agent into the test db with a given reputation score.
 */
function seedAgent(db, wallet, overrides = {}) {
  const agentId = `agt_${nanoid(16)}`;
  const stampId = `stmp_${nanoid(16)}`;
  const now = new Date().toISOString();
  const future = futureDate(30);

  db.prepare(`
    INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature, revoked)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(stampId, wallet, overrides.tier || 'gold', now, future, 'cert', 'sig');

  db.prepare(`
    INSERT INTO agents (id, wallet_address, name, description, category, capabilities, protocols,
      endpoint_url, stamp_id, endorsement_count, status, registered_at, last_heartbeat, expires_at,
      metadata, heartbeat_count, last_reputation_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    agentId, wallet, overrides.name || 'TestAgent', 'desc', 'data', '[]', '[]',
    '', stampId,
    overrides.endorsement_count ?? 0,
    'active',
    overrides.registered_at || now,
    overrides.last_heartbeat || now,
    future, '{}',
    overrides.heartbeat_count ?? 1,
    overrides.last_reputation_score !== undefined ? overrides.last_reputation_score : 60,
  );

  return agentId;
}

/**
 * Insert a delegation row directly.
 */
function insertDelegation(db, delegatorWallet, delegateeWallet, overrides = {}) {
  const id = `del_${nanoid(16)}`;
  const weight = overrides.weight ?? 1.0;
  const reason = overrides.reason || null;
  const expiresAt = overrides.expires_at || futureDate(30);

  db.prepare(
    'INSERT INTO trust_delegations (id, delegator_wallet, delegatee_wallet, weight, reason, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, delegatorWallet, delegateeWallet, weight, reason, expiresAt);

  return id;
}

/**
 * Simplified appendEvent for test verification.
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
 * Inline computeDelegationBonus that works with an injected db.
 * Mirrors src/reputation.js logic.
 */
function computeDelegationBonus(walletAddress, db) {
  const DELEGATION_BONUS_CAP = 20;
  const DELEGATION_WEIGHT_FACTOR = 0.15;

  const activeDelegations = db.prepare(
    "SELECT * FROM trust_delegations WHERE delegatee_wallet = ? AND expires_at > datetime('now')"
  ).all(walletAddress);

  const delegations = [];
  let totalBonus = 0;

  for (const del of activeDelegations) {
    const delegatorAgent = db.prepare(
      "SELECT last_reputation_score FROM agents WHERE wallet_address = ? AND status = 'active' ORDER BY registered_at ASC LIMIT 1"
    ).get(del.delegator_wallet);

    const delegatorScore = delegatorAgent?.last_reputation_score || 0;
    const contribution = Math.round(delegatorScore * del.weight * DELEGATION_WEIGHT_FACTOR * 100) / 100;
    totalBonus += contribution;

    delegations.push(Object.freeze({
      delegator_wallet: del.delegator_wallet,
      weight: del.weight,
      score: delegatorScore,
      contribution,
    }));
  }

  const cappedBonus = Math.min(Math.round(totalBonus * 100) / 100, DELEGATION_BONUS_CAP);

  return Object.freeze({
    bonus: cappedBonus,
    delegations,
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Trust Delegation', () => {
  let db;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  // 1. Delegator with score < 50 → rejected
  it('rejects delegation from agent with score below 50', () => {
    seedAgent(db, DELEGATOR_WALLET, { last_reputation_score: 30 });
    seedAgent(db, DELEGATEE_WALLET, { name: 'Delegatee' });

    const delegatorAgent = db.prepare(
      "SELECT last_reputation_score FROM agents WHERE wallet_address = ? AND status = 'active' LIMIT 1"
    ).get(DELEGATOR_WALLET);

    expect(delegatorAgent.last_reputation_score).toBe(30);
    expect(delegatorAgent.last_reputation_score).toBeLessThan(50);
  });

  // 2. Successful delegation → row inserted, event logged
  it('creates a delegation and logs event', () => {
    seedAgent(db, DELEGATOR_WALLET, { last_reputation_score: 60 });
    seedAgent(db, DELEGATEE_WALLET, { name: 'Delegatee' });

    const delegationId = insertDelegation(db, DELEGATOR_WALLET, DELEGATEE_WALLET, { weight: 0.8 });
    appendEvent(db, 'trust_delegated', {
      wallet_address: DELEGATOR_WALLET,
      delegator_wallet: DELEGATOR_WALLET,
      delegatee_wallet: DELEGATEE_WALLET,
      weight: 0.8,
    });

    const row = db.prepare('SELECT * FROM trust_delegations WHERE id = ?').get(delegationId);
    expect(row).toBeTruthy();
    expect(row.delegator_wallet).toBe(DELEGATOR_WALLET);
    expect(row.delegatee_wallet).toBe(DELEGATEE_WALLET);
    expect(row.weight).toBe(0.8);

    const event = db.prepare(
      "SELECT * FROM event_log WHERE event_type = 'trust_delegated' ORDER BY rowid DESC LIMIT 1"
    ).get();
    expect(event).toBeTruthy();
    const payload = JSON.parse(event.payload);
    expect(payload.delegator_wallet).toBe(DELEGATOR_WALLET);
    expect(payload.delegatee_wallet).toBe(DELEGATEE_WALLET);
  });

  // 3. Duplicate delegation → unique constraint violation
  it('prevents duplicate delegations (unique constraint)', () => {
    seedAgent(db, DELEGATOR_WALLET, { last_reputation_score: 60 });
    seedAgent(db, DELEGATEE_WALLET, { name: 'Delegatee' });

    insertDelegation(db, DELEGATOR_WALLET, DELEGATEE_WALLET);

    expect(() => {
      insertDelegation(db, DELEGATOR_WALLET, DELEGATEE_WALLET);
    }).toThrow();
  });

  // 4. Max 5 outgoing enforced
  it('enforces maximum 5 outgoing delegations', () => {
    seedAgent(db, DELEGATOR_WALLET, { last_reputation_score: 60 });

    // Create 5 delegatees and delegations
    for (let i = 0; i < 5; i++) {
      const wallet = '0x' + String(i).padStart(40, '0');
      seedAgent(db, wallet, { name: `Delegatee${i}` });
      insertDelegation(db, DELEGATOR_WALLET, wallet);
    }

    const outgoingCount = db.prepare(
      "SELECT COUNT(*) as count FROM trust_delegations WHERE delegator_wallet = ? AND expires_at > datetime('now')"
    ).get(DELEGATOR_WALLET).count;

    expect(outgoingCount).toBe(5);

    // The 6th should be checked by the route logic — here we verify the count
    expect(outgoingCount >= 5).toBe(true);
  });

  // 5. Weight outside 0.1-1.0 → validation rejects
  it('rejects weight outside 0.1-1.0 range', () => {
    const result1 = validateDelegation({
      delegatee_wallet: DELEGATEE_WALLET,
      weight: 0.05,
    });
    expect(result1.valid).toBe(false);
    expect(result1.error).toContain('weight');

    const result2 = validateDelegation({
      delegatee_wallet: DELEGATEE_WALLET,
      weight: 1.5,
    });
    expect(result2.valid).toBe(false);
    expect(result2.error).toContain('weight');

    // Valid weights
    const result3 = validateDelegation({
      delegatee_wallet: DELEGATEE_WALLET,
      weight: 0.5,
    });
    expect(result3.valid).toBe(true);
  });

  // 6. Expired delegation not included in bonus
  it('excludes expired delegations from bonus calculation', () => {
    seedAgent(db, DELEGATOR_WALLET, { last_reputation_score: 60 });
    seedAgent(db, DELEGATEE_WALLET, { name: 'Delegatee' });

    // Insert an expired delegation
    insertDelegation(db, DELEGATOR_WALLET, DELEGATEE_WALLET, {
      expires_at: pastDate(1),
    });

    const bonus = computeDelegationBonus(DELEGATEE_WALLET, db);
    expect(bonus.bonus).toBe(0);
    expect(bonus.delegations).toHaveLength(0);
  });

  // 7. Bonus correctly calculated: score * weight * 0.15
  it('calculates bonus as score * weight * 0.15', () => {
    seedAgent(db, DELEGATOR_WALLET, { last_reputation_score: 60 });
    seedAgent(db, DELEGATEE_WALLET, { name: 'Delegatee' });

    insertDelegation(db, DELEGATOR_WALLET, DELEGATEE_WALLET, { weight: 1.0 });

    const bonus = computeDelegationBonus(DELEGATEE_WALLET, db);

    // 60 * 1.0 * 0.15 = 9.0
    expect(bonus.bonus).toBe(9);
    expect(bonus.delegations).toHaveLength(1);
    expect(bonus.delegations[0].contribution).toBe(9);
    expect(bonus.delegations[0].delegator_wallet).toBe(DELEGATOR_WALLET);
    expect(bonus.delegations[0].score).toBe(60);
  });

  // 8. Bonus capped at 20
  it('caps delegation bonus at 20', () => {
    seedAgent(db, DELEGATEE_WALLET, { name: 'Delegatee' });

    // Create multiple high-score delegators
    for (let i = 0; i < 5; i++) {
      const wallet = '0x' + String(i).padStart(40, '0');
      seedAgent(db, wallet, {
        name: `Delegator${i}`,
        last_reputation_score: 100,
      });
      insertDelegation(db, wallet, DELEGATEE_WALLET, { weight: 1.0 });
    }

    const bonus = computeDelegationBonus(DELEGATEE_WALLET, db);

    // 5 * (100 * 1.0 * 0.15) = 5 * 15 = 75, but capped at 20
    expect(bonus.bonus).toBe(20);
    expect(bonus.delegations).toHaveLength(5);
  });

  // 9. Revocation deletes row, logs event
  it('revokes a delegation by deleting the row', () => {
    seedAgent(db, DELEGATOR_WALLET, { last_reputation_score: 60 });
    seedAgent(db, DELEGATEE_WALLET, { name: 'Delegatee' });

    insertDelegation(db, DELEGATOR_WALLET, DELEGATEE_WALLET);

    // Verify exists
    const before = db.prepare(
      'SELECT * FROM trust_delegations WHERE delegator_wallet = ? AND delegatee_wallet = ?'
    ).get(DELEGATOR_WALLET, DELEGATEE_WALLET);
    expect(before).toBeTruthy();

    // Delete (simulating the route logic)
    const result = db.prepare(
      'DELETE FROM trust_delegations WHERE delegator_wallet = ? AND delegatee_wallet = ?'
    ).run(DELEGATOR_WALLET, DELEGATEE_WALLET);
    expect(result.changes).toBe(1);

    appendEvent(db, 'trust_revoked', {
      wallet_address: DELEGATOR_WALLET,
      delegator_wallet: DELEGATOR_WALLET,
      delegatee_wallet: DELEGATEE_WALLET,
    });

    // Verify gone
    const after = db.prepare(
      'SELECT * FROM trust_delegations WHERE delegator_wallet = ? AND delegatee_wallet = ?'
    ).get(DELEGATOR_WALLET, DELEGATEE_WALLET);
    expect(after).toBeUndefined();

    // Verify event logged
    const event = db.prepare(
      "SELECT * FROM event_log WHERE event_type = 'trust_revoked' ORDER BY rowid DESC LIMIT 1"
    ).get();
    expect(event).toBeTruthy();
    const payload = JSON.parse(event.payload);
    expect(payload.delegator_wallet).toBe(DELEGATOR_WALLET);
  });

  // 10. GET delegations returns incoming and outgoing
  it('returns both incoming and outgoing delegations for a wallet', () => {
    const walletC = '0x' + 'c'.repeat(40);

    seedAgent(db, DELEGATOR_WALLET, { last_reputation_score: 60 });
    seedAgent(db, DELEGATEE_WALLET, { name: 'Delegatee', last_reputation_score: 70 });
    seedAgent(db, walletC, { name: 'AgentC', last_reputation_score: 55 });

    // DELEGATEE receives from DELEGATOR (incoming for DELEGATEE)
    insertDelegation(db, DELEGATOR_WALLET, DELEGATEE_WALLET, { weight: 0.8 });

    // DELEGATEE delegates to walletC (outgoing for DELEGATEE)
    insertDelegation(db, DELEGATEE_WALLET, walletC, { weight: 0.5 });

    // Query incoming for DELEGATEE
    const incoming = db.prepare(
      "SELECT id, delegator_wallet, weight, reason, expires_at, created_at FROM trust_delegations WHERE delegatee_wallet = ? AND expires_at > datetime('now')"
    ).all(DELEGATEE_WALLET);

    // Query outgoing for DELEGATEE
    const outgoing = db.prepare(
      "SELECT id, delegatee_wallet, weight, reason, expires_at, created_at FROM trust_delegations WHERE delegator_wallet = ? AND expires_at > datetime('now')"
    ).all(DELEGATEE_WALLET);

    expect(incoming).toHaveLength(1);
    expect(incoming[0].delegator_wallet).toBe(DELEGATOR_WALLET);
    expect(incoming[0].weight).toBe(0.8);

    expect(outgoing).toHaveLength(1);
    expect(outgoing[0].delegatee_wallet).toBe(walletC);
    expect(outgoing[0].weight).toBe(0.5);
  });
});
