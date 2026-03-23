/**
 * Flow 7 — Trust Score Decay
 *
 * Verifies that the reputation system includes decay_info in the breakdown
 * when fetching agent reputation. A fresh heartbeat yields a multiplier of 1.0
 * and a penalty of 0 (within the 3-day grace period).
 *
 * mint free → register agent → heartbeat → GET /registry/agent/:id/reputation
 * → verify breakdown has decay_info
 *
 * Skipped gracefully if the payment facilitator is down (503 on mint).
 */

const { makeSignedWallet, get, post } = require('./helpers');

describe('Flow 7 — Trust Score Decay', () => {
  const wallet = makeSignedWallet();
  let stampId;
  let agentId;
  let mintUnavailable = false;

  // ── Setup: mint + register + heartbeat ─────────────────────────────────────
  beforeAll(async () => {
    const mintRes = await post('/api/v1/stamp/mint/free', {
      headers: await wallet.signHeaders('mint'),
    });
    if (mintRes.status === 503 || mintRes.status === 429) {
      console.warn(`Flow 7: Setup unavailable (${mintRes.status}) — skipping dependent tests`);
      mintUnavailable = true;
      return;
    }
    expect(mintRes.status).toBe(201);
    stampId = mintRes.body.stamp?.id;
    expect(stampId).toBeTruthy();

    const regBody = {
      name: 'E2E Decay Test Agent',
      description: 'Agent used to verify trust score decay logic in E2E tests.',
      category: 'other',
      stamp_id: stampId,
    };
    const registerRes = await post('/api/v1/registry/register/free', {
      headers: await wallet.signHeaders('register', regBody),
      body: regBody,
    });
    if (registerRes.status === 429) {
      console.warn('Flow 7: Rate limited on register — skipping dependent tests');
      mintUnavailable = true;
      return;
    }
    expect(registerRes.status).toBe(201);
    agentId = registerRes.body.agent?.id;
    expect(agentId).toBeTruthy();

    const heartbeatRes = await post(`/api/v1/registry/heartbeat/${agentId}`, {
      headers: await wallet.signHeaders('heartbeat'),
    });
    if (heartbeatRes.status === 429) {
      console.warn('Flow 7: Rate limited on heartbeat — skipping dependent tests');
      mintUnavailable = true;
      return;
    }
    expect(heartbeatRes.status).toBe(200);
  });

  // ── Step 1: GET /registry/agent/:id/reputation returns decay_info ──────────
  describe('Step 1: GET /api/v1/registry/agent/:agentId/reputation includes decay_info', () => {
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

    it('has a breakdown field', () => {
      if (mintUnavailable) return;
      expect(repRes.body.breakdown).toBeDefined();
    });

    it('breakdown contains decay_info', () => {
      if (mintUnavailable) return;
      expect(repRes.body.breakdown.decay_info).toBeDefined();
    });

    it('decay_info has days_since_heartbeat', () => {
      if (mintUnavailable) return;
      const info = repRes.body.breakdown.decay_info;
      expect(typeof info.days_since_heartbeat).toBe('number');
      expect(info.days_since_heartbeat).toBeGreaterThanOrEqual(0);
    });

    it('decay_info has decay_multiplier', () => {
      if (mintUnavailable) return;
      const info = repRes.body.breakdown.decay_info;
      expect(typeof info.decay_multiplier).toBe('number');
    });

    it('decay_info has penalty', () => {
      if (mintUnavailable) return;
      const info = repRes.body.breakdown.decay_info;
      expect(typeof info.penalty).toBe('number');
    });

    it('fresh heartbeat yields decay_multiplier of 1.0 (within 3-day grace)', () => {
      if (mintUnavailable) return;
      const info = repRes.body.breakdown.decay_info;
      // heartbeat was just sent — days_since_heartbeat should be tiny (<3 days)
      expect(info.days_since_heartbeat).toBeLessThan(3);
      expect(info.decay_multiplier).toBe(1.0);
    });

    it('fresh heartbeat yields penalty of 0 (within 3-day grace)', () => {
      if (mintUnavailable) return;
      const info = repRes.body.breakdown.decay_info;
      expect(info.penalty).toBe(0);
    });
  });

  // ── Step 2: Trust check response includes score as a number ───────────────
  describe('Step 2: GET /api/v1/trust/check/:wallet returns numeric score', () => {
    let trustRes;

    beforeAll(async () => {
      if (mintUnavailable) return;
      trustRes = await get(`/api/v1/trust/check/${wallet.address}`);
    });

    it('returns HTTP 200', () => {
      if (mintUnavailable) return;
      expect(trustRes.status).toBe(200);
    });

    it('score is a number', () => {
      if (mintUnavailable) return;
      expect(typeof trustRes.body.score).toBe('number');
    });

    it('score is non-negative', () => {
      if (mintUnavailable) return;
      expect(trustRes.body.score).toBeGreaterThanOrEqual(0);
    });

    it('trusted is true (has a free stamp)', () => {
      if (mintUnavailable) return;
      expect(trustRes.body.trusted).toBe(true);
    });

    it('delegation_bonus is present in response', () => {
      if (mintUnavailable) return;
      expect(trustRes.body.delegation_bonus).toBeDefined();
    });
  });

  // ── Step 3: Reputation breakdown has momentum field ───────────────────────
  describe('Step 3: Reputation breakdown has momentum field', () => {
    let repRes;

    beforeAll(async () => {
      if (mintUnavailable || !agentId) return;
      repRes = await get(`/api/v1/registry/agent/${agentId}/reputation`);
    });

    it('breakdown has momentum field', () => {
      if (mintUnavailable) return;
      expect(repRes.body.breakdown).toHaveProperty('momentum');
    });

    it('breakdown has uptime field', () => {
      if (mintUnavailable) return;
      expect(repRes.body.breakdown).toHaveProperty('uptime');
    });

    it('breakdown has tier field', () => {
      if (mintUnavailable) return;
      expect(repRes.body.breakdown).toHaveProperty('tier');
    });

    it('breakdown has endorsements field', () => {
      if (mintUnavailable) return;
      expect(repRes.body.breakdown).toHaveProperty('endorsements');
    });
  });

  // ── Edge: Unknown agent → 404 ─────────────────────────────────────────────
  describe('Edge: GET /api/v1/registry/agent/nonexistent/reputation → 404', () => {
    it('returns 404 for unknown agent', async () => {
      const res = await get('/api/v1/registry/agent/agt_doesnotexist_00000/reputation');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
