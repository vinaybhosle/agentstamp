/**
 * Flow 10 — Blind Verification
 *
 * Privacy-preserving stamp verification via opaque tokens.
 * The blind token reveals only tier, reputation_label, score_range, and valid — NOT wallet.
 *
 * mint stamp → blind-register (with sig headers) → verify-blind/:token
 * → confirm no wallet_address in response → nonexistent token → 404
 * → blind-register without signature → 401
 *
 * Uses @noble/curves + @noble/hashes for EIP-191 signing (avoids ethers v6 CJS issues).
 */

const { get, post } = require('./helpers');
const { secp256k1 } = require('@noble/curves/secp256k1');
const { keccak_256 } = require('@noble/hashes/sha3');
const { randomBytes } = require('crypto');

/**
 * Compute keccak256 of arbitrary data.
 * @param {Buffer|Uint8Array} data
 * @returns {Buffer}
 */
function keccak256(data) {
  return Buffer.from(keccak_256(data));
}

/**
 * Sign a message with EIP-191 personal_sign and return the hex signature.
 * @param {string} message
 * @param {string} privateKeyHex  - 32-byte hex string (no 0x prefix)
 * @returns {string} - '0x' + r + s + v hex
 */
function personalSign(message, privateKeyHex) {
  const msgBytes = Buffer.from(message, 'utf8');
  const prefix = Buffer.from(`\x19Ethereum Signed Message:\n${msgBytes.length}`);
  const prefixed = Buffer.concat([prefix, msgBytes]);
  const hash = keccak256(prefixed);
  const sig = secp256k1.sign(hash, Buffer.from(privateKeyHex, 'hex'));
  const v = sig.recovery + 27;
  const r = sig.r.toString(16).padStart(64, '0');
  const s = sig.s.toString(16).padStart(64, '0');
  return '0x' + r + s + v.toString(16);
}

/**
 * Derive an EVM address (checksummed-style lowercase hex) from a private key.
 * @param {string} privateKeyHex
 * @returns {string} - '0x'-prefixed lowercase address
 */
function privateKeyToAddress(privateKeyHex) {
  const pubKey = secp256k1.getPublicKey(Buffer.from(privateKeyHex, 'hex'), false);
  const hash = keccak256(pubKey.slice(1)); // skip 0x04 uncompressed prefix
  return '0x' + hash.slice(12).toString('hex');
}

/**
 * Build the signature headers expected by the AgentStamp API.
 * @param {string} address
 * @param {string} privateKeyHex
 * @param {string} action - e.g. 'blind_register', 'mint'
 * @returns {{ 'x-wallet-address': string, 'x-wallet-signature': string, 'x-wallet-timestamp': string }}
 */
function makeSignatureHeaders(address, privateKeyHex, action) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `AgentStamp:${action}:${timestamp}`;
  const signature = personalSign(message, privateKeyHex);
  return {
    'x-wallet-address': address,
    'x-wallet-signature': signature,
    'x-wallet-timestamp': timestamp,
  };
}

