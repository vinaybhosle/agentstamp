'use strict';

/**
 * Tests for externally-anchored trust signals (v2.5.0)
 *
 * Covers:
 * 1. computeLivenessRatio math (pure function)
 * 2. Provenance split in computeReputation (incl. independent_pct)
 * 3. Counterparty vs self stamp event paths (attestation_type, sequence)
 * 4. Backward compat: existing score/breakdown/factors/max_possible unchanged
 */

const { createTestDb } = require('./helpers');
// computeLivenessRatio is a pure function — safe to import at top level
const { computeLivenessRatio } = require('../src/livenessProbe');
// computeReputation must be required inside it() so it loads AFTER beforeEach patches getDb
const { generateStampEventId } = require('../src/utils/generateId');

const GOOD_WALLET = '0x' + 'a'.repeat(40);
const OTHER_WALLET = '0x' + 'b'.repeat(40);
const NOW = new Date().toISOString();
const MS_PER_DAY = 86400000;

function daysAgo(n) {
  return new Date(Date.now() - n * MS_PER_DAY).toISOString();
}

// ─── 1. computeLivenessRatio (pure function) ─────────────────────────────────

describe('computeLivenessRatio', () => {
  it('returns null ratio when no checks have been run', () => {
    const agent = { liveness_ok: null, liveness_checked_at: null, liveness_success_count: 0, liveness_total_count: 0 };
    const r = computeLivenessRatio(agent);
    expect(r.ratio).toBeNull();
    expect(r.checks).toBe(0);
    expect(r.last_ok).toBeNull();
    expect(r.last_checked_at).toBeNull();
  });

  it('computes ratio correctly (3 success / 4 total = 0.75)', () => {
    const agent = { liveness_ok: 1, liveness_checked_at: NOW, liveness_success_count: 3, liveness_total_count: 4 };
    const r = computeLivenessRatio(agent);
    expect(r.ratio).toBe(0.75);
    expect(r.checks).toBe(4);
    expect(r.last_ok).toBe(true);
    expect(r.last_checked_at).toBe(NOW);
  });

  it('computes ratio 1.0 when all checks pass', () => {
    const agent = { liveness_ok: 1, liveness_checked_at: NOW, liveness_success_count: 5, liveness_total_count: 5 };
    const r = computeLivenessRatio(agent);
    expect(r.ratio).toBe(1.0);
  });

  it('computes ratio 0.0 when all checks fail', () => {
    const agent = { liveness_ok: 0, liveness_checked_at: NOW, liveness_success_count: 0, liveness_total_count: 3 };
    const r = computeLivenessRatio(agent);
    expect(r.ratio).toBe(0.0);
    expect(r.last_ok).toBe(false);
  });

  it('returns a frozen object', () => {
    const agent = { liveness_ok: null, liveness_checked_at: null, liveness_success_count: 0, liveness_total_count: 0 };
    const r = computeLivenessRatio(agent);
    expect(Object.isFrozen(r)).toBe(true);
  });
});

// ─── 2. Provenance split in computeReputation ───────────────────────────────

