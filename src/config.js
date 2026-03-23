require('dotenv').config();
const crypto = require('crypto');

if (!process.env.BLIND_TOKEN_SECRET) {
  console.error('BLIND_TOKEN_SECRET is required in .env — blind tokens will not persist without it.');
  process.exit(1);
}
if (!process.env.IP_HASH_SALT) {
  console.error('IP_HASH_SALT is required in .env — IP hashing requires a stable salt.');
  process.exit(1);
}

const BLIND_TOKEN_SECRET = process.env.BLIND_TOKEN_SECRET;
const IP_HASH_SALT = process.env.IP_HASH_SALT;

const config = {
  port: parseInt(process.env.PORT, 10) || 4005,
  host: process.env.HOST || '127.0.0.1',
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

// Warn (not crash) if admin/analytics keys are missing — endpoints will return 503
if (!process.env.AUTH_SECRET) {
  console.warn('WARNING: AUTH_SECRET not set — admin endpoints will return 503');
}
if (!process.env.ANALYTICS_KEY) {
  console.warn('WARNING: ANALYTICS_KEY not set — analytics dashboard will return 503');
}
if (!process.env.ADMIN_KEY) {
  console.warn('WARNING: ADMIN_KEY not set — audit admin access will be unavailable');
}

module.exports = config;
