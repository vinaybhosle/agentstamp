const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { nanoid } = require('nanoid');
const { createTestDb } = require('./helpers');
const { computeEventHash, getChainHead, verifyChain, GENESIS_HASH } = require('../src/hashChain');

// ─── Setup: initialize crypto module with a temporary key ────────────────────

let tmpDir;
let signCertificate;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentstamp-test-'));
  const keyPath = path.join(tmpDir, 'ed25519_private.pem');

  // Override config.signingKeyPath before crypto.initialize() reads it
  const config = require('../src/config');
  config.signingKeyPath = keyPath;

  const cryptoModule = require('../src/crypto');
  cryptoModule.initialize();
  signCertificate = cryptoModule.signCertificate;
});

afterAll(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── Test helper: appendEvent with hash chain against a given db ─────────────
// Replicates the production appendEvent logic (with hash chain) but takes db
// as a parameter so we avoid module-system mocking issues.

function appendEventWithChain(db, eventType, data = {}) {
  const id = `evt_${nanoid(16)}`;
  const now = new Date().toISOString();
  const payload = JSON.stringify(data);

  const insertEvent = db.transaction(() => {
    const prevHash = getChainHead(db);
    const eventHash = computeEventHash(prevHash, eventType, payload, now);
    const signature = signCertificate({ hash: eventHash });

    db.prepare(`
      INSERT INTO event_log (id, event_type, stamp_id, agent_id, wallet_address, payload, prev_hash, event_hash, signature, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, eventType,
      data.stamp_id || null, data.agent_id || null, data.wallet_address || null,
      payload, prevHash, eventHash, signature, now
    );

    return { id, event_type: eventType, event_hash: eventHash, created_at: now };
  });

  return insertEvent();
}

// ─── computeEventHash ────────────────────────────────────────────────────────

describe('computeEventHash', () => {
  const prev = GENESIS_HASH;
  const type = 'stamp_minted';
  const payload = '{"stamp_id":"stmp_abc"}';
  const timestamp = '2026-03-19T00:00:00.000Z';

  it('produces deterministic output (same inputs = same hash)', () => {
    const hash1 = computeEventHash(prev, type, payload, timestamp);
    const hash2 = computeEventHash(prev, type, payload, timestamp);
    expect(hash1).toBe(hash2);
  });

  it('changes when prev_hash changes', () => {
    const hash1 = computeEventHash(prev, type, payload, timestamp);
    const hash2 = computeEventHash('abc123', type, payload, timestamp);
    expect(hash1).not.toBe(hash2);
  });

  it('changes when event_type changes', () => {
    const hash1 = computeEventHash(prev, type, payload, timestamp);
    const hash2 = computeEventHash(prev, 'agent_registered', payload, timestamp);
    expect(hash1).not.toBe(hash2);
  });

  it('changes when payload changes', () => {
    const hash1 = computeEventHash(prev, type, payload, timestamp);
    const hash2 = computeEventHash(prev, type, '{"stamp_id":"stmp_xyz"}', timestamp);
    expect(hash1).not.toBe(hash2);
  });

  it('changes when timestamp changes', () => {
    const hash1 = computeEventHash(prev, type, payload, timestamp);
    const hash2 = computeEventHash(prev, type, payload, '2026-03-20T00:00:00.000Z');
    expect(hash1).not.toBe(hash2);
  });

  it('returns a 64-char hex string (SHA-256)', () => {
    const hash = computeEventHash(prev, type, payload, timestamp);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ─── getChainHead ────────────────────────────────────────────────────────────

describe('getChainHead', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('returns GENESIS_HASH when event_log is empty', () => {
    expect(getChainHead(db)).toBe(GENESIS_HASH);
  });

  it('returns GENESIS_HASH when no events have event_hash set', () => {
    db.prepare(
      "INSERT INTO event_log (id, event_type, payload, created_at) VALUES ('evt_1', 'heartbeat', '{}', '2026-03-19T00:00:00Z')"
    ).run();
    expect(getChainHead(db)).toBe(GENESIS_HASH);
  });

  it('returns latest event_hash after inserting hashed events', () => {
    const hash1 = computeEventHash(GENESIS_HASH, 'stamp_minted', '{}', '2026-03-19T00:00:00Z');
    db.prepare(
      "INSERT INTO event_log (id, event_type, payload, prev_hash, event_hash, created_at) VALUES ('evt_1', 'stamp_minted', '{}', ?, ?, '2026-03-19T00:00:00Z')"
    ).run(GENESIS_HASH, hash1);

    const hash2 = computeEventHash(hash1, 'heartbeat', '{}', '2026-03-19T00:01:00Z');
    db.prepare(
      "INSERT INTO event_log (id, event_type, payload, prev_hash, event_hash, created_at) VALUES ('evt_2', 'heartbeat', '{}', ?, ?, '2026-03-19T00:01:00Z')"
    ).run(hash1, hash2);

    expect(getChainHead(db)).toBe(hash2);
  });
});

// ─── appendEvent with hash chain integration ─────────────────────────────────

describe('appendEvent (hash chain integration)', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('stores prev_hash, event_hash, and signature (not NULL)', () => {
    const result = appendEventWithChain(db, 'stamp_minted', {
      stamp_id: 'stmp_abc', wallet_address: '0x' + 'a'.repeat(40),
    });

    const row = db.prepare('SELECT * FROM event_log WHERE id = ?').get(result.id);
    expect(row.prev_hash).not.toBeNull();
    expect(row.event_hash).not.toBeNull();
    expect(row.signature).not.toBeNull();
    expect(result.event_hash).toBe(row.event_hash);
  });

  it('first event has prev_hash = GENESIS_HASH (0)', () => {
    const result = appendEventWithChain(db, 'stamp_minted', { stamp_id: 'stmp_1' });

    const row = db.prepare('SELECT * FROM event_log WHERE id = ?').get(result.id);
    expect(row.prev_hash).toBe(GENESIS_HASH);
  });

  it('second event prev_hash equals first event event_hash (chain links)', () => {
    const first = appendEventWithChain(db, 'stamp_minted', { stamp_id: 'stmp_1' });
    const second = appendEventWithChain(db, 'agent_registered', { agent_id: 'agt_1' });

    const firstRow = db.prepare('SELECT * FROM event_log WHERE id = ?').get(first.id);
    const secondRow = db.prepare('SELECT * FROM event_log WHERE id = ?').get(second.id);

    expect(secondRow.prev_hash).toBe(firstRow.event_hash);
  });
});

// ─── verifyChain ─────────────────────────────────────────────────────────────

describe('verifyChain', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('returns valid=true and length=0 for empty chain', () => {
    const result = verifyChain(db);
    expect(result.valid).toBe(true);
    expect(result.length).toBe(0);
    expect(result.gaps).toEqual([]);
    expect(result.tampered_events).toEqual([]);
  });

  it('returns valid=true for untampered chain of 3+ events', () => {
    appendEventWithChain(db, 'stamp_minted', { stamp_id: 'stmp_1' });
    appendEventWithChain(db, 'agent_registered', { agent_id: 'agt_1' });
    appendEventWithChain(db, 'heartbeat', { agent_id: 'agt_1' });

    const result = verifyChain(db);
    expect(result.valid).toBe(true);
    expect(result.length).toBe(3);
    expect(result.gaps).toEqual([]);
    expect(result.tampered_events).toEqual([]);
    expect(result.head).toBeTruthy();
  });

  it('detects tampered payload', () => {
    appendEventWithChain(db, 'stamp_minted', { stamp_id: 'stmp_1' });
    const second = appendEventWithChain(db, 'agent_registered', { agent_id: 'agt_1' });
    appendEventWithChain(db, 'heartbeat', { agent_id: 'agt_1' });

    // Tamper with the second event's payload
    db.prepare(
      "UPDATE event_log SET payload = '{\"agent_id\":\"agt_TAMPERED\"}' WHERE id = ?"
    ).run(second.id);

    const result = verifyChain(db);
    expect(result.valid).toBe(false);
    expect(result.tampered_events.length).toBeGreaterThanOrEqual(1);
    const tampered = result.tampered_events.find(t => t.event_id === second.id);
    expect(tampered).toBeTruthy();
  });

  it('detects gap when middle event is deleted', () => {
    appendEventWithChain(db, 'stamp_minted', { stamp_id: 'stmp_1' });
    const second = appendEventWithChain(db, 'agent_registered', { agent_id: 'agt_1' });
    appendEventWithChain(db, 'heartbeat', { agent_id: 'agt_1' });

    // Delete the middle event to create a gap
    db.prepare('DELETE FROM event_log WHERE id = ?').run(second.id);

    const result = verifyChain(db);
    expect(result.valid).toBe(false);
    expect(result.gaps.length).toBeGreaterThanOrEqual(1);
  });
});
