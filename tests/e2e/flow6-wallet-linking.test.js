/**
 * Flow 6 — Wallet Linking + Cross-Chain Trust
 *
 * link → view links → trust resolves via secondary → unlink
 */

const { makeTestWallet, get, post } = require('./helpers');

// A valid Solana-style address (base58, 32-44 chars) that passes the validator
const SOLANA_SECONDARY = 'So11111111111111111111111111111111111111112'; // 44 chars, valid base58

describe('Flow 6 — Wallet Linking + Cross-Chain Trust', () => {
  const primaryWallet = makeTestWallet();

  // Ensure the primary has a stamp so trust check returns real data
  beforeAll(async () => {
    const res = await post('/api/v1/stamp/mint/free', {
      headers: { 'x-wallet-address': primaryWallet },
    });
    expect(res.status).toBe(201);
  });

  // ── Step 1: Link secondary wallet ────────────────────────────────────────
  describe('Step 1: POST /api/v1/wallet/link', () => {
    let linkRes;

    beforeAll(async () => {
      linkRes = await post('/api/v1/wallet/link', {
        headers: { 'x-wallet-address': primaryWallet },
        body: {
          linked_wallet: SOLANA_SECONDARY,
          chain_hint: 'solana',
        },
      });
    });

    it('returns HTTP 201', () => {
      expect(linkRes.status).toBe(201);
    });

    it('returns success: true', () => {
      expect(linkRes.body.success).toBe(true);
    });

    it('wallets.primary matches primaryWallet', () => {
      expect(linkRes.body.wallets.primary).toBe(primaryWallet);
    });

    it('linked array contains the secondary wallet', () => {
      const addresses = linkRes.body.wallets.linked.map((l) => l.address);
      expect(addresses).toContain(SOLANA_SECONDARY);
    });

    it('linked wallet has chain hint set to solana', () => {
      const linked = linkRes.body.wallets.linked.find(
        (l) => l.address === SOLANA_SECONDARY
      );
      expect(linked?.chain).toBe('solana');
    });
  });

  // ── Step 2: View links via GET /wallet/links/:wallet ─────────────────────
  describe('Step 2: GET /api/v1/wallet/links/:wallet', () => {
    let linksRes;

    beforeAll(async () => {
      linksRes = await get(`/api/v1/wallet/links/${primaryWallet}`);
    });

    it('returns HTTP 200', () => {
      expect(linksRes.status).toBe(200);
    });

    it('returns success: true', () => {
      expect(linksRes.body.success).toBe(true);
    });

    it('primary is the primary wallet', () => {
      expect(linksRes.body.primary).toBe(primaryWallet);
    });

    it('linked array contains the secondary wallet', () => {
      const addresses = linksRes.body.linked.map((l) => l.address);
      expect(addresses).toContain(SOLANA_SECONDARY);
    });

    it('total is at least 1', () => {
      expect(linksRes.body.total).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Step 3: Trust check via secondary wallet resolves to primary ──────────
  describe('Step 3: GET /api/v1/trust/check/:solanaWallet', () => {
    let trustRes;

    beforeAll(async () => {
      trustRes = await get(`/api/v1/trust/check/${SOLANA_SECONDARY}`);
    });

    it('returns HTTP 200', () => {
      expect(trustRes.status).toBe(200);
    });

    it('trusted is true (resolved from primary stamp)', () => {
      expect(trustRes.body.trusted).toBe(true);
    });

    it('resolved_to is the primary wallet', () => {
      expect(trustRes.body.resolved_to).toBe(primaryWallet);
    });

    it('linked_from is the solana secondary wallet', () => {
      expect(trustRes.body.linked_from).toBe(SOLANA_SECONDARY);
    });

    it('stamp tier is free', () => {
      expect(trustRes.body.stamp?.tier).toBe('free');
    });
  });

  // ── Step 4: Unlink secondary wallet ──────────────────────────────────────
  describe('Step 4: POST /api/v1/wallet/unlink', () => {
    let unlinkRes;

    beforeAll(async () => {
      unlinkRes = await post('/api/v1/wallet/unlink', {
        headers: { 'x-wallet-address': primaryWallet },
        body: { linked_wallet: SOLANA_SECONDARY },
      });
    });

    it('returns HTTP 200', () => {
      expect(unlinkRes.status).toBe(200);
    });

    it('returns success: true', () => {
      expect(unlinkRes.body.success).toBe(true);
    });

    it('linked array no longer contains the secondary wallet', () => {
      const addresses = (unlinkRes.body.wallets?.linked || []).map(
        (l) => l.address
      );
      expect(addresses).not.toContain(SOLANA_SECONDARY);
    });
  });

  // ── Step 5: Confirm link is gone ─────────────────────────────────────────
  describe('Step 5: GET /api/v1/wallet/links/:wallet after unlink', () => {
    it('linked array is empty after unlink', async () => {
      const res = await get(`/api/v1/wallet/links/${primaryWallet}`);
      expect(res.status).toBe(200);
      const addresses = res.body.linked.map((l) => l.address);
      expect(addresses).not.toContain(SOLANA_SECONDARY);
    });
  });

  // ── Step 6: Trust check via secondary wallet → unresolved after unlink ────
  describe('Step 6: Trust via secondary wallet after unlink', () => {
    it('no longer resolves to primary', async () => {
      const res = await get(`/api/v1/trust/check/${SOLANA_SECONDARY}`);
      expect(res.status).toBe(200);
      // After unlink the solana wallet is standalone — it has no stamp of its own
      // so it should come back as trusted:false OR not have linked_from set
      const stillResolved =
        res.body.resolved_to === primaryWallet && res.body.trusted === true;
      expect(stillResolved).toBe(false);
    });
  });

  // ── Edge case: Self-link → 400 ───────────────────────────────────────────
  describe('Edge: Cannot link wallet to itself', () => {
    it('returns 400', async () => {
      const res = await post('/api/v1/wallet/link', {
        headers: { 'x-wallet-address': primaryWallet },
        body: { linked_wallet: primaryWallet },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/itself/i);
    });
  });

  // ── Edge case: Unlink nonexistent → 404 ──────────────────────────────────
  describe('Edge: Unlinking a wallet that was never linked → 404', () => {
    it('returns 404', async () => {
      const neverLinked = makeTestWallet();
      const res = await post('/api/v1/wallet/unlink', {
        headers: { 'x-wallet-address': primaryWallet },
        body: { linked_wallet: neverLinked },
      });
      expect(res.status).toBe(404);
    });
  });

  // ── Edge case: Link without wallet header → 401 ──────────────────────────
  describe('Edge: Link without wallet header → 401', () => {
    it('returns 401', async () => {
      const res = await post('/api/v1/wallet/link', {
        body: { linked_wallet: SOLANA_SECONDARY },
      });
      expect(res.status).toBe(401);
    });
  });
});
