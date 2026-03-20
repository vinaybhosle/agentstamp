/**
 * Flow 8 — Cold-Start Momentum
 *
 * Verifies that the momentum score appears in the reputation breakdown,
 * and that a heartbeat sent immediately after registration earns the
 * FIRST_HEARTBEAT_WITHIN_1H momentum action (+3 points).
 *
 * mint free → register agent → heartbeat immediately → GET reputation
 * → verify breakdown has momentum field with earned >= 3
 *
 * Skipped gracefully if the payment facilitator is down (503 on mint).
 */

const { makeTestWallet, get, post } = require('./helpers');

describe('Flow 8 — Cold-Start Momentum', () => {
  const wallet = makeTestWallet();
  let stampId;
  let agentId;
  let mintUnavailable = false;

  // ── Setup: mint + register + heartbeat immediately ─────────────────────────
  beforeAll(async () => {
    const mintRes = await post('/api/v1/stamp/mint/free', {
      headers: { 'x-wallet-address': wallet },
    });
    if (mintRes.status === 503) {
      console.warn('Flow 8: Payment facilitator unavailable (503) — skipping dependent tests');
      mintUnavailable = true;
      return;
    }
    expect(mintRes.status).toBe(201);
    stampId = mintRes.body.stamp?.id;
    expect(stampId).toBeTruthy();

    const registerRes = await post('/api/v1/registry/register/free', {
      headers: { 'x-wallet-address': wallet },
      body: {
        name: 'E2E Momentum Test Agent',
        description: 'Agent used to verify cold-start momentum scoring in E2E tests.',
        category: 'other',
        stamp_id: stampId,
      },
    });
    expect(registerRes.status).toBe(201);
    agentId = registerRes.body.agent?.id;
    expect(agentId).toBeTruthy();

    // Heartbeat immediately after registration (within 1 hour — earns FIRST_HEARTBEAT_WITHIN_1H)
    const heartbeatRes = await post(`/api/v1/registry/heartbeat/${agentId}`, {
      headers: { 'x-wallet-address': wallet },
    });
    expect(heartbeatRes.status).toBe(200);
  });

  // ── Step 1: Reputation has momentum in breakdown ──────────────────────────
  describe('Step 1: GET /api/v1/registry/agent/:agentId/reputation has momentum', () => {
    let repRes;

    beforeAll(async () => {
      if (mintUnavailable || !agentId) return;
      repRes = await get(`/api/v1/registry/agent/${agentId}/reputation`);
    });

    it('returns HTTP 200', () => {
      if (mintUnavailable) return;
      expect(repRes.status).toBe(200);
    });

    it('returns success: true', () => {
      if (mintUnavailable) return;
      expect(repRes.body.success).toBe(true);
    });

    it('breakdown has momentum field', () => {
      if (mintUnavailable) return;
      expect(repRes.body.breakdown).toHaveProperty('momentum');
    });

    it('momentum value is a number', () => {
      if (mintUnavailable) return;
      expect(typeof repRes.body.breakdown.momentum).toBe('number');
    });

    it('momentum is non-negative', () => {
      if (mintUnavailable) return;
      expect(repRes.body.breakdown.momentum).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Step 2: factors.momentum_details shows FIRST_HEARTBEAT_WITHIN_1H ──────
  describe('Step 2: factors.momentum_details shows earned points from first heartbeat', () => {
    let repRes;

    beforeAll(async () => {
      if (mintUnavailable || !agentId) return;
      repRes = await get(`/api/v1/registry/agent/${agentId}/reputation`);
    });

    it('factors has momentum_details', () => {
      if (mintUnavailable) return;
      expect(repRes.body.factors).toBeDefined();
      expect(repRes.body.factors.momentum_details).toBeDefined();
    });

    it('momentum_details has earned field', () => {
      if (mintUnavailable) return;
      expect(typeof repRes.body.factors.momentum_details.earned).toBe('number');
    });

    it('momentum_details.earned is >= 3 (FIRST_HEARTBEAT_WITHIN_1H bonus)', () => {
      if (mintUnavailable) return;
      // The heartbeat was sent within seconds of registration — should earn +3
      expect(repRes.body.factors.momentum_details.earned).toBeGreaterThanOrEqual(3);
    });

    it('momentum_details has actions array', () => {
      if (mintUnavailable) return;
      expect(Array.isArray(repRes.body.factors.momentum_details.actions)).toBe(true);
    });

    it('FIRST_HEARTBEAT_WITHIN_1H action is earned', () => {
      if (mintUnavailable) return;
      const actions = repRes.body.factors.momentum_details.actions;
      expect(actions).toContain('FIRST_HEARTBEAT_WITHIN_1H');
    });

    it('momentum_details.decayed is false (brand-new agent)', () => {
      if (mintUnavailable) return;
      // Agent was just registered — must be within the 30-day momentum window
      expect(repRes.body.factors.momentum_details.decayed).toBe(false);
    });
  });

  // ── Step 3: GET /registry/agent/:id confirms heartbeat_count ──────────────
  describe('Step 3: GET /api/v1/registry/agent/:agentId confirms heartbeat was recorded', () => {
    let agentRes;

    beforeAll(async () => {
      if (mintUnavailable || !agentId) return;
      agentRes = await get(`/api/v1/registry/agent/${agentId}`);
    });

    it('returns HTTP 200', () => {
      if (mintUnavailable) return;
      expect(agentRes.status).toBe(200);
    });

    it('heartbeat_count is at least 1', () => {
      if (mintUnavailable) return;
      expect(agentRes.body.agent.heartbeat_count).toBeGreaterThanOrEqual(1);
    });

    it('reputation object is present on agent profile', () => {
      if (mintUnavailable) return;
      expect(agentRes.body.agent.reputation).toBeDefined();
    });
  });
});
