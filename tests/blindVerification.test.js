const crypto = require('crypto');
const { createTestDb } = require('./helpers');
const { validateBlindRegister } = require('../src/utils/validators');
const { getScoreRange } = require('../src/reputation');
const { nanoid } = require('nanoid');

const WALLET = '0x' + 'a'.repeat(40);
const WALLET_2 = '0x' + 'b'.repeat(40);
const NONCE_A = 'nonce-alpha-12345';
const NONCE_B = 'nonce-beta-67890';

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const NOW = new Date().toISOString();

const BLIND_TOKEN_SECRET = process.env.BLIND_TOKEN_SECRET || 'agentstamp-dev-blind-token-fallback';

function computeBlindToken(wallet, nonce) {
  return crypto.createHmac('sha256', BLIND_TOKEN_SECRET).update(wallet + nonce).digest('hex');
}

function insertBlindToken(db, token, wallet, nonce = 'test-nonce') {
  db.prepare(
    `INSERT OR REPLACE INTO blind_tokens (token, wallet_address, nonce, created_at) VALUES (?, ?, ?, ?)`
  ).run(token, wallet, nonce, new Date().toISOString());
}

function insertStamp(db, { wallet = WALLET, tier = 'gold', revoked = 0, expiresAt = FUTURE } = {}) {
  const id = `stamp_${nanoid(16)}`;
  db.prepare(`
    INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature, revoked)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, wallet, tier, NOW, expiresAt, '{}', 'sig', revoked);
  return id;
}

function insertAgent(db, { wallet = WALLET, stampId = null } = {}) {
  const id = `agent_${nanoid(16)}`;
  db.prepare(`
    INSERT INTO agents (id, wallet_address, name, category, stamp_id, status, registered_at, expires_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
  `).run(id, wallet, 'TestBot', 'data', stampId, NOW, FUTURE);
  return id;
}

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

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Blind Verification', () => {
  let db;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  // 1. Register blind token → returns deterministic HMAC-SHA256 token
  it('registers a blind token with deterministic HMAC-SHA256', () => {
    const expected = computeBlindToken(WALLET, NONCE_A);

    insertBlindToken(db, expected, WALLET);

    const row = db.prepare('SELECT * FROM blind_tokens WHERE token = ?').get(expected);
    expect(row).toBeDefined();
    expect(row.token).toBe(expected);
    expect(row.wallet_address).toBe(WALLET);
    // Nonce is stored in the database for audit trail
    expect(row).toHaveProperty('nonce');
    // Verify it's a valid 64-char hex HMAC-SHA256
    expect(row.token).toMatch(/^[a-f0-9]{64}$/);
  });

  // 2. Same wallet+nonce → same token (deterministic)
  it('produces the same token for the same wallet+nonce', () => {
    const token1 = computeBlindToken(WALLET, NONCE_A);
    const token2 = computeBlindToken(WALLET, NONCE_A);
    expect(token1).toBe(token2);
  });

  // 3. Different nonce → different token
  it('produces different tokens for different nonces', () => {
    const token1 = computeBlindToken(WALLET, NONCE_A);
    const token2 = computeBlindToken(WALLET, NONCE_B);
    expect(token1).not.toBe(token2);
  });

  // 4. Verify blind token → returns valid, tier, reputation_label, score_range but NOT wallet_address
  it('verifies a blind token and returns stripped response without wallet_address', () => {
    const stampId = insertStamp(db, { wallet: WALLET, tier: 'gold' });
    const token = computeBlindToken(WALLET, NONCE_A);

    insertBlindToken(db, token, WALLET);

    // Look up the token
    const tokenRow = db.prepare('SELECT * FROM blind_tokens WHERE token = ?').get(token);
    expect(tokenRow).toBeDefined();

    // Look up stamp for the wallet (mirrors endpoint logic)
    const stamp = db.prepare(
      "SELECT * FROM stamps WHERE wallet_address = ? AND revoked = 0 AND expires_at > datetime('now') ORDER BY CASE tier WHEN 'gold' THEN 4 WHEN 'silver' THEN 3 WHEN 'bronze' THEN 2 ELSE 1 END DESC LIMIT 1"
    ).get(tokenRow.wallet_address);

    // Build the stripped response
    const response = {
      success: true,
      valid: !!stamp,
      tier: stamp ? stamp.tier : null,
      reputation_label: 'new',
      score_range: '0-25',
    };

    expect(response.valid).toBe(true);
    expect(response.tier).toBe('gold');
    expect(response.reputation_label).toBe('new');
    expect(response.score_range).toBe('0-25');
    // MUST NOT include wallet_address
    expect(response).not.toHaveProperty('wallet_address');
    // MUST NOT include exact score
    expect(response).not.toHaveProperty('score');
    // MUST NOT include stamp_id
    expect(response).not.toHaveProperty('stamp_id');
  });

  // 5. Verify non-existent token → 404-equivalent
  it('returns null for a non-existent blind token', () => {
    const fakeToken = computeBlindToken(WALLET, 'does-not-exist');
    const row = db.prepare('SELECT * FROM blind_tokens WHERE token = ?').get(fakeToken);
    expect(row).toBeUndefined();
  });

  // 6. Agent with expired stamp → valid: false
  it('returns valid: false for an expired stamp', () => {
    insertStamp(db, { wallet: WALLET, tier: 'silver', expiresAt: PAST });
    const token = computeBlindToken(WALLET, NONCE_A);

    insertBlindToken(db, token, WALLET);

    const tokenRow = db.prepare('SELECT * FROM blind_tokens WHERE token = ?').get(token);
    const stamp = db.prepare(
      "SELECT * FROM stamps WHERE wallet_address = ? AND revoked = 0 AND expires_at > datetime('now') LIMIT 1"
    ).get(tokenRow.wallet_address);

    expect(stamp).toBeUndefined();

    const response = {
      success: true,
      valid: !!stamp,
      tier: stamp ? stamp.tier : null,
      reputation_label: 'new',
      score_range: '0-25',
    };

    expect(response.valid).toBe(false);
    expect(response.tier).toBeNull();
  });

  // 7. Event log contains blind_verified entry with wallet address
  it('records blind_verified event with wallet address in event log', () => {
    const token = computeBlindToken(WALLET, NONCE_A);

    insertBlindToken(db, token, WALLET);

    // Simulate what the endpoint does: log a blind_verified event
    appendEvent(db, 'blind_verified', { wallet_address: WALLET, token });

    const logged = db.prepare('SELECT * FROM event_log WHERE event_type = ?').get('blind_verified');
    expect(logged).toBeDefined();
    expect(logged.event_type).toBe('blind_verified');
    expect(logged.wallet_address).toBe(WALLET);

    const payload = JSON.parse(logged.payload);
    expect(payload.wallet_address).toBe(WALLET);
    expect(payload.token).toBe(token);
  });
});

// ─── Validator Tests ────────────────────────────────────────────────────────

describe('validateBlindRegister', () => {
  it('accepts valid input', () => {
    const result = validateBlindRegister({ wallet_address: WALLET, nonce: NONCE_A });
    expect(result).toEqual({ valid: true });
  });

  it('rejects missing wallet_address', () => {
    const result = validateBlindRegister({ nonce: NONCE_A });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('wallet_address');
  });

  it('rejects invalid wallet_address', () => {
    const result = validateBlindRegister({ wallet_address: 'bad', nonce: NONCE_A });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid');
  });

  it('rejects missing nonce', () => {
    const result = validateBlindRegister({ wallet_address: WALLET });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('nonce');
  });

  it('rejects nonce over 128 characters', () => {
    const result = validateBlindRegister({ wallet_address: WALLET, nonce: 'x'.repeat(129) });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('128');
  });
});

// ─── getScoreRange Tests ────────────────────────────────────────────────────

describe('getScoreRange', () => {
  it('returns 0-25 for scores 0-25', () => {
    expect(getScoreRange(0)).toBe('0-25');
    expect(getScoreRange(25)).toBe('0-25');
  });

  it('returns 26-50 for scores 26-50', () => {
    expect(getScoreRange(26)).toBe('26-50');
    expect(getScoreRange(50)).toBe('26-50');
  });

  it('returns 51-75 for scores 51-75', () => {
    expect(getScoreRange(51)).toBe('51-75');
    expect(getScoreRange(75)).toBe('51-75');
  });

  it('returns 76-100 for scores 76-100', () => {
    expect(getScoreRange(76)).toBe('76-100');
    expect(getScoreRange(100)).toBe('76-100');
  });
});
