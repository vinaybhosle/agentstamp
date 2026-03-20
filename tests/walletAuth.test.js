const { SigningKey } = require('ethers/crypto');
const { hashMessage } = require('ethers/hash');
const { computeAddress } = require('ethers/transaction');
const crypto = require('crypto');
const nacl = require('tweetnacl');
const bs58Module = require('bs58');
const bs58 = bs58Module.default || bs58Module;
const {
  buildSignatureMessage,
  verifyEvmSignature,
  verifySolanaSignature,
  verifyWalletSignature,
  detectChain,
} = require('../src/walletAuth');

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

describe('walletAuth', () => {
  // ─── buildSignatureMessage ───────────────────────────────────────────────
  describe('buildSignatureMessage', () => {
    it('returns correct format', () => {
      const msg = buildSignatureMessage('mint', '1700000000');
      expect(msg).toBe('AgentStamp:mint:1700000000');
    });
  });

  // ─── EVM signature verification ─────────────────────────────────────────
  describe('verifyEvmSignature', () => {
    it('verifies a valid EVM signature', () => {
      const signer = createEvmSigner();
      const message = 'AgentStamp:mint:1700000000';
      const signature = signer.sign(message);

      const result = verifyEvmSignature(message, signature, signer.address);
      expect(result.valid).toBe(true);
      expect(result.recoveredAddress.toLowerCase()).toBe(signer.address.toLowerCase());
      expect(result.error).toBeNull();
    });

    it('returns valid: false for wrong address', () => {
      const signer = createEvmSigner();
      const otherSigner = createEvmSigner();
      const message = 'AgentStamp:mint:1700000000';
      const signature = signer.sign(message);

      const result = verifyEvmSignature(message, signature, otherSigner.address);
      expect(result.valid).toBe(false);
    });

    it('returns valid: false for malformed signature', () => {
      const signer = createEvmSigner();
      const result = verifyEvmSignature('test', 'not-a-valid-signature', signer.address);
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('performs case-insensitive address matching', () => {
      const signer = createEvmSigner();
      const message = 'AgentStamp:test:123';
      const signature = signer.sign(message);

      const upperAddress = signer.address.toUpperCase().replace('0X', '0x');
      const result = verifyEvmSignature(message, signature, upperAddress);
      expect(result.valid).toBe(true);
    });
  });

  // ─── Solana signature verification ──────────────────────────────────────
  describe('verifySolanaSignature', () => {
    it('verifies a valid Solana signature', () => {
      const keyPair = nacl.sign.keyPair();
      const publicKeyBase58 = bs58.encode(keyPair.publicKey);
      const message = 'AgentStamp:mint:1700000000';
      const msgBytes = new TextEncoder().encode(message);
      const sigBytes = nacl.sign.detached(msgBytes, keyPair.secretKey);
      const signatureBase64 = Buffer.from(sigBytes).toString('base64');

      const result = verifySolanaSignature(message, signatureBase64, publicKeyBase58);
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('returns valid: false for wrong public key', () => {
      const keyPair = nacl.sign.keyPair();
      const otherKeyPair = nacl.sign.keyPair();
      const otherPubKey = bs58.encode(otherKeyPair.publicKey);
      const message = 'AgentStamp:mint:1700000000';
      const msgBytes = new TextEncoder().encode(message);
      const sigBytes = nacl.sign.detached(msgBytes, keyPair.secretKey);
      const signatureBase64 = Buffer.from(sigBytes).toString('base64');

      const result = verifySolanaSignature(message, signatureBase64, otherPubKey);
      expect(result.valid).toBe(false);
    });

    it('returns valid: false for malformed signature', () => {
      const keyPair = nacl.sign.keyPair();
      const publicKeyBase58 = bs58.encode(keyPair.publicKey);

      const result = verifySolanaSignature('test', 'bm90LXZhbGlk', publicKeyBase58);
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  // ─── detectChain ────────────────────────────────────────────────────────
  describe('detectChain', () => {
    it('detects EVM address', () => {
      expect(detectChain('0x8c9e0882b4c6e6568fe76F16D59F7E080465E5C8')).toBe('evm');
    });

    it('detects Solana address', () => {
      const keyPair = nacl.sign.keyPair();
      const solAddr = bs58.encode(keyPair.publicKey);
      expect(detectChain(solAddr)).toBe('solana');
    });

    it('returns null for invalid address', () => {
      expect(detectChain('not-a-wallet')).toBeNull();
      expect(detectChain('')).toBeNull();
      expect(detectChain('0x123')).toBeNull();
    });
  });

  // ─── verifyWalletSignature (end-to-end) ─────────────────────────────────
  describe('verifyWalletSignature', () => {
    it('EVM end-to-end', () => {
      const signer = createEvmSigner();
      const message = 'AgentStamp:register:1700000000';
      const signature = signer.sign(message);

      const result = verifyWalletSignature(message, signature, signer.address);
      expect(result.valid).toBe(true);
      expect(result.chain).toBe('evm');
    });

    it('Solana end-to-end', () => {
      const keyPair = nacl.sign.keyPair();
      const publicKeyBase58 = bs58.encode(keyPair.publicKey);
      const message = 'AgentStamp:register:1700000000';
      const msgBytes = new TextEncoder().encode(message);
      const sigBytes = nacl.sign.detached(msgBytes, keyPair.secretKey);
      const signatureBase64 = Buffer.from(sigBytes).toString('base64');

      const result = verifyWalletSignature(message, signatureBase64, publicKeyBase58);
      expect(result.valid).toBe(true);
      expect(result.chain).toBe('solana');
    });

    it('returns error for unrecognized address format', () => {
      const result = verifyWalletSignature('msg', 'sig', 'invalid-address');
      expect(result.valid).toBe(false);
      expect(result.chain).toBeNull();
      expect(result.error).toBe('Unrecognized wallet address format');
    });
  });
});
