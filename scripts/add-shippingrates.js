require('dotenv').config();
const database = require('../src/database');
const cryptoModule = require('../src/crypto');
const { generateStampId, generateAgentId, generateTransactionId } = require('../src/utils/generateId');
const { signCertificate } = require('../src/crypto');

database.initialize();
cryptoModule.initialize();

const db = database.getDb();

const walletAddress = '0x8c9e0882b4c6e6568fe76F16D59F7E080465E5C8';

// Create Gold stamp
const stampId = generateStampId();
const now = new Date();
const issuedAt = now.toISOString();
const expiresAtStamp = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

const certificate = {
  version: '1.0',
  issuer: 'AgentStamp',
  subject: walletAddress,
  tier: 'gold',
  claim: `This certifies that ${walletAddress} has been stamped as a verified AI agent identity at the gold tier.`,
  issued_at: issuedAt,
  expires_at: expiresAtStamp,
  stamp_id: stampId,
};

const signature = signCertificate(certificate);

db.prepare('INSERT INTO stamps (id, wallet_address, tier, issued_at, expires_at, certificate, signature) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run(stampId, walletAddress, 'gold', issuedAt, expiresAtStamp, JSON.stringify(certificate), signature);

db.prepare('INSERT INTO transactions (id, endpoint, wallet_address, amount, action, reference_id) VALUES (?, ?, ?, ?, ?, ?)')
  .run(generateTransactionId(), '/api/v1/stamp/mint/gold', walletAddress, '$0.01', 'stamp_mint', stampId);

console.log(`Gold stamp created: ${stampId}`);

// Create ShippingRatesBot agent
const agentId = generateAgentId();
const registeredAt = now.toISOString();
const expiresAtAgent = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

const capabilities = JSON.stringify(["freight-rates", "port-lookup", "shipping-intelligence", "demurrage-detention", "local-charges", "haulage-rates", "cfs-tariffs"]);
const protocols = JSON.stringify(["mcp", "x402"]);
const metadata = JSON.stringify({ version: "2.1", uptime: "99.9%", ports: 1174, charge_codes: 246, categories: 25 });

db.prepare(`
  INSERT INTO agents (id, wallet_address, name, description, category, capabilities, protocols, endpoint_url, stamp_id, endorsement_count, status, registered_at, last_heartbeat, expires_at, metadata)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  agentId,
  walletAddress,
  'ShippingRatesBot',
  'Shipping intelligence API — real-time ocean and air freight rates, D&D charges, local charges, haulage, CFS tariffs. Covers 1,174+ ports worldwide with 246 standardized charge codes across 25 categories.',
  'data',
  capabilities,
  protocols,
  'https://mcp.shippingrates.org/mcp/',
  stampId,
  0,
  'active',
  registeredAt,
  registeredAt,
  expiresAtAgent,
  metadata
);

db.prepare('INSERT INTO transactions (id, endpoint, wallet_address, amount, action, reference_id) VALUES (?, ?, ?, ?, ?, ?)')
  .run(generateTransactionId(), '/api/v1/registry/register', walletAddress, '$0.01', 'agent_register', agentId);

console.log(`ShippingRatesBot registered: ${agentId}`);
console.log(`Stamp: ${stampId} | Agent: ${agentId}`);
console.log('Done!');