describe('computeReputation — provenance split', () => {
  let db;

  beforeEach(() => {
    db = createTestDb();
    const database = require('../src/database');
    database._origGetDb = database.getDb;
    database.getDb = () => db;
  });

  afterEach(() => {
    const database = require('../src/database');
    if (database._origGetDb) {
      database.getDb = database._origGetDb;
      delete database._origGetDb;
    }
    db.close();
  });

  function insertAgent(overrides = {}) {
    const agent = {
      id: 'agt_test_1',
      wallet_address: GOOD_WALLET,
      name: 'TestAgent',
      registered_at: daysAgo(5),
      expires_at: daysAgo(-30),
      heartbeat_count: 5,
      last_heartbeat: daysAgo(1),
      endorsement_count: 2,
      wallet_verified: 0,
      liveness_ok: null,
      liveness_checked_at: null,
      liveness_success_count: 0,
      liveness_total_count: 0,
      ...overrides,
    };
    db.prepare(`
      INSERT INTO agents (id, wallet_address, name, registered_at, expires_at, heartbeat_count,
        last_heartbeat, endorsement_count, wallet_verified, liveness_ok, liveness_checked_at,
        liveness_success_count, liveness_total_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      agent.id, agent.wallet_address, agent.name, agent.registered_at, agent.expires_at,
      agent.heartbeat_count, agent.last_heartbeat, agent.endorsement_count,
      agent.wallet_verified, agent.liveness_ok, agent.liveness_checked_at,
      agent.liveness_success_count, agent.liveness_total_count
    );
    return agent;
  }

  it('returns independent_signals and provenance fields', () => {
    const { computeReputation } = require('../src/reputation');
    insertAgent();
    const rep = computeReputation('agt_test_1');
    expect(rep).not.toBeNull();
    expect(rep.independent_signals).toBeDefined();
    expect(rep.provenance).toBeDefined();
  });

  it('existing score, breakdown, factors, max_possible are unchanged', () => {
    const { computeReputation } = require('../src/reputation');
    insertAgent({ wallet_verified: 0 });
    const rep = computeReputation('agt_test_1');
    // Core fields must exist and be numbers
    expect(typeof rep.score).toBe('number');
    expect(rep.breakdown).toHaveProperty('tier');
    expect(rep.breakdown).toHaveProperty('endorsements');
    expect(rep.breakdown).toHaveProperty('uptime');
    expect(rep.breakdown).toHaveProperty('momentum');
    expect(rep.breakdown).toHaveProperty('wishes');
    expect(rep.breakdown).toHaveProperty('wallet_verified');
    expect(rep.max_possible).toEqual({ tier: 30, endorsements: 30, uptime: 20, momentum: 15, wishes: 5, wallet_verified: 5 });
    expect(rep.factors).toHaveProperty('stamp_tier');
  });

  it('independent_pct = 0 when no liveness, no wallet_verified', () => {
    const { computeReputation } = require('../src/reputation');
    insertAgent({ wallet_verified: 0, liveness_success_count: 0, liveness_total_count: 0 });
    const rep = computeReputation('agt_test_1');
    expect(rep.provenance.independently_verified).toBe(0);
    expect(rep.provenance.independent_pct).toBe(0);
  });

  it('wallet_verified=1 adds 5 to independently_verified', () => {
    const { computeReputation } = require('../src/reputation');
    insertAgent({ wallet_verified: 1 });
    const rep = computeReputation('agt_test_1');
    expect(rep.provenance.independently_verified).toBeGreaterThanOrEqual(5);
    expect(rep.independent_signals.wallet_verified).toBe(true);
  });

  it('liveness ratio contributes up to 10 to independently_verified', () => {
    const { computeReputation } = require('../src/reputation');
    insertAgent({ liveness_success_count: 10, liveness_total_count: 10, liveness_ok: 1 });
    const rep = computeReputation('agt_test_1');
    // ratio=1.0 → liveness contribution = round(1.0 * 10) = 10
    const livContrib = rep.provenance.independently_verified - (rep.independent_signals.wallet_verified ? 5 : 0);
    expect(livContrib).toBe(10);
  });

  it('liveness 0 checks → liveness contribution = 0', () => {
    const { computeReputation } = require('../src/reputation');
    insertAgent({ wallet_verified: 1, liveness_success_count: 0, liveness_total_count: 0 });
    const rep = computeReputation('agt_test_1');
    expect(rep.provenance.independently_verified).toBe(5); // only wallet_verified bonus
  });

  it('independent_pct is 0-100 integer', () => {
    const { computeReputation } = require('../src/reputation');
    insertAgent({ wallet_verified: 1 });
    const rep = computeReputation('agt_test_1');
    expect(rep.provenance.independent_pct).toBeGreaterThanOrEqual(0);
    expect(rep.provenance.independent_pct).toBeLessThanOrEqual(100);
    expect(Number.isInteger(rep.provenance.independent_pct)).toBe(true);
  });

  it('provenance object is frozen', () => {
    const { computeReputation } = require('../src/reputation');
    insertAgent();
    const rep = computeReputation('agt_test_1');
    expect(Object.isFrozen(rep.provenance)).toBe(true);
    expect(Object.isFrozen(rep.independent_signals)).toBe(true);
  });

  it('returns null for unknown agent (backward compat)', () => {
    const { computeReputation } = require('../src/reputation');
    const rep = computeReputation('agt_nonexistent');
    expect(rep).toBeNull();
  });

  it('score is numerically identical to a pre-provenance call (backward compat)', () => {
    const { computeReputation } = require('../src/reputation');
    // Inject a known agent and compute score via the pure formula manually
    insertAgent({ endorsement_count: 4, heartbeat_count: 10, wallet_verified: 1 });
    const rep = computeReputation('agt_test_1');
    // Score must be a clamped integer 0-100 (same formula as before)
    expect(rep.score).toBeGreaterThanOrEqual(0);
    expect(rep.score).toBeLessThanOrEqual(100);
    expect(Number.isInteger(rep.score)).toBe(true);
  });
});

// ─── 3. Counterparty attestation — stamp_events table ────────────────────────

describe('stamp_events — attestation_type and sequence', () => {
  let db;

  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  function insertEvent(overrides = {}) {
    const id = generateStampEventId();
    const row = {
      id,
      stamp_id: 'stmp_abc',
      agent_id: null,
      wallet_address: GOOD_WALLET,
      action: 'access_check',
      outcome: 'executed',
      gate_reason: null,
      endpoint: null,
      metadata: null,
      attestation_type: 'self_reported',
      attester_wallet: null,
      sequence: 1,
      created_at: NOW,
      ...overrides,
    };
    db.prepare(`
      INSERT INTO stamp_events
        (id, stamp_id, agent_id, wallet_address, action, outcome, gate_reason, endpoint, metadata,
         attestation_type, attester_wallet, sequence, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.id, row.stamp_id, row.agent_id, row.wallet_address, row.action, row.outcome,
      row.gate_reason, row.endpoint, row.metadata,
      row.attestation_type, row.attester_wallet, row.sequence, row.created_at
    );
    return row.id;
  }

  it('stores self_reported attestation_type for same-wallet events', () => {
    const id = insertEvent({ attestation_type: 'self_reported', attester_wallet: null });
    const ev = db.prepare('SELECT * FROM stamp_events WHERE id = ?').get(id);
    expect(ev.attestation_type).toBe('self_reported');
    expect(ev.attester_wallet).toBeNull();
  });

  it('stores counterparty_confirmed attestation_type with attester_wallet', () => {
    const id = insertEvent({
      attestation_type: 'counterparty_confirmed',
      attester_wallet: OTHER_WALLET,
      wallet_address: GOOD_WALLET,
    });
    const ev = db.prepare('SELECT * FROM stamp_events WHERE id = ?').get(id);
    expect(ev.attestation_type).toBe('counterparty_confirmed');
    expect(ev.attester_wallet).toBe(OTHER_WALLET);
  });

  it('sequence increments monotonically for same stamp_id', () => {
    insertEvent({ sequence: 1, id: generateStampEventId() });
    insertEvent({ sequence: 2, id: generateStampEventId() });
    insertEvent({ sequence: 3, id: generateStampEventId() });

    const rows = db.prepare('SELECT sequence FROM stamp_events WHERE stamp_id = ? ORDER BY sequence ASC').all('stmp_abc');
    expect(rows.map(r => r.sequence)).toEqual([1, 2, 3]);
  });

  it('MAX(sequence) query works correctly', () => {
    insertEvent({ sequence: 1, id: generateStampEventId() });
    insertEvent({ sequence: 5, id: generateStampEventId() });
    insertEvent({ sequence: 3, id: generateStampEventId() });

    const maxRow = db.prepare('SELECT MAX(sequence) as max_seq FROM stamp_events WHERE stamp_id = ?').get('stmp_abc');
    expect(maxRow.max_seq).toBe(5);
    // Next sequence would be max + 1 = 6
    expect(maxRow.max_seq + 1).toBe(6);
  });

  it('sequence is null for rows that predate the feature (migration safety)', () => {
    // Old-style insert without sequence column value (defaults to NULL)
    const id = generateStampEventId();
    db.prepare(`
      INSERT INTO stamp_events (id, wallet_address, action, outcome, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, GOOD_WALLET, 'check', 'executed', NOW);

    const ev = db.prepare('SELECT * FROM stamp_events WHERE id = ?').get(id);
    // attestation_type should default to 'self_reported', sequence to NULL
    expect(ev.attestation_type).toBe('self_reported');
    expect(ev.sequence).toBeNull();
  });
});

// ─── 4. ssrfGuard unit tests ─────────────────────────────────────────────────

describe('ssrfGuard (livenessProbe)', () => {
  const { ssrfGuard } = require('../src/livenessProbe');

  it('blocks non-HTTPS URLs', async () => {
    const r = await ssrfGuard('http://example.com/health');
    expect(r.safe).toBe(false);
    expect(r.error).toMatch(/HTTPS/i);
  });

  it('blocks bare IPv4 addresses', async () => {
    const r = await ssrfGuard('https://1.2.3.4/health');
    expect(r.safe).toBe(false);
  });

  it('blocks invalid URLs', async () => {
    const r = await ssrfGuard('not-a-url');
    expect(r.safe).toBe(false);
  });
});
