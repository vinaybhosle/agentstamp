#!/usr/bin/env node
/**
 * Activate ALL 8 paid endpoints on Bazaar by making one real payment on each.
 *
 * Usage:
 *   PAYER_PRIVATE_KEY=<base58_solana_key> node scripts/bazaar-activate-all.js
 *   node scripts/bazaar-activate-all.js --key <base58_solana_key>
 *
 * Cost: ~$0.042 USDC (all 8 endpoints)
 */

const BASE_URL = 'https://agentstamp.org';

const ENDPOINTS = [
  { name: 'stamp/mint/bronze',       method: 'POST', path: '/api/v1/stamp/mint/bronze',       price: '$0.001', body: {} },
  { name: 'stamp/mint/silver',       method: 'POST', path: '/api/v1/stamp/mint/silver',       price: '$0.005', body: {} },
  { name: 'stamp/mint/gold',         method: 'POST', path: '/api/v1/stamp/mint/gold',         price: '$0.01',  body: {} },
  { name: 'registry/register',       method: 'POST', path: '/api/v1/registry/register',       price: '$0.01',  body: { name: 'BazaarTestAgent', description: 'Activation test agent', category: 'infrastructure', capabilities: ['test'], protocols: ['x402'], endpoint: 'https://example.com' } },
  { name: 'registry/endorse',        method: 'POST', path: '/api/v1/registry/endorse/test',   price: '$0.005', body: {} },
  { name: 'registry/update',         method: 'PUT',  path: '/api/v1/registry/update/test',    price: '$0.005', body: { description: 'Updated test agent' } },
  { name: 'well/wish',               method: 'POST', path: '/api/v1/well/wish',               price: '$0.001', body: { text: 'Bazaar activation test wish', category: 'capability' } },
  { name: 'well/grant',              method: 'POST', path: '/api/v1/well/grant/test',         price: '$0.005', body: {} },
];

let privateKey = process.env.PAYER_PRIVATE_KEY;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--key' && args[i + 1]) privateKey = args[++i];
}

if (!privateKey) {
  console.log('\nUsage: PAYER_PRIVATE_KEY=<base58_key> node scripts/bazaar-activate-all.js\n');
  process.exit(1);
}

async function main() {
  const totalCost = ENDPOINTS.reduce((s, e) => s + parseFloat(e.price.replace('$', '')), 0);
  console.log(`\n  Bazaar Activation — ${ENDPOINTS.length} endpoints, $${totalCost.toFixed(3)} USDC total\n`);

  // Try loading x402 client libraries from api-gateway or local node_modules
  let wrapFetchWithPayment, x402Client, ExactSvmScheme, createKeyPairSignerFromBytes, base58;
  try {
    ({ wrapFetchWithPayment } = require('@x402/fetch'));
    ({ x402Client } = require('@x402/core/client'));
    ({ ExactSvmScheme } = require('@x402/svm'));
    ({ createKeyPairSignerFromBytes } = require('@solana/kit'));
    ({ base58 } = require('@scure/base'));
  } catch {
    console.error('  Missing dependencies. Install: npm i @x402/fetch @x402/core @x402/svm @solana/kit @scure/base');
    process.exit(1);
  }

  const client = new x402Client();
  const keyBytes = base58.decode(privateKey);
  const svmSigner = await createKeyPairSignerFromBytes(keyBytes);
  client.register('solana:*', new ExactSvmScheme(svmSigner));
  const fetchPaid = wrapFetchWithPayment(fetch, client);

  console.log('  Solana signer ready.\n');

  let ok = 0, fail = 0;
  for (let i = 0; i < ENDPOINTS.length; i++) {
    const ep = ENDPOINTS[i];
    const label = `${(i + 1).toString().padStart(2)}.  ${ep.name.padEnd(24)}  ${ep.price.padEnd(8)}`;
    try {
      const opts = { method: ep.method };
      if ((ep.method === 'POST' || ep.method === 'PUT') && ep.body) {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = JSON.stringify(ep.body);
      }
      const res = await fetchPaid(`${BASE_URL}${ep.path}`, opts);
      if (res.ok) {
        console.log(`  ${label}  OK`);
        ok++;
      } else {
        const text = await res.text();
        console.log(`  ${label}  FAIL ${res.status} ${text.slice(0, 60)}`);
        fail++;
      }
    } catch (err) {
      console.log(`  ${label}  FAIL ${err.message.slice(0, 50)}`);
      fail++;
    }
    if (i < ENDPOINTS.length - 1) await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n  Done: ${ok} succeeded, ${fail} failed`);
  console.log(`  Cost: ~$${totalCost.toFixed(3)} USDC`);
  console.log(`  Check: https://facilitator.payai.network/discovery/resources\n`);
}

main().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
