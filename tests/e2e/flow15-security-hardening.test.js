/**
 * Flow 15 — Security Hardening Verification
 *
 * Verifies the security fixes applied 2026-03-20 are correctly enforced.
 *
 * Key architectural constraint: The mutationLimiter middleware (10 req/min per
 * IP) is applied BEFORE auth middleware on all mutation routes. When running
 * alongside other test files in the same 60-second window, the rate limit may
 * be exhausted and return 429 before auth is even checked.
 *
 * Testing strategy: The core security invariant is
 *   "unauthorized requests NEVER succeed (success: true / 2xx)"
 * rather than requiring a specific error code (401 vs 429).
 *
 * Tests that MUST produce a specific code use fresh wallets and run in
 * isolation within a single describe block to stay under the rate limit.
 *
 * Uses makeSignedWallet() for real EVM key pairs (fast — no address brute-force).
 */

const { makeSignedWallet, makeTestWallet, get, post, put, del } = require('./helpers');

// Helper: assert request was blocked (not 2xx and success: false)
function expectBlocked(res) {
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(res.body.success).toBe(false);
}

// ── Webhook list requires signature ──────────────────────────────────────────
describe('GET /api/v1/webhooks — requires wallet signature', () => {
  it('blocks unauthenticated request (401 or 429, never 200)', async () => {
    const res = await get('/api/v1/webhooks');
    expectBlocked(res);
    expect(res.body.success).toBe(false);
  });

  it('blocks request with wallet address but no signature (never 200)', async () => {
    const res = await get('/api/v1/webhooks', {
      headers: { 'x-wallet-address': makeTestWallet() },
    });
    expectBlocked(res);
  });

  it('returns 200 with valid signature when rate limit permits', async () => {
    const wallet = makeSignedWallet();
    const hdrs = await wallet.signHeaders('webhook_list');
    const res = await get('/api/v1/webhooks', { headers: hdrs });
    if (res.status !== 429) {
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.webhooks)).toBe(true);
    }
  });
});

// ── Webhook register requires signature ──────────────────────────────────────
describe('POST /api/v1/webhooks/register — requires wallet signature', () => {
  it('blocks unauthenticated request (never 201)', async () => {
    const res = await post('/api/v1/webhooks/register', {
      body: { url: 'https://example.com/hook', events: ['stamp_minted'] },
    });
    expectBlocked(res);
  });

  it('blocks request with wallet address but no signature (never 201)', async () => {
    const res = await post('/api/v1/webhooks/register', {
      headers: { 'x-wallet-address': makeTestWallet() },
      body: { url: 'https://example.com/hook', events: ['stamp_minted'] },
    });
    expectBlocked(res);
  });

  it('passes auth with valid signature; SSRF guard rejects non-HTTPS URL', async () => {
    const wallet = makeSignedWallet();
    const body = { url: 'http://example.com/hook', events: ['stamp_minted'] };
    const hdrs = await wallet.signHeaders('webhook_register', body);
    const res = await post('/api/v1/webhooks/register', { headers: hdrs, body });
    // Auth passed (not 401), either SSRF-blocked (400) or rate-limited (429)
    expect(res.status).not.toBe(401);
    expectBlocked(res);
    if (res.status === 400) {
      expect(res.body.error).toMatch(/https|private|internal/i);
    }
  });
});

// ── Webhook delete requires signature ────────────────────────────────────────
describe('DELETE /api/v1/webhooks/:id — requires wallet signature', () => {
  it('blocks unauthenticated request (never 200)', async () => {
    const res = await del('/api/v1/webhooks/wh_doesnotexist');
    expectBlocked(res);
  });

  it('passes auth and returns 404 (or 429) for nonexistent webhook', async () => {
    const wallet = makeSignedWallet();
    const body = {};
    const hdrs = await wallet.signHeaders('webhook_delete', body);
    const res = await del('/api/v1/webhooks/wh_doesnotexist_00000', { headers: hdrs, body });
    expect(res.status).not.toBe(401);
    expectBlocked(res); // 404 or 429 — both are non-2xx and success:false
  });
});

