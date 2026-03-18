/**
 * Flow 3 — Stamp Event Recording + Audit Queries
 *
 * Record events with different outcomes, then query via /api/v1/audit/events
 * with various filters: by outcome, execution-only, full compliance log.
 */

const { makeTestWallet, get, post } = require('./helpers');

describe('Flow 3 — Stamp Event Recording + Audit Queries', () => {
  const wallet = makeTestWallet();
  let deniedEventId;
  let executedEventId;

  // ── Step 1: Record a denied event ─────────────────────────────────────────
  describe('Step 1: POST /api/v1/stamp/event (outcome=denied)', () => {
    let res;

    beforeAll(async () => {
      res = await post('/api/v1/stamp/event', {
        headers: { 'x-wallet-address': wallet },
        body: {
          wallet_address: wallet,
          action: 'access_check',
          outcome: 'denied',
          gate_reason: 'No valid stamp found',
          endpoint: '/api/some-protected-resource',
        },
      });
    });

    it('returns HTTP 201', () => {
      expect(res.status).toBe(201);
    });

    it('returns success: true', () => {
      expect(res.body.success).toBe(true);
    });

    it('returns an event_id', () => {
      expect(res.body.event_id).toBeTruthy();
      deniedEventId = res.body.event_id;
    });

    it('recorded_at is set', () => {
      expect(res.body.recorded_at).toBeTruthy();
    });
  });

  // ── Step 2: Record an executed event ──────────────────────────────────────
  describe('Step 2: POST /api/v1/stamp/event (outcome=executed)', () => {
    let res;

    beforeAll(async () => {
      res = await post('/api/v1/stamp/event', {
        headers: { 'x-wallet-address': wallet },
        body: {
          wallet_address: wallet,
          action: 'api_call',
          outcome: 'executed',
          endpoint: '/api/some-resource',
        },
      });
    });

    it('returns HTTP 201', () => {
      expect(res.status).toBe(201);
    });

    it('returns an event_id', () => {
      expect(res.body.event_id).toBeTruthy();
      executedEventId = res.body.event_id;
    });
  });

  // ── Step 3: GET /audit/events — scoped to wallet ──────────────────────────
  describe('Step 3: GET /api/v1/audit/events (wallet-scoped)', () => {
    let eventsRes;

    beforeAll(async () => {
      eventsRes = await get('/api/v1/audit/events', {
        headers: { 'x-wallet-address': wallet },
      });
    });

    it('returns HTTP 200', () => {
      expect(eventsRes.status).toBe(200);
    });

    it('returns success: true', () => {
      expect(eventsRes.body.success).toBe(true);
    });

    it('events array is present', () => {
      expect(Array.isArray(eventsRes.body.events)).toBe(true);
    });

    it('total is at least 2', () => {
      expect(eventsRes.body.total).toBeGreaterThanOrEqual(2);
    });

    it('both recorded event_ids are present', () => {
      const ids = eventsRes.body.events.map((e) => e.id);
      expect(ids).toContain(deniedEventId);
      expect(ids).toContain(executedEventId);
    });

    it('events include pagination fields', () => {
      expect(eventsRes.body.limit).toBeDefined();
      expect(eventsRes.body.offset).toBeDefined();
    });
  });

  // ── Step 4: GET /audit/events?outcome=denied ──────────────────────────────
  describe('Step 4: GET /api/v1/audit/events?outcome=denied', () => {
    let filteredRes;

    beforeAll(async () => {
      filteredRes = await get('/api/v1/audit/events?outcome=denied', {
        headers: { 'x-wallet-address': wallet },
      });
    });

    it('returns HTTP 200', () => {
      expect(filteredRes.status).toBe(200);
    });

    it('all returned events have outcome=denied', () => {
      for (const evt of filteredRes.body.events) {
        expect(evt.outcome).toBe('denied');
      }
    });

    it('includes the denied event_id', () => {
      const ids = filteredRes.body.events.map((e) => e.id);
      expect(ids).toContain(deniedEventId);
    });

    it('does NOT include the executed event_id', () => {
      const ids = filteredRes.body.events.map((e) => e.id);
      expect(ids).not.toContain(executedEventId);
    });
  });

  // ── Step 5: GET /audit/execution — only positive events ───────────────────
  describe('Step 5: GET /api/v1/audit/execution', () => {
    let execRes;

    beforeAll(async () => {
      execRes = await get('/api/v1/audit/execution', {
        headers: { 'x-wallet-address': wallet },
      });
    });

    it('returns HTTP 200', () => {
      expect(execRes.status).toBe(200);
    });

    it('returns success: true', () => {
      expect(execRes.body.success).toBe(true);
    });

    it('events array is present', () => {
      expect(Array.isArray(execRes.body.events)).toBe(true);
    });
  });

  // ── Step 6: GET /audit/compliance — full log ──────────────────────────────
  describe('Step 6: GET /api/v1/audit/compliance', () => {
    let complianceRes;

    beforeAll(async () => {
      complianceRes = await get('/api/v1/audit/compliance', {
        headers: { 'x-wallet-address': wallet },
      });
    });

    it('returns HTTP 200', () => {
      expect(complianceRes.status).toBe(200);
    });

    it('returns success: true', () => {
      expect(complianceRes.body.success).toBe(true);
    });

    it('events array is present', () => {
      expect(Array.isArray(complianceRes.body.events)).toBe(true);
    });
  });

  // ── Step 7: /audit/events without wallet header → 401 ────────────────────
  describe('Step 7: GET /api/v1/audit/events without auth (401)', () => {
    it('returns HTTP 401', async () => {
      const res = await get('/api/v1/audit/events');
      expect(res.status).toBe(401);
    });

    it('error message mentions wallet or admin key', async () => {
      const res = await get('/api/v1/audit/events');
      expect(res.body.error).toMatch(/wallet|admin/i);
    });
  });

  // ── Step 8: Stamp event — missing wallet header → 401 ────────────────────
  describe('Step 8: POST /api/v1/stamp/event without wallet header (401)', () => {
    it('returns HTTP 401', async () => {
      const res = await post('/api/v1/stamp/event', {
        body: {
          wallet_address: wallet,
          action: 'access_check',
          outcome: 'denied',
        },
      });
      expect(res.status).toBe(401);
    });
  });

  // ── Step 9: Stamp event — mismatched wallets → 403 ───────────────────────
  describe('Step 9: POST /api/v1/stamp/event with mismatched wallets (403)', () => {
    it('returns HTTP 403', async () => {
      const differentWallet = makeTestWallet();
      const res = await post('/api/v1/stamp/event', {
        headers: { 'x-wallet-address': differentWallet },
        body: {
          wallet_address: wallet, // different from header
          action: 'access_check',
          outcome: 'denied',
        },
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/mismatch/i);
    });
  });

  // ── Step 10: Stamp event — invalid outcome → 400 ─────────────────────────
  describe('Step 10: POST /api/v1/stamp/event with invalid outcome (400)', () => {
    it('returns HTTP 400', async () => {
      const res = await post('/api/v1/stamp/event', {
        headers: { 'x-wallet-address': wallet },
        body: {
          wallet_address: wallet,
          action: 'access_check',
          outcome: 'invalid_outcome_xyz',
        },
      });
      expect(res.status).toBe(400);
    });
  });
});
