const { SigningKey } = require('ethers/crypto');
const { hashMessage } = require('ethers/hash');
const { computeAddress } = require('ethers/transaction');
const crypto = require('crypto');
const nacl = require('tweetnacl');
const bs58Module = require('bs58');
const bs58 = bs58Module.default || bs58Module;
const { requireSignature } = require('../src/middleware/walletSignature');
const { buildSignatureMessage } = require('../src/walletAuth');

// Mock the database module so the middleware's best-effort DB update doesn't blow up
vi.mock('../src/database', () => ({
  getDb: () => ({
    prepare: () => ({ run: () => {} }),
  }),
}));

// Helper: create a random EVM signer and sign a message
function createEvmSigner() {
  const privKey = '0x' + crypto.randomBytes(32).toString('hex');
  const signingKey = new SigningKey(privKey);
  const address = computeAddress(signingKey.publicKey);
  return {
    address,
    sign(message) {
      const digest = hashMessage(message);
      const sig = signingKey.sign(digest);
      return sig.serialized;
    },
  };
}

function createMockReqResNext(headers = {}, body = {}) {
  const req = {
    headers: { ...headers },
    body: { ...body },
    walletVerified: undefined,
    walletSignatureInfo: undefined,
  };
  const res = {
    _status: null,
    _json: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(data) {
      this._json = data;
      return this;
    },
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  return { req, res, next, wasNextCalled: () => nextCalled };
}

describe('requireSignature middleware', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when signature missing and required=true', () => {
    const mw = requireSignature({ required: true, action: 'test' });
    const { req, res, next, wasNextCalled } = createMockReqResNext();

    mw(req, res, next);

    expect(res._status).toBe(401);
    expect(res._json.success).toBe(false);
    expect(wasNextCalled()).toBe(false);
  });

  it('calls next with walletVerified=false when signature missing and required=false', () => {
    const mw = requireSignature({ required: false, action: 'test' });
    const { req, res, next, wasNextCalled } = createMockReqResNext();

    mw(req, res, next);

    expect(wasNextCalled()).toBe(true);
    expect(req.walletVerified).toBe(false);
    expect(req.walletSignatureInfo).toBeNull();
  });

  it('returns 401 for expired timestamp', () => {
    const mw = requireSignature({ required: false, action: 'test' });
    const expiredTs = String(Math.floor(Date.now() / 1000) - 600); // 10 minutes ago
    const { req, res, next, wasNextCalled } = createMockReqResNext({
      'x-wallet-address': '0x8c9e0882b4c6e6568fe76F16D59F7E080465E5C8',
      'x-wallet-signature': 'somesig',
      'x-wallet-timestamp': expiredTs,
    });

    mw(req, res, next);

    expect(res._status).toBe(401);
    expect(res._json.error).toMatch(/expired/i);
    expect(wasNextCalled()).toBe(false);
  });

  it('returns 401 for invalid (NaN) timestamp', () => {
    const mw = requireSignature({ required: false, action: 'test' });
    const { req, res, next, wasNextCalled } = createMockReqResNext({
      'x-wallet-address': '0x8c9e0882b4c6e6568fe76F16D59F7E080465E5C8',
      'x-wallet-signature': 'somesig',
      'x-wallet-timestamp': 'not-a-number',
    });

    mw(req, res, next);

    expect(res._status).toBe(401);
    expect(res._json.error).toMatch(/invalid/i);
    expect(wasNextCalled()).toBe(false);
  });

  it('sets walletVerified=true for valid EVM signature', () => {
    const signer = createEvmSigner();
    const ts = String(Math.floor(Date.now() / 1000));
    const message = buildSignatureMessage('mint', ts);
    const signature = signer.sign(message);

    const mw = requireSignature({ required: true, action: 'mint' });
    const { req, res, next, wasNextCalled } = createMockReqResNext({
      'x-wallet-address': signer.address,
      'x-wallet-signature': signature,
      'x-wallet-timestamp': ts,
    });

    mw(req, res, next);

    expect(wasNextCalled()).toBe(true);
    expect(req.walletVerified).toBe(true);
    expect(req.walletSignatureInfo.chain).toBe('evm');
    expect(req.walletSignatureInfo.verified).toBe(true);
  });

  it('sets walletVerified=true for valid Solana signature', () => {
    const keyPair = nacl.sign.keyPair();
    const publicKeyBase58 = bs58.encode(keyPair.publicKey);
    const ts = String(Math.floor(Date.now() / 1000));
    const message = buildSignatureMessage('register', ts);
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = nacl.sign.detached(msgBytes, keyPair.secretKey);
    const signatureBase64 = Buffer.from(sigBytes).toString('base64');

    const mw = requireSignature({ required: true, action: 'register' });
    const { req, res, next, wasNextCalled } = createMockReqResNext({
      'x-wallet-address': publicKeyBase58,
      'x-wallet-signature': signatureBase64,
      'x-wallet-timestamp': ts,
    });

    mw(req, res, next);

    expect(wasNextCalled()).toBe(true);
    expect(req.walletVerified).toBe(true);
    expect(req.walletSignatureInfo.chain).toBe('solana');
  });

  it('returns 401 for invalid signature', () => {
    const mw = requireSignature({ required: true, action: 'mint' });
    const ts = String(Math.floor(Date.now() / 1000));
    const { req, res, next, wasNextCalled } = createMockReqResNext({
      'x-wallet-address': '0x8c9e0882b4c6e6568fe76F16D59F7E080465E5C8',
      'x-wallet-signature': '0xdeadbeef',
      'x-wallet-timestamp': ts,
    });

    mw(req, res, next);

    expect(res._status).toBe(401);
    expect(res._json.error).toMatch(/invalid/i);
    expect(wasNextCalled()).toBe(false);
  });
});
