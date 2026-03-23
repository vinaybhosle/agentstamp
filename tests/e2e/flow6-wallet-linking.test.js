/**
 * Flow 6 — Wallet Linking + Cross-Chain Trust
 *
 * link → view links → trust resolves via secondary → unlink
 *
 * Dual-signature requirement: wallet/link requires BOTH:
 *   - Primary wallet signature via headers (x-wallet-address, x-wallet-signature, x-wallet-timestamp)
 *   - Secondary wallet signature via body (linked_wallet_signature, linked_wallet_timestamp)
 * Both wallets are EVM wallets created with makeSignedWallet() so we can sign for both.
 */

const { makeSignedWallet, makeTestWallet, get, post } = require('./helpers');

describe('Flow 6 — Wallet Linking + Cross-Chain Trust', () => {
  const primaryWallet = makeSignedWallet();
  const secondaryWallet = makeSignedWallet();

  // Ensure the primary has a stamp so trust check returns real data
  beforeAll(async () => {
    const res = await post('/api/v1/stamp/mint/free', {
      headers: await primaryWallet.signHeaders('mint'),
    });
    expect(res.status).toBe(201);
  });

  // ── Step 1: Link secondary wallet ────────────────────────────────────────
  describe('Step 1: POST /api/v1/wallet/link', () => {
    let linkRes;

    beforeAll(async () => {
      // Get the secondary wallet's signature proving it consents to being linked
      const linkedSigHeaders = await secondaryWallet.signHeaders('wallet_link');
      const body = {
        linked_wallet: secondaryWallet.address,
        chain_hint: 'evm',
        linked_wallet_signature: linkedSigHeaders['x-wallet-signature'],
        linked_wallet_timestamp: linkedSigHeaders['x-wallet-timestamp'],
      };
      linkRes = await post('/api/v1/wallet/link', {
        headers: await primaryWallet.signHeaders('wallet_link', body),
        body,
      });
    });

    it('returns HTTP 201', () => {
      expect(linkRes.status).toBe(201);
    });

    it('returns success: true', () => {
      expect(linkRes.body.success).toBe(true);
    });

    it('wallets.primary matches primaryWallet', () => {
      expect(linkRes.body.wallets.primary).toBe(primaryWallet.address);
    });

    it('linked array contains the secondary wallet', () => {
      const addresses = linkRes.body.wallets.linked.map((l) => l.address);
      expect(addresses).toContain(secondaryWallet.address);
    });

    it('linked wallet has chain hint set to evm', () => {
      const linked = linkRes.body.wallets.linked.find(
        (l) => l.address.toLowerCase() === secondaryWallet.address.toLowerCase()
      );
      expect(linked?.chain).toBe('evm');
    });
  });

  // ── Step 2: View links via GET /wallet/links/:wallet ─────────────────────
  describe('Step 2: GET /api/v1/wallet/links/:wallet', () => {
    let linksRes;

    beforeAll(async () => {
      linksRes = await get(`/api/v1/wallet/links/${primaryWallet.address}`);
    });

    it('returns HTTP 200', () => {
      expect(linksRes.status).toBe(200);
    });

    it('returns success: true', () => {
      expect(linksRes.body.success).toBe(true);
    });

    it('primary is the primary wallet', () => {
      expect(linksRes.body.primary).toBe(primaryWallet.address);
    });

    it('linked array contains the secondary wallet', () => {
      const addresses = linksRes.body.linked.map((l) => l.address.toLowerCase());
      expect(addresses).toContain(secondaryWallet.address.toLowerCase());
    });

    it('total is at least 1', () => {
      expect(linksRes.body.total).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Step 3: Trust check via secondary wallet resolves to primary ──────────
  describe('Step 3: GET /api/v1/trust/check/:secondaryWallet', () => {
    let trustRes;

    beforeAll(async () => {
      trustRes = await get(`/api/v1/trust/check/${secondaryWallet.address}`);
    });

    it('returns HTTP 200', () => {
      expect(trustRes.status).toBe(200);
    });

    it('trusted is true (resolved from primary stamp)', () => {
      expect(trustRes.body.trusted).toBe(true);
    });

    it('resolved_to is the primary wallet', () => {
      expect(trustRes.body.resolved_to.toLowerCase()).toBe(primaryWallet.address.toLowerCase());
    });

    it('linked_from is the secondary wallet', () => {
      expect(trustRes.body.linked_from.toLowerCase()).toBe(secondaryWallet.address.toLowerCase());
    });

    it('stamp tier is free', () => {
      expect(trustRes.body.stamp?.tier).toBe('free');
    });
  });

  // ── Step 4: Unlink secondary wallet ──────────────────────────────────────
  describe('Step 4: POST /api/v1/wallet/unlink', () => {
    let unlinkRes;

    beforeAll(async () => {
      const body = { linked_wallet: secondaryWallet.address };
      unlinkRes = await post('/api/v1/wallet/unlink', {
        headers: await primaryWallet.signHeaders('wallet_unlink', body),
        body,
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
        (l) => l.address.toLowerCase()
      );
      expect(addresses).not.toContain(secondaryWallet.address.toLowerCase());
    });
  });

  // ── Step 5: Confirm link is gone ─────────────────────────────────────────
  describe('Step 5: GET /api/v1/wallet/links/:wallet after unlink', () => {
    it('linked array is empty after unlink', async () => {
      const res = await get(`/api/v1/wallet/links/${primaryWallet.address}`);
      expect(res.status).toBe(200);
      const addresses = res.body.linked.map((l) => l.address.toLowerCase());
      expect(addresses).not.toContain(secondaryWallet.address.toLowerCase());
    });
  });

  // ── Step 6: Trust check via secondary wallet → unresolved after unlink ────
  describe('Step 6: Trust via secondary wallet after unlink', () => {
    it('no longer resolves to primary', async () => {
      const res = await get(`/api/v1/trust/check/${secondaryWallet.address}`);
      expect(res.status).toBe(200);
      // After unlink the secondary wallet is standalone — it has no stamp of its own
      // so it should come back as trusted:false OR not have linked_from set
      const stillResolved =
        res.body.resolved_to?.toLowerCase() === primaryWallet.address.toLowerCase() &&
        res.body.trusted === true;
      expect(stillResolved).toBe(false);
    });
  });

  // ── Edge case: Self-link → 400 ───────────────────────────────────────────
  describe('Edge: Cannot link wallet to itself', () => {
    it('returns 400', async () => {
      const selfSigHeaders = await primaryWallet.signHeaders('wallet_link');
      const body = {
        linked_wallet: primaryWallet.address,
        linked_wallet_signature: selfSigHeaders['x-wallet-signature'],
        linked_wallet_timestamp: selfSigHeaders['x-wallet-timestamp'],
      };
      const res = await post('/api/v1/wallet/link', {
        headers: await primaryWallet.signHeaders('wallet_link', body),
        body,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/itself/i);
    });
  });

  // ── Edge case: Unlink nonexistent → 404 ──────────────────────────────────
  describe('Edge: Unlinking a wallet that was never linked → 404', () => {
    it('returns 404', async () => {
      const neverLinked = makeTestWallet();
      const body = { linked_wallet: neverLinked };
      const res = await post('/api/v1/wallet/unlink', {
        headers: await primaryWallet.signHeaders('wallet_unlink', body),
        body,
      });
      expect(res.status).toBe(404);
    });
  });

  // ── Edge case: Link without wallet header → 401 ──────────────────────────
  describe('Edge: Link without wallet header → 401', () => {
    it('returns 401', async () => {
      const res = await post('/api/v1/wallet/link', {
        body: { linked_wallet: secondaryWallet.address },
      });
      expect(res.status).toBe(401);
    });
  });
});
