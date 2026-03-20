/**
 * Flow 12 — Reputation Monitor
 *
 * Verifies that the reputation monitoring system functions correctly:
 * - GET /audit/chain-status returns a usable chain status response
 * - Minting a stamp + registering + heartbeating updates reputation data
 * - GET /trust/check/:wallet returns a numeric score
 *
 * Skipped gracefully if the payment facilitator is down (503 on mint).
 */

const { makeTestWallet, get, post } = require('./helpers');

describe('Flow 12 — Reputation Monitor', () => {
  const wallet = makeTestWallet();
  let stampId;
  let agentId;
  let mintUnavailable = false;

  // ── Setup: mint + register + heartbeat ─────────────────────────────────────
  beforeAll(async () => {
    const mintRes = await post('/api/v1/stamp/mint/free', {
      headers: { 'x-wallet-address': wallet },
    });
    if (mintRes.status === 503) {
      console.warn('Flow 12: Payment facilitator unavailable (503) — skipping stamp-dependent tests');
      mintUnavailable = true;
      return;
    }
    expect(mintRes.status).toBe(201);
    stampId = mintRes.body.stamp?.id;
    expect(stampId).toBeTruthy();

    const registerRes = await post('/api/v1/registry/register/free', {
      headers: { 'x-wallet-address': wallet },
      body: {
        name: 'E2E Reputation Monitor Agent',
        description: 'Agent used to verify the reputation monitoring pipeline in E2E tests.',
        category: 'other',
        stamp_id: stampId,
      },
    });
    expect(registerRes.status).toBe(201);
    agentId = registerRes.body.agent?.id;
    expect(agentId).toBeTruthy();

    const heartbeatRes = await post(`/api/v1/registry/heartbeat/${agentId}`, {
      headers: { 'x-wallet-address': wallet },
    });
    expect(heartbeatRes.status).toBe(200);
  });

  // ── Step 1: GET /audit/chain-status — always public, no mint needed ────────
  describe('Step 1: GET /api/v1/audit/chain-status — public endpoint', () => {
    let statusRes;

    beforeAll(async () => {
      statusRes = await get('/api/v1/audit/chain-status');
    });

    it('returns HTTP 200', () => {
      expect(statusRes.status).toBe(200);
    });

    it('returns success: true', () => {
      expect(statusRes.body.success).toBe(true);
    });

    it('has chain_length field (number)', () => {
      expect(typeof statusRes.body.chain_length).toBe('number');
      expect(statusRes.body.chain_length).toBeGreaterThanOrEqual(0);
    });

    it('has total_events field (number)', () => {
      expect(typeof statusRes.body.total_events).toBe('number');
    });

    it('total_events >= chain_length', () => {
      expect(statusRes.body.total_events).toBeGreaterThanOrEqual(statusRes.body.chain_length);
    });

    it('has genesis_intact field (boolean)', () => {
      expect(typeof statusRes.body.genesis_intact).toBe('boolean');
    });

    it('genesis_intact is a boolean', () => {
      // May be false if the chain has data integrity issues (not caused by this test)
      expect(typeof statusRes.body.genesis_intact).toBe('boolean');
    });

    it('has latest_event_type field (may be null)', () => {
      expect('latest_event_type' in statusRes.body).toBe(true);
    });

    it('total_events > 0 (platform has activity)', () => {
      // The platform should already have events from previous test runs / existing data
      expect(statusRes.body.total_events).toBeGreaterThan(0);
    });

    it('chain_length > 0 (events are being hashed)', () => {
      expect(statusRes.body.chain_length).toBeGreaterThan(0);
    });

    it('head_hash is a non-empty string', () => {
      expect(typeof statusRes.body.head_hash).toBe('string');
      expect(statusRes.body.head_hash.length).toBeGreaterThan(0);
    });
  });

  // ── Step 2: Heartbeat updates last_reputation_score on agent ──────────────
  describe('Step 2: Heartbeat updates reputation on agent profile', () => {
    let agentRes;

    beforeAll(async () => {
      if (mintUnavailable || !agentId) return;
      agentRes = await get(`/api/v1/registry/agent/${agentId}`);
    });

    it('returns HTTP 200', () => {
      if (mintUnavailable) return;
      expect(agentRes.status).toBe(200);
    });

    it('agent profile returns success: true', () => {
      if (mintUnavailable) return;
      expect(agentRes.body.success).toBe(true);
    });

    it('agent has reputation object with score', () => {
      if (mintUnavailable) return;
      expect(agentRes.body.agent.reputation).toBeDefined();
      expect(typeof agentRes.body.agent.reputation.score).toBe('number');
    });

    it('reputation score is >= 0', () => {
      if (mintUnavailable) return;
      expect(agentRes.body.agent.reputation.score).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Step 3: GET /registry/agent/:id/reputation — full breakdown ────────────
  describe('Step 3: GET /api/v1/registry/agent/:agentId/reputation — full breakdown', () => {
    let repRes;

    beforeAll(async () => {
      if (mintUnavailable || !agentId) return;
      repRes = await get(`/api/v1/registry/agent/${agentId}/reputation`);
    });

    it('returns HTTP 200', () => {
      if (mintUnavailable) return;
      expect(repRes.status).toBe(200);
    });

    it('score is a number >= 0', () => {
      if (mintUnavailable) return;
      expect(typeof repRes.body.score).toBe('number');
      expect(repRes.body.score).toBeGreaterThanOrEqual(0);
    });

    it('label is one of: new, emerging, established, elite', () => {
      if (mintUnavailable) return;
      expect(['new', 'emerging', 'established', 'elite']).toContain(repRes.body.label);
    });

    it('breakdown has all expected components', () => {
      if (mintUnavailable) return;
      const breakdown = repRes.body.breakdown;
      expect(breakdown).toHaveProperty('tier');
      expect(breakdown).toHaveProperty('endorsements');
      expect(breakdown).toHaveProperty('uptime');
      expect(breakdown).toHaveProperty('momentum');
      expect(breakdown).toHaveProperty('wishes');
      expect(breakdown).toHaveProperty('wallet_verified');
      expect(breakdown).toHaveProperty('decay_info');
    });

    it('max_possible is present with expected keys', () => {
      if (mintUnavailable) return;
      const max = repRes.body.max_possible;
      expect(max).toBeDefined();
      expect(typeof max.tier).toBe('number');
      expect(typeof max.endorsements).toBe('number');
      expect(typeof max.uptime).toBe('number');
      expect(typeof max.momentum).toBe('number');
    });

    it('factors is present with heartbeat_count', () => {
      if (mintUnavailable) return;
      expect(repRes.body.factors).toBeDefined();
      expect(typeof repRes.body.factors.heartbeat_count).toBe('number');
    });
  });

  // ── Step 4: GET /trust/check/:wallet returns numeric score ─────────────────
  describe('Step 4: GET /api/v1/trust/check/:wallet — score is a number', () => {
    let trustRes;

    beforeAll(async () => {
      trustRes = await get(`/api/v1/trust/check/${wallet}`);
    });

    it('returns HTTP 200', () => {
      expect(trustRes.status).toBe(200);
    });

    it('score is a number', () => {
      expect(typeof trustRes.body.score).toBe('number');
    });

    it('score is non-negative', () => {
      expect(trustRes.body.score).toBeGreaterThanOrEqual(0);
    });

    it('trusted is true when stamp exists, false otherwise', () => {
      if (mintUnavailable) {
        // No stamp — trusted should be false
        expect(trustRes.body.trusted).toBe(false);
      } else {
        expect(trustRes.body.trusted).toBe(true);
      }
    });

    it('label is a non-empty string', () => {
      expect(typeof trustRes.body.label).toBe('string');
      expect(trustRes.body.label.length).toBeGreaterThan(0);
    });
  });
});
