/**
 * Flow 13 — Wallet Signature Auth
 *
 * Tests cryptographic wallet ownership verification via EIP-191 signatures.
 * Uses @noble/curves + @noble/hashes for signing (avoids ethers v6 CJS issues).
 *
 * Signing pattern:
 *   timestamp = Math.floor(Date.now() / 1000).toString()
 *   message   = `AgentStamp:${action}:${timestamp}`
 *   signature = personalSign(message, privateKeyHex)
 *   Headers:  x-wallet-address, x-wallet-signature, x-wallet-timestamp
 */

const { makeTestWallet, get, post } = require('./helpers');
const { secp256k1 } = require('@noble/curves/secp256k1');
const { keccak_256 } = require('@noble/hashes/sha3');
const { randomBytes } = require('crypto');

// ─── EVM signing helpers ─────────────────────────────────────────────────────

function keccak256(data) {
  return Buffer.from(keccak_256(data));
}

/**
 * EIP-191 personal_sign implementation.
 * @param {string} message
 * @param {string} privateKeyHex  - 32-byte hex (no 0x prefix)
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
 * Derive an EVM address from a private key.
 * @param {string} privateKeyHex
 * @returns {string}
 */
function privateKeyToAddress(privateKeyHex) {
  const pubKey = secp256k1.getPublicKey(Buffer.from(privateKeyHex, 'hex'), false);
  const hash = keccak256(pubKey.slice(1));
  return '0x' + hash.slice(12).toString('hex');
}

