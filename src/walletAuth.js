const { SigningKey } = require('ethers/crypto');
const { hashMessage } = require('ethers/hash');
const { computeAddress } = require('ethers/transaction');
const nacl = require('tweetnacl');
const bs58Module = require('bs58');
const bs58 = bs58Module.default || bs58Module;

const EVM_REGEX = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TIMESTAMP_WINDOW_SECONDS = 300; // 5 minutes

function buildSignatureMessage(action, timestamp) {
  return `AgentStamp:${action}:${timestamp}`;
}

function verifyEvmSignature(message, signature, expectedAddress) {
  try {
    const digest = hashMessage(message);
    const recoveredPubKey = SigningKey.recoverPublicKey(digest, signature);
    const recovered = computeAddress(recoveredPubKey);
    const valid = recovered.toLowerCase() === expectedAddress.toLowerCase();
    return Object.freeze({ valid, recoveredAddress: recovered, error: null });
  } catch (err) {
    return Object.freeze({ valid: false, recoveredAddress: null, error: err.message });
  }
}

function verifySolanaSignature(message, signatureBase64, publicKeyBase58) {
  try {
    const pubKeyBytes = bs58.decode(publicKeyBase58);
    if (pubKeyBytes.length !== 32) {
      return Object.freeze({ valid: false, error: 'Invalid Solana public key length' });
    }
    const sigBytes = Buffer.from(signatureBase64, 'base64');
    if (sigBytes.length !== 64) {
      return Object.freeze({ valid: false, error: 'Invalid signature length' });
    }
    const msgBytes = new TextEncoder().encode(message);
    const valid = nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);
    return Object.freeze({ valid, error: null });
  } catch (err) {
    return Object.freeze({ valid: false, error: err.message });
  }
}

function detectChain(walletAddress) {
  if (EVM_REGEX.test(walletAddress)) return 'evm';
  if (SOLANA_REGEX.test(walletAddress)) return 'solana';
  return null;
}

function verifyWalletSignature(message, signature, walletAddress) {
  const chain = detectChain(walletAddress);
  if (!chain) {
    return Object.freeze({ valid: false, chain: null, error: 'Unrecognized wallet address format' });
  }
  if (chain === 'evm') {
    const result = verifyEvmSignature(message, signature, walletAddress);
    return Object.freeze({ ...result, chain: 'evm' });
  }
  const result = verifySolanaSignature(message, signature, walletAddress);
  return Object.freeze({ ...result, chain: 'solana' });
}

module.exports = {
  buildSignatureMessage,
  verifyEvmSignature,
  verifySolanaSignature,
  verifyWalletSignature,
  detectChain,
  TIMESTAMP_WINDOW_SECONDS,
};
