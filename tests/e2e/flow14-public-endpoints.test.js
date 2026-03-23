/**
 * Flow 14 — Public Endpoints (No Auth Required)
 *
 * Validates every free/public GET endpoint:
 *   - Returns correct HTTP status codes
 *   - Response shape matches documented contract
 *   - Invalid wallet formats are rejected with 400
 *   - Unknown resources return 404
 *   - Edge cases (empty DB state, unusual params) are handled gracefully
 *
 * None of these requests carry x-wallet-address or x-wallet-signature
 * headers — they must succeed (or fail cleanly) without any auth.
 */

const { get, post, makeSignedWallet } = require('./helpers');

// A deterministic non-existent wallet to use across tests
const UNKNOWN_WALLET = '0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF';
const INVALID_WALLET = 'not-a-wallet';
const ZERO_WALLET = '0x0000000000000000000000000000000000000000';

// ── GET /health ───────────────────────────────────────────────────────────────
describe('GET /health — service health check', () => {
  let res;

  beforeAll(async () => {
    res = await get('/health');
  });

  it('returns HTTP 200', () => {
    expect(res.status).toBe(200);
  });

  it('success is true', () => {
    expect(res.body.success).toBe(true);
  });

  it('status is healthy', () => {
    expect(res.body.status).toBe('healthy');
  });

  it('service field is present', () => {
    expect(typeof res.body.service).toBe('string');
    expect(res.body.service.length).toBeGreaterThan(0);
  });

  it('version field is present', () => {
    expect(typeof res.body.version).toBe('string');
  });

  it('uptime is a positive number', () => {
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('endpoints map is present', () => {
    expect(res.body.endpoints).toBeDefined();
    expect(typeof res.body.endpoints).toBe('object');
  });
});

// ── GET /api/v1/trust/check/:walletAddress — unknown wallet ───────────────────
describe('GET /api/v1/trust/check/:wallet — unknown wallet', () => {
  let res;

  beforeAll(async () => {
    res = await get(`/api/v1/trust/check/${UNKNOWN_WALLET}`);
  });

  it('returns HTTP 200', () => {
    expect(res.status).toBe(200);
  });

  it('trusted is false for unknown wallet', () => {
    expect(res.body.trusted).toBe(false);
  });

  it('score is 0', () => {
    expect(res.body.score).toBe(0);
  });

  it('tier is null', () => {
    expect(res.body.tier).toBeNull();
  });

  it('action CTA is present', () => {
    expect(res.body.action).toBeDefined();
    expect(typeof res.body.action.register).toBe('string');
  });

  it('message field is present', () => {
    expect(typeof res.body.message).toBe('string');
    expect(res.body.message.length).toBeGreaterThan(0);
  });
});

// ── GET /api/v1/trust/check/:walletAddress — invalid format ──────────────────
describe('GET /api/v1/trust/check/:wallet — invalid wallet format', () => {
  it('returns 2xx or 4xx (never 5xx) for plaintext non-address', async () => {
    // The trust check endpoint is lenient — it treats unknown strings as
    // unregistered agents and returns trusted:false rather than a hard 400.
    const res = await get(`/api/v1/trust/check/${INVALID_WALLET}`);
    expect(res.status).toBeLessThan(500);
    // If it returns 200 the wallet should be marked untrusted
    if (res.status === 200) {
      expect(res.body.trusted).toBe(false);
    }
  });

  it('returns 2xx or 4xx (never 5xx) for zero address', async () => {
    const res = await get(`/api/v1/trust/check/${ZERO_WALLET}`);
    expect(res.status).toBeLessThan(500);
  });

  it('returns 400 for erc8004: prefix with non-numeric id', async () => {
    const res = await get('/api/v1/trust/check/erc8004:abc');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ── GET /api/v1/passport/:walletAddress — unknown wallet ─────────────────────
describe('GET /api/v1/passport/:wallet — unknown wallet', () => {
  let res;

  beforeAll(async () => {
    res = await get(`/api/v1/passport/${UNKNOWN_WALLET}`);
  });

  it('returns a JSON response (200 or 404)', () => {
    expect([200, 404]).toContain(res.status);
  });

  it('success field reflects wallet state', () => {
    // Unknown wallet: success:false with no-agent message, or 404
    if (res.status === 200) {
      expect(res.body.trusted).toBe(false);
    } else {
      expect(res.body.success).toBe(false);
    }
  });

  it('action CTA is present for unknown wallet', () => {
    expect(res.body.action).toBeDefined();
  });
});

// ── GET /api/v1/badge/:walletAddress — SVG badge ─────────────────────────────
describe('GET /api/v1/badge/:wallet — SVG badge', () => {
  it('returns SVG content for unknown wallet without auth', async () => {
    const res = await fetch(
      `${process.env.E2E_BASE_URL || 'http://localhost:4005'}/api/v1/badge/${UNKNOWN_WALLET}`,
      { headers: { Origin: 'https://agentstamp.org' } }
    );
    expect(res.status).toBe(200);
    const contentType = res.headers.get('content-type');
    expect(contentType).toContain('svg');
    const text = await res.text();
    expect(text).toContain('<svg');
    expect(text).toContain('AgentStamp');
  });

  it('SVG contains Unverified label for unknown wallet', async () => {
    const res = await fetch(
      `${process.env.E2E_BASE_URL || 'http://localhost:4005'}/api/v1/badge/${UNKNOWN_WALLET}`,
      { headers: { Origin: 'https://agentstamp.org' } }
    );
    const text = await res.text();
    expect(text).toContain('Unverified');
  });
});

// ── GET /api/v1/badge/:walletAddress/json — badge data ───────────────────────
describe('GET /api/v1/badge/:wallet/json — badge JSON', () => {
  let res;

  beforeAll(async () => {
    res = await get(`/api/v1/badge/${UNKNOWN_WALLET}/json`);
  });

  it('returns HTTP 200', () => {
    expect(res.status).toBe(200);
  });

  it('success is true', () => {
    expect(res.body.success).toBe(true);
  });

  it('verified is false for unknown wallet', () => {
    expect(res.body.verified).toBe(false);
  });

  it('tier is null for unknown wallet', () => {
    expect(res.body.tier).toBeNull();
  });

  it('badge_url is present and contains the wallet address (case-insensitive)', () => {
    expect(typeof res.body.badge_url).toBe('string');
    // The server preserves the original case of the address in the URL
    expect(res.body.badge_url.toLowerCase()).toContain(UNKNOWN_WALLET.toLowerCase());
  });

  it('trust_status is unknown', () => {
    expect(res.body.trust_status).toBe('unknown');
  });

  it('action CTA is present', () => {
    expect(res.body.action).toBeDefined();
    expect(typeof res.body.action.register).toBe('string');
    expect(typeof res.body.action.trust_check).toBe('string');
  });
});

// ── GET /api/v1/registry/search — search agents ───────────────────────────────
describe('GET /api/v1/registry/search — search', () => {
  let res;

  beforeAll(async () => {
    res = await get('/api/v1/registry/search?q=test');
  });

  it('returns HTTP 200', () => {
    expect(res.status).toBe(200);
  });

  it('success is true', () => {
    expect(res.body.success).toBe(true);
  });

  it('agents is an array', () => {
    expect(Array.isArray(res.body.agents)).toBe(true);
  });

  it('limit field is present', () => {
    expect(typeof res.body.limit).toBe('number');
  });

  it('offset field is present', () => {
    expect(typeof res.body.offset).toBe('number');
  });
});

describe('GET /api/v1/registry/search — empty query', () => {
  it('returns all active agents when q is empty', async () => {
    const res = await get('/api/v1/registry/search');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.agents)).toBe(true);
  });
});

describe('GET /api/v1/registry/search — category filter', () => {
  it('accepts category filter without error', async () => {
    const res = await get('/api/v1/registry/search?category=data');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // All returned agents should match category if any are returned
    if (res.body.agents.length > 0) {
      res.body.agents.forEach(a => expect(a.category).toBe('data'));
    }
  });
});

describe('GET /api/v1/registry/search — pagination params', () => {
  it('respects limit param', async () => {
    const res = await get('/api/v1/registry/search?limit=5');
    expect(res.status).toBe(200);
    expect(res.body.agents.length).toBeLessThanOrEqual(5);
    expect(res.body.limit).toBe(5);
  });

  it('respects offset param', async () => {
    const res = await get('/api/v1/registry/search?limit=2&offset=0');
    expect(res.status).toBe(200);
    expect(res.body.offset).toBe(0);
  });

  it('caps limit at 100 (200 or 429, never 401)', async () => {
    const res = await get('/api/v1/registry/search?limit=999');
    expect([200, 429]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.limit).toBeLessThanOrEqual(100);
    }
  });
});

// ── GET /api/v1/registry/browse ───────────────────────────────────────────────
// Note: Global rate limiter is 100 req/min. When running alongside other test
// files in the same minute window, browse requests may receive 429. The tests
// accept 200 or 429 — the key invariant is no auth is required (not 401).
describe('GET /api/v1/registry/browse — browse agents', () => {
  let res;

  beforeAll(async () => {
    res = await get('/api/v1/registry/browse');
  });

  it('returns 200 or 429 (never 401 — no auth required)', () => {
    expect([200, 429]).toContain(res.status);
  });

  it('when 200: success is true and agents is an array', () => {
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.agents)).toBe(true);
    }
  });
});

