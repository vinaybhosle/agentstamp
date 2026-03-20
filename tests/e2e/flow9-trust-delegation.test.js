/**
 * Flow 9 — Trust Delegation
 *
 * Tests the rejection paths for trust delegation (hard to achieve score >= 50
 * with a fresh free-tier agent in E2E tests), plus the delegations listing
 * endpoint and the delegation_bonus field in trust check responses.
 *
 * Covers:
 *  - POST /trust/delegate without signature → 401
 *  - POST /trust/delegate without wallet header → 401
 *  - GET  /trust/delegations/:wallet → incoming/outgoing arrays
 *  - GET  /trust/check/:wallet → delegation_bonus field present
 *
 * Skipped gracefully if the payment facilitator is down (503 on mint).
 */

const { makeTestWallet, get, post } = require('./helpers');

describe('Flow 9 — Trust Delegation', () => {
  const wallet = makeTestWallet();
  const targetWallet = makeTestWallet();
  let mintUnavailable = false;

  // Give the low-score wallet a stamp so trust check returns real data
  beforeAll(async () => {
    const mintRes = await post('/api/v1/stamp/mint/free', {
      headers: { 'x-wallet-address': wallet },
    });
    if (mintRes.status === 503) {
      console.warn('Flow 9: Payment facilitator unavailable (503) — skipping stamp-dependent tests');
      mintUnavailable = true;
      return;
    }
    expect(mintRes.status).toBe(201);
  });

  // ── Step 1: POST /trust/delegate without signature → 401 ──────────────────
  describe('Step 1: POST /api/v1/trust/delegate — no signature → 401', () => {
    let res;

    beforeAll(async () => {
      // No x-wallet-signature / x-wallet-timestamp headers — should be rejected
      res = await post('/api/v1/trust/delegate', {
        headers: { 'x-wallet-address': wallet },
        body: {
          delegatee_wallet: targetWallet,
          weight: 1.0,
        },
      });
    });

    it('returns HTTP 401', () => {
      expect(res.status).toBe(401);
    });

    it('returns success: false', () => {
      expect(res.body.success).toBe(false);
    });

    it('error mentions signature', () => {
      expect(res.body.error).toMatch(/signature/i);
    });
  });

  // ── Step 2: POST /trust/delegate without wallet header → 401 ──────────────
  describe('Step 2: POST /api/v1/trust/delegate without wallet header → 401', () => {
    it('returns 401 when x-wallet-address is missing entirely', async () => {
      const res = await post('/api/v1/trust/delegate', {
        body: {
          delegatee_wallet: targetWallet,
          weight: 1.0,
        },
      });
      // requireSignature (required:true) fires first → 401
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ── Step 3: GET /trust/delegations/:wallet → incoming/outgoing arrays ──────
  describe('Step 3: GET /api/v1/trust/delegations/:wallet', () => {
    let delegationsRes;

    beforeAll(async () => {
      delegationsRes = await get(`/api/v1/trust/delegations/${wallet}`);
    });

    it('returns HTTP 200', () => {
      expect(delegationsRes.status).toBe(200);
    });

    it('returns success: true', () => {
      expect(delegationsRes.body.success).toBe(true);
    });

    it('has incoming array', () => {
      expect(Array.isArray(delegationsRes.body.incoming)).toBe(true);
    });

    it('has outgoing array', () => {
      expect(Array.isArray(delegationsRes.body.outgoing)).toBe(true);
    });

    it('wallet field is a non-empty string', () => {
      expect(typeof delegationsRes.body.wallet).toBe('string');
      expect(delegationsRes.body.wallet.length).toBeGreaterThan(0);
    });

    it('fresh wallet has no incoming delegations', () => {
      expect(delegationsRes.body.incoming).toHaveLength(0);
    });

    it('fresh wallet has no outgoing delegations', () => {
      expect(delegationsRes.body.outgoing).toHaveLength(0);
    });
  });

  // ── Step 4: GET /trust/delegations with invalid wallet → 400 ───────────────
  describe('Step 4: GET /api/v1/trust/delegations — invalid wallet → 400', () => {
    it('returns 400 for a malformed wallet address', async () => {
      const res = await get('/api/v1/trust/delegations/not-a-wallet');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ── Step 5: Trust check includes delegation_bonus field ───────────────────
  // delegation_bonus is only present when the wallet has a stamp or registered agent.
  // When the facilitator is down (503 on mint), the wallet has no stamp so the API
  // returns early with trusted:false and no delegation_bonus.
  describe('Step 5: GET /api/v1/trust/check/:wallet includes delegation_bonus', () => {
    let trustRes;

    beforeAll(async () => {
      trustRes = await get(`/api/v1/trust/check/${wallet}`);
    });

    it('returns HTTP 200', () => {
      expect(trustRes.status).toBe(200);
    });

    it('delegation_bonus is present when wallet has a stamp or agent', () => {
      if (mintUnavailable) {
        // No stamp → trusted:false → no delegation_bonus in response (expected)
        return;
      }
      expect(trustRes.body.delegation_bonus).toBeDefined();
    });

    it('delegation_bonus has a bonus field (number) when present', () => {
      if (mintUnavailable || !trustRes.body.delegation_bonus) return;
      expect(typeof trustRes.body.delegation_bonus.bonus).toBe('number');
    });

    it('delegation_bonus has delegations array when present', () => {
      if (mintUnavailable || !trustRes.body.delegation_bonus) return;
      expect(Array.isArray(trustRes.body.delegation_bonus.delegations)).toBe(true);
    });

    it('fresh wallet has delegation_bonus of 0 when present', () => {
      if (mintUnavailable || !trustRes.body.delegation_bonus) return;
      // No delegations have been made to this wallet
      expect(trustRes.body.delegation_bonus.bonus).toBe(0);
    });
  });

  // ── Step 6: Delegating to self requires signature first → 401 ────────────
  describe('Step 6: Self-delegation attempt requires signature → 401', () => {
    it('returns 401 (signature required) when no signature headers', async () => {
      const res = await post('/api/v1/trust/delegate', {
        headers: { 'x-wallet-address': wallet },
        body: {
          delegatee_wallet: wallet, // self
          weight: 1.0,
        },
      });
      // requireSignature(required=true) fires first → 401
      expect(res.status).toBe(401);
    });
  });

  // ── Step 7: Delegations endpoint works for target wallet too ──────────────
  describe('Step 7: GET /api/v1/trust/delegations/:targetWallet', () => {
    it('returns 200 with empty arrays for a brand-new wallet', async () => {
      const res = await get(`/api/v1/trust/delegations/${targetWallet}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.incoming)).toBe(true);
      expect(Array.isArray(res.body.outgoing)).toBe(true);
    });
  });
});
