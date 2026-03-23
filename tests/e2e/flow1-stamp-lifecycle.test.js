/**
 * Flow 1 — Stamp Lifecycle (mint → verify → tombstone)
 *
 * Happy path:
 *   mint free → verify (active) → tombstone → verify (inactive) → tombstone again (409)
 *
 * Each describe block uses a fresh wallet so cooldowns never interfere.
 */

const { makeSignedWallet, get, post } = require('./helpers');

describe('Flow 1 — Stamp Lifecycle: mint → verify → tombstone', () => {
  let stampId;
  const wallet = makeSignedWallet();

  // ── Step 1: Mint a free stamp ──────────────────────────────────────────────
  describe('Step 1: POST /api/v1/stamp/mint/free', () => {
    let mintRes;

    beforeAll(async () => {
      mintRes = await post('/api/v1/stamp/mint/free', {
        headers: await wallet.signHeaders('mint'),
      });
    });

    it('returns HTTP 201', () => {
      expect(mintRes.status).toBe(201);
    });

    it('returns success: true', () => {
      expect(mintRes.body.success).toBe(true);
    });

    it('returns a stamp with a valid id', () => {
      expect(mintRes.body.stamp).toBeDefined();
      expect(typeof mintRes.body.stamp.id).toBe('string');
      expect(mintRes.body.stamp.id.length).toBeGreaterThan(0);
    });

    it('stamp tier is free', () => {
      expect(mintRes.body.stamp.tier).toBe('free');
    });

    it('stamp wallet_address matches request wallet', () => {
      expect(mintRes.body.stamp.wallet_address).toBe(wallet.address);
    });

    it('stamp has issued_at and expires_at', () => {
      expect(mintRes.body.stamp.issued_at).toBeTruthy();
      expect(mintRes.body.stamp.expires_at).toBeTruthy();
    });

    it('stamp has a signature', () => {
      expect(mintRes.body.stamp.signature).toBeTruthy();
    });

    it('stamp has a verify_url', () => {
      expect(mintRes.body.stamp.verify_url).toMatch(/\/api\/v1\/stamp\/verify\//);
    });

    it('response includes upgrade_info', () => {
      expect(mintRes.body.upgrade_info).toBeDefined();
    });

    afterAll(() => {
      stampId = mintRes.body.stamp?.id;
    });
  });

  // ── Step 2: Verify stamp — should be active ────────────────────────────────
  describe('Step 2: GET /api/v1/stamp/verify/:stampId (before tombstone)', () => {
    let verifyRes;

    beforeAll(async () => {
      expect(stampId).toBeTruthy(); // guard: mint must have succeeded
      verifyRes = await get(`/api/v1/stamp/verify/${stampId}`);
    });

    it('returns HTTP 200', () => {
      expect(verifyRes.status).toBe(200);
    });

    it('returns success: true', () => {
      expect(verifyRes.body.success).toBe(true);
    });

    it('valid is true', () => {
      expect(verifyRes.body.valid).toBe(true);
    });

    it('active is true', () => {
      expect(verifyRes.body.active).toBe(true);
    });

    it('expired is false', () => {
      expect(verifyRes.body.expired).toBe(false);
    });

    it('revoked is false', () => {
      expect(verifyRes.body.revoked).toBe(false);
    });

    it('outcome is null', () => {
      expect(verifyRes.body.outcome).toBeNull();
    });

    it('stamp object contains correct id', () => {
      expect(verifyRes.body.stamp.id).toBe(stampId);
    });

    it('public_key is present', () => {
      expect(verifyRes.body.public_key).toBeTruthy();
    });
  });

  // ── Step 3: Tombstone with outcome=completed ───────────────────────────────
  describe('Step 3: POST /api/v1/stamp/:stampId/tombstone', () => {
    let tombstoneRes;

    beforeAll(async () => {
      const body = { outcome: 'completed' };
      tombstoneRes = await post(`/api/v1/stamp/${stampId}/tombstone`, {
        headers: await wallet.signHeaders('tombstone', body),
        body,
      });
    });

    it('returns HTTP 200', () => {
      expect(tombstoneRes.status).toBe(200);
    });

    it('returns success: true', () => {
      expect(tombstoneRes.body.success).toBe(true);
    });

    it('outcome is completed', () => {
      expect(tombstoneRes.body.outcome).toBe('completed');
    });

    it('stamp_id matches', () => {
      expect(tombstoneRes.body.stamp_id).toBe(stampId);
    });

    it('tombstoned_at is set', () => {
      expect(tombstoneRes.body.tombstoned_at).toBeTruthy();
    });
  });

  // ── Step 4: Verify tombstoned stamp — should be inactive ──────────────────
  describe('Step 4: GET /api/v1/stamp/verify/:stampId (after tombstone)', () => {
    let verifyRes;

    beforeAll(async () => {
      verifyRes = await get(`/api/v1/stamp/verify/${stampId}`);
    });

    it('returns HTTP 200', () => {
      expect(verifyRes.status).toBe(200);
    });

    it('active is false', () => {
      expect(verifyRes.body.active).toBe(false);
    });

    it('outcome is completed', () => {
      expect(verifyRes.body.outcome).toBe('completed');
    });

    it('tombstoned_at is set', () => {
      expect(verifyRes.body.tombstoned_at).toBeTruthy();
    });
  });

  // ── Step 5: Second tombstone attempt — should be 409 ─────────────────────
  describe('Step 5: POST /api/v1/stamp/:stampId/tombstone again (409)', () => {
    let retombstoneRes;

    beforeAll(async () => {
      const body = { outcome: 'completed' };
      retombstoneRes = await post(`/api/v1/stamp/${stampId}/tombstone`, {
        headers: await wallet.signHeaders('tombstone', body),
        body,
      });
    });

    it('returns HTTP 409', () => {
      expect(retombstoneRes.status).toBe(409);
    });

    it('returns success: false', () => {
      expect(retombstoneRes.body.success).toBe(false);
    });

    it('error message mentions already tombstoned', () => {
      expect(retombstoneRes.body.error).toMatch(/already tombstoned|revoked/i);
    });
  });

  // ── Cooldown check: same wallet should hit 429 ────────────────────────────
  describe('Step 6: Free stamp cooldown (same wallet, second mint)', () => {
    let cooldownRes;

    beforeAll(async () => {
      cooldownRes = await post('/api/v1/stamp/mint/free', {
        headers: await wallet.signHeaders('mint'),
      });
    });

    it('returns HTTP 429', () => {
      expect(cooldownRes.status).toBe(429);
    });

    it('next_available is present', () => {
      expect(cooldownRes.body.next_available).toBeTruthy();
    });
  });

  // ── Unknown stamp ID → 404 ────────────────────────────────────────────────
  describe('Step 7: GET /api/v1/stamp/verify/:unknownId (404)', () => {
    it('returns HTTP 404 for unknown stamp', async () => {
      const res = await get('/api/v1/stamp/verify/stmp_doesnotexist_00000');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('404 response includes a register action hint', async () => {
      const res = await get('/api/v1/stamp/verify/stmp_doesnotexist_00000');
      expect(res.body.action).toBeDefined();
      expect(res.body.action.register).toBeTruthy();
    });
  });
});