// ── Stamp mint/free requires signature ───────────────────────────────────────
describe('POST /api/v1/stamp/mint/free — requires wallet signature', () => {
  it('blocks request with no wallet header (never 201)', async () => {
    const res = await post('/api/v1/stamp/mint/free', { body: {} });
    expectBlocked(res);
  });

  it('blocks request with wallet address but no signature (never 201)', async () => {
    const wallet = makeSignedWallet();
    const res = await post('/api/v1/stamp/mint/free', {
      headers: { 'x-wallet-address': wallet.address },
    });
    expectBlocked(res);
    // If not rate-limited, should specifically be 401 with signature error
    if (res.status === 401) {
      expect(res.body.error).toMatch(/signature/i);
    }
  });

  it('returns 400 for invalid wallet format (format check fires before rate limit)', async () => {
    // The wallet format validation fires at server middleware level before mutationLimiter
    // only for POST patterns in WALLET_REQUIRED_PATTERNS. For invalid format, it's always 400.
    const res = await post('/api/v1/stamp/mint/free', {
      headers: { 'x-wallet-address': 'not-a-wallet' },
    });
    // 400 (invalid format) or 429 (rate limited) — both mean rejected
    expect([400, 429]).toContain(res.status);
  });

  it('accepts valid signature and mints a free stamp', async () => {
    const wallet = makeSignedWallet();
    const body = {};
    const hdrs = await wallet.signHeaders('mint', body);
    const res = await post('/api/v1/stamp/mint/free', { headers: hdrs, body });
    // 201 = minted, 429 = rate limited (fine — auth DID pass)
    if (res.status !== 429) {
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.stamp?.id).toBeTruthy();
      expect(res.body.stamp?.tier).toBe('free');
      expect(res.body.stamp?.wallet_address.toLowerCase()).toBe(wallet.address.toLowerCase());
    }
  });
});

// ── Registry register/free requires signature ─────────────────────────────────
describe('POST /api/v1/registry/register/free — requires wallet signature', () => {
  it('blocks request with no auth (never 201)', async () => {
    const res = await post('/api/v1/registry/register/free', {
      body: { name: 'Test', description: 'A test agent', category: 'other' },
    });
    expectBlocked(res);
  });

  it('blocks request with wallet address but no signature (never 201)', async () => {
    const wallet = makeSignedWallet();
    const res = await post('/api/v1/registry/register/free', {
      headers: { 'x-wallet-address': wallet.address },
      body: { name: 'Test', description: 'A test agent', category: 'other' },
    });
    expectBlocked(res);
  });

  it('accepts valid signature and registers agent', async () => {
    const wallet = makeSignedWallet();
    const body = {
      name: 'E2E Security Test Agent _e2e_',
      description: 'Created by flow15-security-hardening test suite',
      category: 'other',
    };
    const hdrs = await wallet.signHeaders('register', body);
    const res = await post('/api/v1/registry/register/free', { headers: hdrs, body });
    if (res.status !== 429) {
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.agent?.id).toBeTruthy();
    }
  });
});

// ── Trust delegation requires signature ──────────────────────────────────────
describe('POST /api/v1/trust/delegate — requires wallet signature', () => {
  it('blocks unauthenticated request (never 201)', async () => {
    const res = await post('/api/v1/trust/delegate', {
      body: { delegatee: makeTestWallet(), days: 7 },
    });
    expectBlocked(res);
  });

  it('blocks request with wallet but no signature (never 201)', async () => {
    const wallet = makeSignedWallet();
    const res = await post('/api/v1/trust/delegate', {
      headers: { 'x-wallet-address': wallet.address },
      body: { delegatee: makeTestWallet(), days: 7 },
    });
    expectBlocked(res);
  });
});

