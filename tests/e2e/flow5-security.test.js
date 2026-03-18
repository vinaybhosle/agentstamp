/**
 * Flow 5 — Security & Authentication Checks
 *
 * Validates that all protected endpoints correctly reject:
 *  - Missing wallet headers (401)
 *  - Wrong/unauthorized wallets (403)
 *  - Invalid wallet formats (400)
 *
 * Also validates that public endpoints do NOT require auth.
 */

const { makeTestWallet, get, post } = require('./helpers');

describe('Flow 5 — Security: Auth Checks', () => {
  // Create a real stamped wallet we'll use as the victim / correct owner
  const ownerWallet = makeTestWallet();
  const attackerWallet = makeTestWallet();
  let ownedStampId;

  // Mint a stamp for the owner so we can test tombstone auth
  beforeAll(async () => {
    const res = await post('/api/v1/stamp/mint/free', {
      headers: { 'x-wallet-address': ownerWallet },
    });
    expect(res.status).toBe(201);
    ownedStampId = res.body.stamp?.id;
    expect(ownedStampId).toBeTruthy();
  });

  // ── Tombstone WITHOUT wallet header → 401 ────────────────────────────────
  describe('POST /api/v1/stamp/:id/tombstone — no wallet header', () => {
    it('returns 401', async () => {
      const res = await post(`/api/v1/stamp/${ownedStampId}/tombstone`, {
        body: { outcome: 'completed' },
      });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ── Tombstone WITH wrong wallet → 403 ────────────────────────────────────
  describe('POST /api/v1/stamp/:id/tombstone — wrong wallet', () => {
    it('returns 403', async () => {
      const res = await post(`/api/v1/stamp/${ownedStampId}/tombstone`, {
        headers: { 'x-wallet-address': attackerWallet },
        body: { outcome: 'completed' },
      });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not authorized/i);
    });
  });

  // ── Tombstone — missing outcome body → 400 ───────────────────────────────
  describe('POST /api/v1/stamp/:id/tombstone — missing outcome (400)', () => {
    it('returns 400 when outcome is not supplied', async () => {
      const res = await post(`/api/v1/stamp/${ownedStampId}/tombstone`, {
        headers: { 'x-wallet-address': ownerWallet },
        body: {},
      });
      expect(res.status).toBe(400);
    });
  });

  // ── stamp/event WITHOUT wallet header → 401 ──────────────────────────────
  describe('POST /api/v1/stamp/event — no wallet header', () => {
    it('returns 401', async () => {
      const res = await post('/api/v1/stamp/event', {
        body: {
          wallet_address: ownerWallet,
          action: 'access_check',
          outcome: 'denied',
        },
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/x-wallet-address/i);
    });
  });

  // ── stamp/event WITH mismatched wallets → 403 ────────────────────────────
  describe('POST /api/v1/stamp/event — mismatched wallets', () => {
    it('returns 403', async () => {
      const res = await post('/api/v1/stamp/event', {
        headers: { 'x-wallet-address': attackerWallet },
        body: {
          wallet_address: ownerWallet, // body wallet != header wallet
          action: 'access_check',
          outcome: 'denied',
        },
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/mismatch/i);
    });
  });

  // ── audit/events WITHOUT wallet header → 401 ─────────────────────────────
  describe('GET /api/v1/audit/events — no auth', () => {
    it('returns 401', async () => {
      const res = await get('/api/v1/audit/events');
      expect(res.status).toBe(401);
    });
  });

  // ── audit/execution WITHOUT wallet header → 401 ──────────────────────────
  describe('GET /api/v1/audit/execution — no auth', () => {
    it('returns 401', async () => {
      const res = await get('/api/v1/audit/execution');
      expect(res.status).toBe(401);
    });
  });

  // ── audit/compliance WITHOUT wallet header → 401 ─────────────────────────
  describe('GET /api/v1/audit/compliance — no auth', () => {
    it('returns 401', async () => {
      const res = await get('/api/v1/audit/compliance');
      expect(res.status).toBe(401);
    });
  });

  // ── audit/verify-chain — PUBLIC, no auth needed ──────────────────────────
  describe('GET /api/v1/audit/verify-chain — public (no auth required)', () => {
    it('returns 200 without any auth header', async () => {
      const res = await get('/api/v1/audit/verify-chain');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ── audit/chain-status — PUBLIC ───────────────────────────────────────────
  describe('GET /api/v1/audit/chain-status — public (no auth required)', () => {
    it('returns 200 without any auth header', async () => {
      const res = await get('/api/v1/audit/chain-status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ── mint/free WITHOUT wallet header → 400 ────────────────────────────────
  describe('POST /api/v1/stamp/mint/free — no wallet', () => {
    it('returns 400 or 401 when wallet_address is missing', async () => {
      const res = await post('/api/v1/stamp/mint/free', { body: {} });
      expect([400, 401]).toContain(res.status);
    });
  });

  // ── Invalid wallet format → 400 ──────────────────────────────────────────
  describe('POST /api/v1/stamp/mint/free — invalid wallet format', () => {
    it('returns 400 for a non-hex wallet address', async () => {
      const res = await post('/api/v1/stamp/mint/free', {
        headers: { 'x-wallet-address': 'not-a-wallet-address' },
      });
      expect(res.status).toBe(400);
    });
  });

  // ── registry/register/free WITHOUT wallet header → 401 ───────────────────
  describe('POST /api/v1/registry/register/free — no wallet', () => {
    it('returns 400 or 401', async () => {
      const res = await post('/api/v1/registry/register/free', {
        body: {
          name: 'No Wallet Agent',
          description: 'Should be rejected.',
          category: 'other',
        },
      });
      expect([400, 401]).toContain(res.status);
    });
  });

  // ── Trust check is public (GET) ───────────────────────────────────────────
  describe('GET /api/v1/trust/check/:wallet — public (no auth required)', () => {
    it('returns 200 without any auth header', async () => {
      const res = await get(`/api/v1/trust/check/${ownerWallet}`);
      expect(res.status).toBe(200);
    });
  });

  // ── Stamp verify is public ────────────────────────────────────────────────
  describe('GET /api/v1/stamp/verify/:id — public', () => {
    it('returns 200 or 404 without any auth header', async () => {
      const res = await get(`/api/v1/stamp/verify/${ownedStampId}`);
      expect([200, 404]).toContain(res.status);
    });
  });

  // ── Registry agent GET is public ─────────────────────────────────────────
  describe('GET /api/v1/registry/agent/:id — public', () => {
    it('returns 404 for nonexistent agent without auth header', async () => {
      const res = await get('/api/v1/registry/agent/agt_doesnotexist_00000');
      expect(res.status).toBe(404);
    });
  });
});