describe('Flow 10 — Blind Verification', () => {
  // Generate a real signing key pair for blind-register (requires valid EVM sig)
  const privateKeyHex = randomBytes(32).toString('hex');
  const signerAddress = privateKeyToAddress(privateKeyHex);

  let blindToken;
  let mintUnavailable = false;

  // ── Setup: mint a free stamp for the signer ───────────────────────────────
  beforeAll(async () => {
    const mintHeaders = makeSignatureHeaders(signerAddress, privateKeyHex, 'mint');
    const mintRes = await post('/api/v1/stamp/mint/free', { headers: mintHeaders });
    if (mintRes.status === 503) {
      console.warn('Flow 10: Payment facilitator unavailable (503) — skipping stamp-dependent tests');
      mintUnavailable = true;
    }
    // Don't assert here so non-mint-dependent tests can still run
  });

  // ── Step 1: POST /stamp/blind-register without signature → 401 ────────────
  describe('Step 1: POST /api/v1/stamp/blind-register — no signature → 401', () => {
    it('returns HTTP 401 (signature required)', async () => {
      const res = await post('/api/v1/stamp/blind-register', {
        headers: {
          'x-wallet-address': signerAddress,
          // intentionally no x-wallet-signature / x-wallet-timestamp
        },
        body: {
          wallet_address: signerAddress,
          nonce: 'test-nonce-no-sig',
        },
      });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/signature/i);
    });
  });

  // ── Step 2: POST /stamp/blind-register with valid signature → token ────────
  describe('Step 2: POST /api/v1/stamp/blind-register — valid signature → token', () => {
    let res;

    beforeAll(async () => {
      if (mintUnavailable) return;
      const headers = makeSignatureHeaders(signerAddress, privateKeyHex, 'blind_register');
      res = await post('/api/v1/stamp/blind-register', {
        headers,
        body: {
          wallet_address: signerAddress,
          nonce: `e2e-nonce-${Date.now()}`,
        },
      });
    });

    it('returns HTTP 201 or 200 (created or replaced)', () => {
      if (mintUnavailable) return;
      expect([200, 201]).toContain(res.status);
    });

    it('returns success: true', () => {
      if (mintUnavailable) return;
      expect(res.body.success).toBe(true);
    });

    it('returns a token string', () => {
      if (mintUnavailable) return;
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.length).toBeGreaterThan(0);
    });

    afterAll(() => {
      if (res && res.body) blindToken = res.body.token;
    });
  });

  // ── Step 3: GET /stamp/verify-blind/:token — valid token ─────────────────
  describe('Step 3: GET /api/v1/stamp/verify-blind/:token', () => {
    let verifyRes;

    beforeAll(async () => {
      if (mintUnavailable || !blindToken) return;
      verifyRes = await get(`/api/v1/stamp/verify-blind/${blindToken}`);
    });

    it('returns HTTP 200', () => {
      if (mintUnavailable || !blindToken) return;
      expect(verifyRes.status).toBe(200);
    });

    it('returns success: true', () => {
      if (mintUnavailable || !blindToken) return;
      expect(verifyRes.body.success).toBe(true);
    });

    it('has valid field (boolean)', () => {
      if (mintUnavailable || !blindToken) return;
      expect(typeof verifyRes.body.valid).toBe('boolean');
    });

    it('has tier field (string or null)', () => {
      if (mintUnavailable || !blindToken) return;
      expect('tier' in verifyRes.body).toBe(true);
    });

    it('has reputation_label field', () => {
      if (mintUnavailable || !blindToken) return;
      expect(verifyRes.body.reputation_label).toBeTruthy();
    });

    it('has score_range field', () => {
      if (mintUnavailable || !blindToken) return;
      expect(verifyRes.body.score_range).toBeTruthy();
    });

    it('does NOT contain wallet_address in response', () => {
      if (mintUnavailable || !blindToken) return;
      expect(verifyRes.body.wallet_address).toBeUndefined();
    });

    it('does NOT contain stamp_id in response', () => {
      if (mintUnavailable || !blindToken) return;
      expect(verifyRes.body.stamp_id).toBeUndefined();
    });

    it('score_range matches expected format (e.g., "0-25")', () => {
      if (mintUnavailable || !blindToken) return;
      expect(verifyRes.body.score_range).toMatch(/^\d+-\d+$/);
    });
  });

  // ── Step 4: GET /stamp/verify-blind/nonexistent → 404 ────────────────────
  describe('Step 4: GET /api/v1/stamp/verify-blind/nonexistent → 404', () => {
    it('returns 404 for an unknown 64-char hex token', async () => {
      const res = await get('/api/v1/stamp/verify-blind/0000000000000000000000000000000000000000000000000000000000000000');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('error mentions "not found"', async () => {
      const res = await get('/api/v1/stamp/verify-blind/nonexistent_token_abc123');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  // ── Step 5: Same nonce returns same token (idempotent) ────────────────────
  describe('Step 5: Repeated blind-register with same nonce is idempotent', () => {
    it('returns the same token for the same wallet + nonce', async () => {
      if (mintUnavailable) return;
      const nonce = 'idempotent-flow10-nonce';

      const headers1 = makeSignatureHeaders(signerAddress, privateKeyHex, 'blind_register');
      const res1 = await post('/api/v1/stamp/blind-register', {
        headers: headers1,
        body: { wallet_address: signerAddress, nonce },
      });
      expect([200, 201]).toContain(res1.status);
      const token1 = res1.body.token;

      const headers2 = makeSignatureHeaders(signerAddress, privateKeyHex, 'blind_register');
      const res2 = await post('/api/v1/stamp/blind-register', {
        headers: headers2,
        body: { wallet_address: signerAddress, nonce },
      });
      expect([200, 201]).toContain(res2.status);
      // Same nonce → same HMAC → same token
      expect(res2.body.token).toBe(token1);
    });
  });
});