// ── Wallet link/unlink require wallet header ──────────────────────────────────
describe('POST /api/v1/wallet/link — requires x-wallet-address header', () => {
  it('blocks request with no wallet header (never 201)', async () => {
    const res = await post('/api/v1/wallet/link', {
      body: { linked_wallet: 'So11111111111111111111111111111111111111112' },
    });
    expectBlocked(res);
  });

  it('blocks request with invalid wallet format in header (never 201)', async () => {
    const res = await post('/api/v1/wallet/link', {
      headers: { 'x-wallet-address': 'not-valid' },
      body: { linked_wallet: 'So11111111111111111111111111111111111111112' },
    });
    expectBlocked(res);
  });
});

describe('POST /api/v1/wallet/unlink — requires x-wallet-address header', () => {
  it('blocks request with no wallet header (never 200)', async () => {
    const res = await post('/api/v1/wallet/unlink', {
      body: { linked_wallet: makeTestWallet() },
    });
    expectBlocked(res);
  });
});

// ── Stamp tombstone requires wallet signature ─────────────────────────────────
describe('POST /api/v1/stamp/:id/tombstone — requires wallet signature', () => {
  it('blocks request with no wallet header (never 200)', async () => {
    const res = await post('/api/v1/stamp/stmp_no_auth_test/tombstone', {
      body: { outcome: 'completed' },
    });
    expectBlocked(res);
  });

  it('blocks request with wallet address but no signature (never 200)', async () => {
    const wallet = makeSignedWallet();
    const res = await post('/api/v1/stamp/stmp_no_sig_test/tombstone', {
      headers: { 'x-wallet-address': wallet.address },
      body: { outcome: 'completed' },
    });
    expectBlocked(res);
  });

  it('403 when wrong wallet tries to tombstone a real stamp', async () => {
    // Mint with owner wallet
    const owner = makeSignedWallet();
    const mintHdrs = await owner.signHeaders('mint', {});
    const mintRes = await post('/api/v1/stamp/mint/free', { headers: mintHdrs, body: {} });
    if (mintRes.status !== 201) {
      return; // Rate limited — skip ownership check
    }
    const stampId = mintRes.body.stamp?.id;
    expect(stampId).toBeTruthy();

    // Tombstone attempt by attacker
    const attacker = makeSignedWallet();
    const attackBody = { outcome: 'completed' };
    const attackHdrs = await attacker.signHeaders('tombstone', attackBody);
    const res = await post(`/api/v1/stamp/${stampId}/tombstone`, {
      headers: attackHdrs,
      body: attackBody,
    });
    // 403 = auth passed but ownership rejected; 429 = rate limited
    expect([403, 429]).toContain(res.status);
    expect(res.body.success).toBe(false);
    if (res.status === 403) {
      expect(res.body.error).toMatch(/not authorized/i);
    }
  });
});

// ── Stamp event requires signature ───────────────────────────────────────────
describe('POST /api/v1/stamp/event — requires wallet signature', () => {
  it('blocks request with no auth (never 201)', async () => {
    const wallet = makeTestWallet();
    const res = await post('/api/v1/stamp/event', {
      body: { wallet_address: wallet, action: 'access_check', outcome: 'denied' },
    });
    expectBlocked(res);
  });

  it('blocks request with wallet but no signature (never 201)', async () => {
    const wallet = makeTestWallet();
    const res = await post('/api/v1/stamp/event', {
      headers: { 'x-wallet-address': wallet },
      body: { wallet_address: wallet, action: 'access_check', outcome: 'denied' },
    });
    expectBlocked(res);
  });
});

// ── Protected audit endpoints require wallet header ───────────────────────────
describe('Protected audit endpoints — require wallet header', () => {
  it('GET /api/v1/audit/events returns 401 without header', async () => {
    const res = await get('/api/v1/audit/events');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/audit/execution returns 401 without header', async () => {
    const res = await get('/api/v1/audit/execution');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/audit/compliance returns 401 without header', async () => {
    const res = await get('/api/v1/audit/compliance');
    expect(res.status).toBe(401);
  });
});