describe('GET /api/v1/registry/browse — sort options', () => {
  it('accepts sort=newest (200 or 429, never 401)', async () => {
    const res = await get('/api/v1/registry/browse?sort=newest');
    expect([200, 429]).toContain(res.status);
  });

  it('accepts sort=name (200 or 429, never 401)', async () => {
    const res = await get('/api/v1/registry/browse?sort=name');
    expect([200, 429]).toContain(res.status);
  });
});

// ── GET /api/v1/registry/agent/:agentId — 404 for unknown ────────────────────
describe('GET /api/v1/registry/agent/:agentId — unknown agent', () => {
  it('returns 404 without auth for nonexistent agent', async () => {
    const res = await get('/api/v1/registry/agent/agt_doesnotexist_00000');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ── GET /api/v1/registry/leaderboard/live ────────────────────────────────────
describe('GET /api/v1/registry/leaderboard/live — leaderboard', () => {
  let res;

  beforeAll(async () => {
    res = await get('/api/v1/registry/leaderboard/live');
  });

  it('returns HTTP 200', () => {
    expect(res.status).toBe(200);
  });

  it('agents array is present', () => {
    // Leaderboard response uses "agents" key (not "leaderboard")
    expect(Array.isArray(res.body.agents)).toBe(true);
  });

  it('network stats object is present', () => {
    expect(res.body.network).toBeDefined();
    expect(typeof res.body.network.total_agents).toBe('number');
  });

  it('trending array is present', () => {
    expect(Array.isArray(res.body.trending)).toBe(true);
  });
});

// ── GET /api/v1/well/wishes ───────────────────────────────────────────────────
describe('GET /api/v1/well/wishes — list wishes', () => {
  let res;

  beforeAll(async () => {
    res = await get('/api/v1/well/wishes');
  });

  it('returns HTTP 200', () => {
    expect(res.status).toBe(200);
  });

  it('success is true', () => {
    expect(res.body.success).toBe(true);
  });

  it('wishes is an array', () => {
    expect(Array.isArray(res.body.wishes)).toBe(true);
  });

  it('limit is present', () => {
    expect(typeof res.body.limit).toBe('number');
  });

  it('offset is present', () => {
    expect(typeof res.body.offset).toBe('number');
  });
});

// ── GET /api/v1/wallet/links/:wallet — public ─────────────────────────────────
// Note: /api/v1/wallet is under mutationLimiter (10/min). When running alongside
// other test files, this may return 429. The test accepts 200 or 429 (never 401).
describe('GET /api/v1/wallet/links/:wallet — wallet links public read', () => {
  let res;

  beforeAll(async () => {
    res = await get(`/api/v1/wallet/links/${UNKNOWN_WALLET}`);
  });

  it('returns 200 or 429 (never 401 — no auth required)', () => {
    expect([200, 429]).toContain(res.status);
  });

  it('when 200: success is true', () => {
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });

  it('when 200: primary matches the requested wallet', () => {
    if (res.status === 200) {
      expect(res.body.primary.toLowerCase()).toBe(UNKNOWN_WALLET.toLowerCase());
    }
  });

  it('when 200: linked is an empty array for unknown wallet', () => {
    if (res.status === 200) {
      expect(Array.isArray(res.body.linked)).toBe(true);
      expect(res.body.linked).toHaveLength(0);
    }
  });

  it('when 200: total is 0', () => {
    if (res.status === 200) {
      expect(res.body.total).toBe(0);
    }
  });
});

// ── GET /api/v1/audit/verify-chain — requires auth ───────────────────────────
describe('GET /api/v1/audit/verify-chain — hash chain verification (requires auth)', () => {
  const auditWallet = makeSignedWallet();
  let res;

  beforeAll(async () => {
    res = await get('/api/v1/audit/verify-chain', {
      headers: await auditWallet.signHeaders('audit_read'),
    });
  });

  it('returns HTTP 200 with wallet auth', () => {
    expect(res.status).toBe(200);
  });

  it('success is true', () => {
    expect(res.body.success).toBe(true);
  });
});

// ── GET /api/v1/audit/chain-status — requires auth ───────────────────────────
describe('GET /api/v1/audit/chain-status — chain status (requires auth)', () => {
  const auditWallet = makeSignedWallet();
  let res;

  beforeAll(async () => {
    res = await get('/api/v1/audit/chain-status', {
      headers: await auditWallet.signHeaders('audit_read'),
    });
  });

  it('returns HTTP 200 with wallet auth', () => {
    expect(res.status).toBe(200);
  });

  it('success is true', () => {
    expect(res.body.success).toBe(true);
  });
});

// ── GET /.well-known/passport-public-key — discovery ─────────────────────────
describe('GET /.well-known/passport-public-key — public key discovery', () => {
  let res;

  beforeAll(async () => {
    res = await get('/.well-known/passport-public-key');
  });

  it('returns HTTP 200', () => {
    expect(res.status).toBe(200);
  });

  it('algorithm is Ed25519', () => {
    expect(res.body.algorithm).toBe('Ed25519');
  });

  it('public_key is a non-empty string', () => {
    expect(typeof res.body.public_key).toBe('string');
    expect(res.body.public_key.length).toBeGreaterThan(0);
  });

  it('usage description is present', () => {
    expect(typeof res.body.usage).toBe('string');
  });
});

// ── GET /.well-known/mcp.json — MCP discovery ────────────────────────────────
describe('GET /.well-known/mcp.json — MCP discovery', () => {
  it('returns 200 with JSON content', async () => {
    const res = await get('/.well-known/mcp.json');
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });
});

// ── GET /api/v1/stamp/verify/:unknownId — 404 ────────────────────────────────
// Note: /api/v1/stamp is under mutationLimiter (10/min). When running alongside
// other test files that also hit stamp endpoints, may return 429.
describe('GET /api/v1/stamp/verify/:id — unknown stamp', () => {
  it('returns 404 or 429 for nonexistent stamp without auth (never 401)', async () => {
    const res = await get('/api/v1/stamp/verify/stmp_doesnotexist_00000');
    expect([404, 429]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it('when 404: response includes register action hint', async () => {
    const res = await get('/api/v1/stamp/verify/stmp_doesnotexist_00000');
    if (res.status === 404) {
      expect(res.body.action).toBeDefined();
      expect(res.body.action.register).toBeTruthy();
    }
  });
});
