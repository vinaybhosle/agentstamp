require('dotenv').config();
const crypto = require('crypto');

const BLIND_TOKEN_SECRET = process.env.BLIND_TOKEN_SECRET || (() => {
  const generated = crypto.randomBytes(32).toString('hex');
  console.warn('WARNING: BLIND_TOKEN_SECRET not set — generated ephemeral secret. Blind tokens will not persist across restarts. Set BLIND_TOKEN_SECRET in .env for production.');
  return generated;
})();

const IP_HASH_SALT = process.env.IP_HASH_SALT || (() => {
  const generated = crypto.randomBytes(16).toString('hex');
  console.warn('WARNING: IP_HASH_SALT not set — generated ephemeral salt. IP hashes will differ across restarts. Set IP_HASH_SALT in .env for production.');
  return generated;
})();

const config = {
  port: parseInt(process.env.PORT, 10) || 4005,
  host: process.env.HOST || '0.0.0.0',
  walletAddress: process.env.WALLET_ADDRESS,
  solanaWalletAddress: process.env.SOLANA_WALLET_ADDRESS,
  facilitatorUrl: process.env.FACILITATOR_URL || 'https://facilitator.payai.network',
  network: process.env.NETWORK || 'base',
  signingKeyPath: process.env.SIGNING_KEY_PATH || './keys/ed25519_private.pem',
  dbPath: process.env.DB_PATH || './data/agentstamp.db',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  blindTokenSecret: BLIND_TOKEN_SECRET,
  ipHashSalt: IP_HASH_SALT,
};

if (!config.walletAddress) {
  console.error('WALLET_ADDRESS is required in .env');
  process.exit(1);
}

module.exports = config;