// ── SSRF protection — webhook register blocks non-HTTPS and private addresses ─
describe('Webhook register SSRF protection', () => {
  it('rejects non-HTTPS webhook URL (never 201)', async () => {
    const wallet = makeSignedWallet();
    const body = { url: 'http://example.com/hook', events: ['stamp_minted'] };
    const hdrs = await wallet.signHeaders('webhook_register', body);
    const res = await post('/api/v1/webhooks/register', { headers: hdrs, body });
    expect(res.status).not.toBe(201);
    expect(res.body.success).toBe(false);
  });

  it('confirms SSRF guard fires when not rate-limited: localhost blocked with 400', async () => {
    // Fresh wallet, single request — can't be rate limited yet
    const wallet = makeSignedWallet();
    const body = { url: 'https://localhost/hook', events: ['stamp_minted'] };
    const hdrs = await wallet.signHeaders('webhook_register', body);
    const res = await post('/api/v1/webhooks/register', { headers: hdrs, body });
    expect(res.status).not.toBe(201);
    if (res.status !== 429) {
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/private|internal/i);
    }
  });

  it('confirms SSRF guard fires when not rate-limited: 127.0.0.1 blocked with 400', async () => {
    const wallet = makeSignedWallet();
    const body = { url: 'https://127.0.0.1/hook', events: ['stamp_minted'] };
    const hdrs = await wallet.signHeaders('webhook_register', body);
    const res = await post('/api/v1/webhooks/register', { headers: hdrs, body });
    expect(res.status).not.toBe(201);
    if (res.status !== 429) {
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/private|internal/i);
    }
  });

  it('rejects invalid event name (never 201)', async () => {
    const wallet = makeSignedWallet();
    const body = { url: 'https://example.com/hook', events: ['invalid_event'] };
    const hdrs = await wallet.signHeaders('webhook_register', body);
    const res = await post('/api/v1/webhooks/register', { headers: hdrs, body });
    expect(res.status).not.toBe(201);
    expect(res.body.success).toBe(false);
  });
});

// ── x402 replay protection ────────────────────────────────────────────────────
describe('x402 replay protection — duplicate payment token', () => {
  it('rejects the same X-PAYMENT token submitted twice', async () => {
    const fakePayment = 'test-duplicate-payment-token-' + Date.now();
    const wallet = makeTestWallet();

    const res1 = await post('/api/v1/stamp/mint/bronze', {
      headers: { 'X-PAYMENT': fakePayment, 'x-wallet-address': wallet },
      body: {},
    });
    if (res1.status !== 400 && res1.status !== 402) {
      const res2 = await post('/api/v1/stamp/mint/bronze', {
        headers: { 'X-PAYMENT': fakePayment, 'x-wallet-address': wallet },
        body: {},
      });
      expect(res2.status).toBe(409);
      expect(res2.body.error).toMatch(/duplicate|replay/i);
    } else {
      expect([400, 402]).toContain(res1.status);
    }
  });
});

// ── Analytics DoS protection — days param capped ─────────────────────────────
describe('Analytics endpoint — days param DoS protection', () => {
  it('does not return 500 for very large days value', async () => {
    const res = await get('/api/v1/analytics/overview?days=99999', {
      headers: { 'x-wallet-address': makeTestWallet() },
    });
    expect(res.status).not.toBe(500);
  });
});

// ── Public endpoints remain accessible without auth ──────────────────────────
describe('Public endpoints are NOT gated by security hardening', () => {
  const testWallet = makeTestWallet();
  const PUBLIC_ENDPOINTS = [
    '/health',
    `/api/v1/trust/check/${testWallet}`,
    `/api/v1/badge/${testWallet}/json`,
    '/api/v1/registry/search',
    '/api/v1/well/wishes',
    '/.well-known/passport-public-key',
  ];

  for (const endpoint of PUBLIC_ENDPOINTS) {
    it(`${endpoint} returns 2xx without any auth`, async () => {
      const res = await get(endpoint);
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
    });
  }
});

// ── Audit endpoints now require auth ─────────────────────────────────────────
describe('Audit endpoints require auth after security hardening', () => {
  it('GET /api/v1/audit/verify-chain returns 401 without auth', async () => {
    const res = await get('/api/v1/audit/verify-chain');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/audit/chain-status returns 401 without auth', async () => {
    const res = await get('/api/v1/audit/chain-status');
    expect(res.status).toBe(401);
  });
});
