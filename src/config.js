require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3402,
  host: process.env.HOST || '0.0.0.0',
  walletAddress: process.env.WALLET_ADDRESS,
  solanaWalletAddress: process.env.SOLANA_WALLET_ADDRESS,
  facilitatorUrl: process.env.FACILITATOR_URL || 'https://facilitator.payai.network',
  network: process.env.NETWORK || 'base',
  signingKeyPath: process.env.SIGNING_KEY_PATH || './keys/ed25519_private.pem',
  dbPath: process.env.DB_PATH || './data/agentstamp.db',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
};

if (!config.walletAddress) {
  console.error('WALLET_ADDRESS is required in .env');
  process.exit(1);
}

module.exports = config;