/**
 * Build valid signature headers for the AgentStamp API.
 * @param {string} address
 * @param {string} privateKeyHex
 * @param {string} action
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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Flow 13 — Wallet Signature Auth', () => {
  // A real signing key pair — can produce valid EVM signatures
  const privateKeyHex = randomBytes(32).toString('hex');
  const signerAddress = privateKeyToAddress(privateKeyHex);

  // A standard test wallet for unsigned operations
  const unsignedWallet = makeTestWallet();

  let mintUnavailable = false;

  // ── Step 1: POST /stamp/mint/free WITHOUT signature → 401 ────────────────
  // Free mint now requires a signature (requireSignature({ required: true }))
  describe('Step 1: POST /api/v1/stamp/mint/free — signature now required', () => {
    let res;

    beforeAll(async () => {
      res = await post('/api/v1/stamp/mint/free', {
        headers: { 'x-wallet-address': unsignedWallet },
        // no x-wallet-signature headers
      });
    });

    it('returns HTTP 401 without signature (signature is now required)', () => {
      expect(res.status).toBe(401);
    });

    it('returns success: false', () => {
      expect(res.body.success).toBe(false);
    });

    it('error message mentions signature', () => {
      expect(res.body.error).toMatch(/signature/i);
    });
  });

  // ── Step 2: POST /stamp/mint/free WITH valid signature also succeeds ───────
  describe('Step 2: POST /api/v1/stamp/mint/free — valid signature succeeds', () => {
    let res;

    beforeAll(async () => {
      if (mintUnavailable) return;
      const headers = makeSignatureHeaders(signerAddress, privateKeyHex, 'mint');
      res = await post('/api/v1/stamp/mint/free', { headers });
    });

    it('returns HTTP 201', () => {
      if (mintUnavailable) return;
      expect(res.status).toBe(201);
    });

    it('returns success: true', () => {
      if (mintUnavailable) return;
      expect(res.body.success).toBe(true);
    });

    it('stamp wallet_address matches signing wallet (case-insensitive)', () => {
      if (mintUnavailable) return;
      expect(res.body.stamp?.wallet_address.toLowerCase()).toBe(signerAddress.toLowerCase());
    });
  });

  // ── Step 3: POST /stamp/blind-register WITHOUT signature → 401 ────────────
  // blind-register has requireSignature({ required: true })
  describe('Step 3: POST /api/v1/stamp/blind-register — no signature → 401', () => {
    it('returns 401 when signature is absent', async () => {
      const res = await post('/api/v1/stamp/blind-register', {
        headers: { 'x-wallet-address': signerAddress },
        body: {
          wallet_address: signerAddress,
          nonce: 'no-sig-test-nonce',
        },
      });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/signature/i);
    });
  });

  // ── Step 4: POST /wallet/link — missing wallet header → 401 ──────────────
  describe('Step 4: POST /api/v1/wallet/link — no wallet header → 401', () => {
    it('returns 401 when x-wallet-address header is missing', async () => {
      const res = await post('/api/v1/wallet/link', {
        body: {
          linked_wallet: 'So11111111111111111111111111111111111111112',
          chain_hint: 'solana',
        },
      });
      expect(res.status).toBe(401);
    });
  });

  // ── Step 5: POST /stamp/blind-register WITH valid signature → token ────────
  describe('Step 5: POST /api/v1/stamp/blind-register — valid signature → token', () => {
    let res;

    beforeAll(async () => {
      if (mintUnavailable) return;
      const headers = makeSignatureHeaders(signerAddress, privateKeyHex, 'blind_register');
      res = await post('/api/v1/stamp/blind-register', {
        headers,
        body: {
          wallet_address: signerAddress,
          nonce: `flow13-nonce-${Date.now()}`,
        },
      });
    });

    it('returns 200 or 201', () => {
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
  });

  // ── Step 6: Expired timestamp → 401 ──────────────────────────────────────
  // NOTE: When the x402 payment middleware is down, ALL /stamp/mint/* routes
  // return 503 before signature validation runs (fail-closed guard in server.js).
  // In that case we skip these tests gracefully.
  describe('Step 6: POST /api/v1/stamp/mint/free — expired timestamp → 401', () => {
    it('returns 401 for a timestamp 10 minutes in the past (or 503 if facilitator down)', async () => {
      // TIMESTAMP_WINDOW_SECONDS = 300 — 601s is safely outside the window
      const staleTimestamp = (Math.floor(Date.now() / 1000) - 601).toString();
      const message = `AgentStamp:mint:${staleTimestamp}`;
      const signature = personalSign(message, privateKeyHex);

      const res = await post('/api/v1/stamp/mint/free', {
        headers: {
          'x-wallet-address': signerAddress,
          'x-wallet-signature': signature,
          'x-wallet-timestamp': staleTimestamp,
        },
      });

      if (res.status === 503) {
        console.warn('Flow 13 Step 6: 503 from facilitator — skipping timestamp expiry check');
        return;
      }
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/timestamp|expired/i);
    });
  });

  // ── Step 7: Tampered message → 401 ───────────────────────────────────────
  describe('Step 7: POST /api/v1/stamp/mint/free — wrong message signed → 401', () => {
    it('returns 401 when a different message was signed (or 503 if facilitator down)', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      // Sign wrong prefix so recovered address will not match
      const wrongMessage = `WrongPrefix:mint:${timestamp}`;
      const signature = personalSign(wrongMessage, privateKeyHex);

      const res = await post('/api/v1/stamp/mint/free', {
        headers: {
          'x-wallet-address': signerAddress,
          'x-wallet-signature': signature,
          'x-wallet-timestamp': timestamp,
        },
      });

      if (res.status === 503) {
        console.warn('Flow 13 Step 7: 503 from facilitator — skipping tampered message check');
        return;
      }
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ── Step 8: Tombstone without wallet header → 401 ─────────────────────────
  describe('Step 8: POST /api/v1/stamp/:id/tombstone — no wallet header → 401', () => {
    it('returns 401 when no wallet address header is provided', async () => {
      // Use a plausible stamp id format; 404 is also acceptable (stamp doesn't exist),
      // but our security check (requireSignature) fires first → 401
      const fakeStampId = 'stmp_flow13_test_00001';
      const res = await post(`/api/v1/stamp/${fakeStampId}/tombstone`, {
        body: { outcome: 'completed' },
      });
      // requireSignature(required:true) → 401 before stamp lookup
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ── Step 9: Invalid signature format → 401 ───────────────────────────────
  describe('Step 9: POST /api/v1/stamp/blind-register — invalid signature → 401', () => {
    it('returns 401 for a garbage signature string', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const res = await post('/api/v1/stamp/blind-register', {
        headers: {
          'x-wallet-address': signerAddress,
          'x-wallet-signature': 'not_a_valid_hex_signature_at_all',
          'x-wallet-timestamp': timestamp,
        },
        body: {
          wallet_address: signerAddress,
          nonce: 'garbage-sig-nonce',
        },
      });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ── Step 10: Trust check after signing workflow ────────────────────────────
  describe('Step 10: GET /api/v1/trust/check/:wallet after signing workflow', () => {
    it('returns 200 for the signing wallet address', async () => {
      const res = await get(`/api/v1/trust/check/${signerAddress}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.score).toBe('number');
      expect(res.body.score).toBeGreaterThanOrEqual(0);
    });

    it('wallet_verified on agent is boolean when agent is registered', async () => {
      const res = await get(`/api/v1/trust/check/${signerAddress}`);
      expect(res.status).toBe(200);
      if (res.body.agent) {
        expect(typeof res.body.agent.wallet_verified).toBe('boolean');
      }
      // trusted = true if stamp was minted, false otherwise
      if (mintUnavailable) {
        expect(res.body.trusted).toBe(false);
      } else {
        expect(res.body.trusted).toBe(true);
      }
    });
  });
});
