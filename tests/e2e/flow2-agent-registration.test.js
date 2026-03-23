/**
 * Flow 2 — Agent Registration + Trust Check
 *
 * mint free → register free → trust check → heartbeat → fetch agent profile
 */

const { makeSignedWallet, makeTestWallet, get, post } = require('./helpers');

describe('Flow 2 — Agent Registration + Trust Check', () => {
  const wallet = makeSignedWallet();
  let stampId;
  let agentId;

  // ── Step 1: Mint free stamp ────────────────────────────────────────────────
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

    it('returns a stamp_id', () => {
      expect(mintRes.body.stamp?.id).toBeTruthy();
      stampId = mintRes.body.stamp?.id;
    });
  });

  // ── Step 2: Register free agent ───────────────────────────────────────────
  describe('Step 2: POST /api/v1/registry/register/free', () => {
    let registerRes;

    beforeAll(async () => {
      expect(stampId).toBeTruthy();
      const body = {
        name: 'E2E Test Agent',
        description: 'An agent created by the E2E test suite for validation.',
        category: 'other',
        stamp_id: stampId,
      };
      registerRes = await post('/api/v1/registry/register/free', {
        headers: await wallet.signHeaders('register', body),
        body,
      });
    });

    it('returns HTTP 201', () => {
      expect(registerRes.status).toBe(201);
    });

    it('returns success: true', () => {
      expect(registerRes.body.success).toBe(true);
    });

    it('returns an agent id', () => {
      expect(registerRes.body.agent?.id).toBeTruthy();
    });

    it('agent name matches submitted name', () => {
      expect(registerRes.body.agent?.name).toBe('E2E Test Agent');
    });

    it('plan is free', () => {
      expect(registerRes.body.agent?.plan).toBe('free');
    });

    it('agent has registered_at and expires_at', () => {
      expect(registerRes.body.agent?.registered_at).toBeTruthy();
      expect(registerRes.body.agent?.expires_at).toBeTruthy();
    });

    it('response includes upgrade_info', () => {
      expect(registerRes.body.upgrade_info).toBeDefined();
    });

    afterAll(() => {
      agentId = registerRes.body.agent?.id;
    });
  });

  // ── Step 3: Trust check via wallet ────────────────────────────────────────
  describe('Step 3: GET /api/v1/trust/check/:walletAddress', () => {
    let trustRes;

    beforeAll(async () => {
      trustRes = await get(`/api/v1/trust/check/${wallet.address}`);
    });

    it('returns HTTP 200', () => {
      expect(trustRes.status).toBe(200);
    });

    it('trusted is true (has stamp + registration)', () => {
      expect(trustRes.body.trusted).toBe(true);
    });

    it('score is a number (may be 0 for brand-new agents)', () => {
      expect(typeof trustRes.body.score).toBe('number');
      expect(trustRes.body.score).toBeGreaterThanOrEqual(0);
    });

    it('stamp tier is free', () => {
      expect(trustRes.body.stamp?.tier).toBe('free');
    });

    it('agent info is present', () => {
      expect(trustRes.body.agent).toBeDefined();
      expect(trustRes.body.agent.id).toBe(agentId);
    });

    it('upgrade_hint is provided (score below 50)', () => {
      // New agents always start with low score — hint should appear
      expect(trustRes.body.upgrade_hint).toBeDefined();
    });
  });

  // ── Step 4: Heartbeat ─────────────────────────────────────────────────────
  describe('Step 4: POST /api/v1/registry/heartbeat/:agentId', () => {
    let heartbeatRes;
    let heartbeatRateLimited = false;

    beforeAll(async () => {
      expect(agentId).toBeTruthy();
      heartbeatRes = await post(`/api/v1/registry/heartbeat/${agentId}`, {
        headers: await wallet.signHeaders('heartbeat'),
      });
      if (heartbeatRes.status === 429) {
        heartbeatRateLimited = true;
        console.warn('Flow 2 Step 4: Rate limited (429) — skipping heartbeat assertions');
      }
    });

    it('returns HTTP 200 (or 429 if rate limited)', () => {
      if (heartbeatRateLimited) return;
      expect(heartbeatRes.status).toBe(200);
    });

    it('returns success: true', () => {
      if (heartbeatRateLimited) return;
      expect(heartbeatRes.body.success).toBe(true);
    });

    it('last_heartbeat is set', () => {
      if (heartbeatRateLimited) return;
      expect(heartbeatRes.body.last_heartbeat).toBeTruthy();
    });

    it('heartbeat_count is at least 1', () => {
      if (heartbeatRateLimited) return;
      expect(heartbeatRes.body.heartbeat_count).toBeGreaterThanOrEqual(1);
    });

    it('includes renewal_info with stamp expiry details', () => {
      if (heartbeatRateLimited) return;
      expect(heartbeatRes.body.renewal_info).toBeDefined();
      expect(heartbeatRes.body.renewal_info.stamp_id).toBeTruthy();
    });
  });

  // ── Step 5: Fetch agent profile with heartbeat_count ──────────────────────
  describe('Step 5: GET /api/v1/registry/agent/:agentId', () => {
    let agentRes;

    beforeAll(async () => {
      agentRes = await get(`/api/v1/registry/agent/${agentId}`);
    });

    it('returns HTTP 200', () => {
      expect(agentRes.status).toBe(200);
    });

    it('success is true', () => {
      expect(agentRes.body.success).toBe(true);
    });

    it('agent id matches', () => {
      expect(agentRes.body.agent.id).toBe(agentId);
    });

    it('agent name matches', () => {
      expect(agentRes.body.agent.name).toBe('E2E Test Agent');
    });

    it('heartbeat_count is a non-negative number after heartbeat', () => {
      expect(agentRes.body.agent.heartbeat_count).toBeGreaterThanOrEqual(0);
    });

    it('capabilities is an array', () => {
      expect(Array.isArray(agentRes.body.agent.capabilities)).toBe(true);
    });

    it('reputation object is present', () => {
      expect(agentRes.body.agent.reputation).toBeDefined();
    });

    it('endorsements list is present', () => {
      expect(Array.isArray(agentRes.body.agent.endorsements)).toBe(true);
    });
  });

  // ── Step 6: Registration cooldown on same wallet ──────────────────────────
  describe('Step 6: Free registration cooldown (same wallet, second attempt)', () => {
    it('returns HTTP 429 on second register', async () => {
      const body = {
        name: 'Cooldown Test Agent',
        description: 'Should be rejected by cooldown.',
        category: 'other',
      };
      const res = await post('/api/v1/registry/register/free', {
        headers: await wallet.signHeaders('register', body),
        body,
      });
      expect(res.status).toBe(429);
      expect(res.body.next_available).toBeTruthy();
    });
  });

  // ── Step 7: Heartbeat with wrong wallet → 403 ─────────────────────────────
  describe('Step 7: Heartbeat with wrong wallet (403)', () => {
    it('returns HTTP 403 when wrong wallet sends heartbeat', async () => {
      const wrongWallet = makeSignedWallet();
      const res = await post(`/api/v1/registry/heartbeat/${agentId}`, {
        headers: await wrongWallet.signHeaders('heartbeat'),
      });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // ── Step 8: Heartbeat without wallet → 401 ───────────────────────────────
  describe('Step 8: Heartbeat without wallet header (401)', () => {
    it('returns HTTP 401 when no wallet provided', async () => {
      const res = await post(`/api/v1/registry/heartbeat/${agentId}`);
      expect(res.status).toBe(401);
    });
  });

  // ── Step 9: Trust check for unknown wallet ────────────────────────────────
  describe('Step 9: Trust check for an unknown wallet', () => {
    it('returns trusted: false with 0 score for an unregistered wallet', async () => {
      const unknownWallet = makeTestWallet();
      const res = await get(`/api/v1/trust/check/${unknownWallet}`);
      expect(res.status).toBe(200);
      expect(res.body.trusted).toBe(false);
      expect(res.body.score).toBe(0);
      expect(res.body.label).toBe('unknown');
      expect(res.body.action).toBeDefined();
    });
  });
});
