/**
 * Flow 15 — v2.3.0 Features: Compliance, Human Sponsor, Browse Total
 *
 * Tests new v2.3.0 features via HTTP API only.
 * Update endpoints require x402 payment — skipped in E2E.
 */

const { get, post, makeSignedWallet } = require('./helpers');

describe('Flow 15 — v2.3.0 Features', () => {
  let wallet;
  let agentId;

  beforeAll(async () => {
    wallet = makeSignedWallet();

    // Register a test agent with human_sponsor
    const body = {
      wallet_address: wallet.address,
      name: '_e2e_v230_test',
      description: 'E2E test for v2.3.0 features',
      category: 'research',
      human_sponsor: 'test@example.com',
    };
    const sigHeaders = await wallet.signHeaders('register', body);
    const res = await post('/api/v1/registry/register/free', {
      headers: sigHeaders,
      body,
    });
    if (res.status === 201) {
      agentId = res.body.agent?.id;
    }
  });

  afterAll(async () => {
    // Cleanup: tombstone the test agent's stamp if any
    // Agent will auto-expire after 30 days
  });

  describe('Registration with human_sponsor', () => {
    it('registration succeeded', () => {
      expect(agentId).toBeDefined();
    });

    it('passport includes accountability with human_sponsor', async () => {
      const res = await get(`/api/v1/passport/${wallet.address}`);
      expect(res.status).toBe(200);
      // Passport is wrapped: { success, passport: { ..., accountability } }
      const passport = res.body.passport || res.body;
      expect(passport.accountability).toBeDefined();
      expect(passport.accountability.human_sponsor).toBe('test@example.com');
    });
  });

  describe('Compliance report', () => {
    it('returns structured compliance report', async () => {
      const res = await get(`/api/v1/compliance/readiness/${agentId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.agent_id).toBe(agentId);
      expect(res.body.ai_act).toBeDefined();
      expect(res.body.ai_act.transparency.is_ai_agent).toBe(true);
      expect(res.body.ai_act.transparency.human_sponsor).toBe('test@example.com');
    });

    it('article_52_disclosure is a structured object', async () => {
      const res = await get(`/api/v1/compliance/readiness/${agentId}`);
      const disclosure = res.body.ai_act.article_52_disclosure;
      expect(typeof disclosure).toBe('object');
      expect(disclosure.is_ai_system).toBe(true);
      expect(disclosure.registry).toBe('agentstamp.org');
    });

    it('returns 404 for nonexistent agent', async () => {
      const res = await get('/api/v1/compliance/readiness/agt_doesnotexist');
      expect(res.status).toBe(404);
    });
  });

  describe('Browse API total', () => {
    it('response includes total field', async () => {
      const res = await get('/api/v1/registry/browse?limit=1');
      expect(res.status).toBe(200);
      expect(typeof res.body.total).toBe('number');
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('total >= returned agents count', async () => {
      const res = await get('/api/v1/registry/browse?limit=2');
      expect(res.body.total).toBeGreaterThanOrEqual(res.body.agents.length);
    });
  });

  describe('Health reports v2.3.0', () => {
    it('health endpoint returns version 2.3.0', async () => {
      const res = await get('/health');
      expect(res.status).toBe(200);
      expect(res.body.version).toBe('2.3.0');
    });
  });
});
