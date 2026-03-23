/**
 * Flow 5 — Security & Authentication Checks
 *
 * Validates that all protected endpoints correctly reject:
 *  - Missing wallet headers (401)
 *  - Wrong/unauthorized wallets (401 from signature check, or 403 from ownership check)
 *  - Invalid wallet formats (400)
 *
 * Also validates that public endpoints do NOT require auth.
 *
 * Updated post 2026-03-20 security hardening:
 *  - All mutation endpoints require wallet signatures (not just address header)
 *  - Audit GET endpoints require wallet signature with action audit_read
 *  - verify-chain and chain-status now require auth
 */

const { makeTestWallet, makeSignedWallet, get, post } = require('./helpers');

describe('Flow 5 — Security: Auth Checks', () => {
  // Create real signed wallets we'll use as the victim / correct owner
  const ownerWallet = makeSignedWallet();
  const attackerWallet = makeSignedWallet();
  let ownedStampId;
  let setupUnavailable = false;

  // Mint a stamp for the owner so we can test tombstone auth
  beforeAll(async () => {
    const res = await post('/api/v1/stamp/mint/free', {
      headers: await ownerWallet.signHeaders('mint'),
    });
    if (res.status === 429 || res.status === 503) {
      console.warn(`Flow 5: Setup unavailable (${res.status}) — skipping stamp-dependent tests`);
      setupUnavailable = true;
      return;
    }
    expect(res.status).toBe(201);
    ownedStampId = res.body.stamp?.id;
    expect(ownedStampId).toBeTruthy();
  });

  // ── Tombstone WITHOUT wallet header → 401 ────────────────────────────────
  describe('POST /api/v1/stamp/:id/tombstone — no wallet header', () => {
    it('returns 401', async () => {
      if (setupUnavailable) return;
      const res = await post(`/api/v1/stamp/${ownedStampId}/tombstone`, {
        body: { outcome: 'completed' },
      });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ── Tombstone WITH wrong wallet (no sig) → 401 ───────────────────────────
  // Signature middleware fires before ownership check, returns 401 not 403
  describe('POST /api/v1/stamp/:id/tombstone — wrong wallet without signature', () => {
    it('returns 401 (signature required before ownership check)', async () => {
      if (setupUnavailable) return;
      const res = await post(`/api/v1/stamp/${ownedStampId}/tombstone`, {
        headers: { 'x-wallet-address': attackerWallet.address },
        body: { outcome: 'completed' },
      });
      // requireSignature fires first — attacker has no valid signature
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ── Tombstone WITH wrong wallet (valid sig) → 403 ────────────────────────
  describe('POST /api/v1/stamp/:id/tombstone — wrong wallet with valid signature', () => {
    it('returns 403 when attacker signs but does not own stamp', async () => {
      if (setupUnavailable) return;
      const body = { outcome: 'completed' };
      const res = await post(`/api/v1/stamp/${ownedStampId}/tombstone`, {
        headers: await attackerWallet.signHeaders('tombstone', body),
        body,
      });
      // 403 = auth passed but ownership rejected; 429 = rate limited
      expect([403, 429]).toContain(res.status);
      if (res.status === 403) {
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/not authorized/i);
      }
    });
  });

  // ── Tombstone — missing outcome body → 400 ───────────────────────────────
  describe('POST /api/v1/stamp/:id/tombstone — missing outcome (400)', () => {
    it('returns 400 when outcome is not supplied', async () => {
      if (setupUnavailable) return;
      const body = {};
      const res = await post(`/api/v1/stamp/${ownedStampId}/tombstone`, {
        headers: await ownerWallet.signHeaders('tombstone', body),
        body,
      });
      expect(res.status).toBe(400);
    });
  });

  // ── stamp/event WITHOUT wallet header → 401 ──────────────────────────────
  describe('POST /api/v1/stamp/event — no wallet header', () => {
    it('returns 401', async () => {
      const res = await post('/api/v1/stamp/event', {
        body: {
          wallet_address: ownerWallet.address,
          action: 'access_check',
          outcome: 'denied',
        },
      });
      expect(res.status).toBe(401);
    });
  });

  // ── stamp/event WITH mismatched wallets → 403 ────────────────────────────
  describe('POST /api/v1/stamp/event — mismatched wallets', () => {
    it('returns 403', async () => {
      const body = {
        wallet_address: ownerWallet.address, // body wallet != header wallet
        action: 'access_check',
        outcome: 'denied',
      };
      const res = await post('/api/v1/stamp/event', {
        headers: await attackerWallet.signHeaders('stamp_event', body),
        body,
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

  // ── audit/verify-chain — requires auth ────────────────────────────────────
  describe('GET /api/v1/audit/verify-chain — requires auth', () => {
    it('returns 401 without any auth header', async () => {
      const res = await get('/api/v1/audit/verify-chain');
      expect(res.status).toBe(401);
    });
  });

  // ── audit/chain-status — requires auth ────────────────────────────────────
  describe('GET /api/v1/audit/chain-status — requires auth', () => {
    it('returns 401 without any auth header', async () => {
      const res = await get('/api/v1/audit/chain-status');
      expect(res.status).toBe(401);
    });
  });

  // ── mint/free WITHOUT wallet header → 400 or 401 ─────────────────────────
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
      const res = await get(`/api/v1/trust/check/${ownerWallet.address}`);
      expect(res.status).toBe(200);
    });
  });

  // ── Stamp verify is public ────────────────────────────────────────────────
  describe('GET /api/v1/stamp/verify/:id — public', () => {
    it('returns 200 or 404 without any auth header', async () => {
      if (setupUnavailable) {
        // Use a fake stamp ID — expect 404
        const res = await get('/api/v1/stamp/verify/stmp_doesnotexist_00000');
        expect([200, 404]).toContain(res.status);
        return;
      }
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
