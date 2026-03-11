#!/usr/bin/env node
/**
 * Activate ALL 8 paid endpoints on Bazaar by making one real payment on each.
 *
 * Usage (Solana):
 *   PAYER_PRIVATE_KEY=<base58_solana_key> node scripts/bazaar-activate-all.js --chain solana
 *
 * Usage (Base/EVM):
 *   PAYER_PRIVATE_KEY=<hex_evm_key> node scripts/bazaar-activate-all.js --chain base
 *
 * Cost: ~$0.042 USDC per chain (all 8 endpoints)
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
let chain = 'solana'; // default to solana
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--key' && args[i + 1]) privateKey = args[++i];
  if (args[i] === '--chain' && args[i + 1]) chain = args[++i].toLowerCase();
}

if (!privateKey) {
  console.log('\nUsage: PAYER_PRIVATE_KEY=<key> node scripts/bazaar-activate-all.js --chain <solana|base>\n');
  console.log('  --chain solana  (default) Base58 Solana private key, pays with USDC on Solana');
  console.log('  --chain base    0x-prefixed hex EVM key, pays with USDC on Base\n');
  process.exit(1);
}

async function setupSolana() {
  const { wrapFetchWithPayment } = require('@x402/fetch');
  const { x402Client } = require('@x402/core/client');
  const { ExactSvmScheme, toClientSvmSigner } = require('@x402/svm');
  const { createKeyPairSignerFromPrivateKeyBytes } = require('@solana/kit');
  const { decode: decodeBase58 } = require('@scure/base').base58;

  const keyBytes = decodeBase58(privateKey);
  const signer = await createKeyPairSignerFromPrivateKeyBytes(keyBytes.slice(0, 32));
  const svmSigner = toClientSvmSigner(signer);
  const svmScheme = new ExactSvmScheme(svmSigner);
  const client = new x402Client();
  client.register('solana:*', svmScheme);
  const fetchPaid = wrapFetchWithPayment(fetch, client);

  console.log(`  Solana signer ready (${signer.address}).\n`);
  return fetchPaid;
}

async function setupBase() {
  const { wrapFetchWithPayment } = require('@x402/fetch');
  const { x402Client } = require('@x402/core/client');
  const { ExactEvmScheme, toClientEvmSigner } = require('@x402/evm');
  const { createWalletClient, publicActions, http } = require('viem');
  const { base } = require('viem/chains');
  const { privateKeyToAccount } = require('viem/accounts');

  const key = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(key);
  const walletClient = createWalletClient({ account, chain: base, transport: http() }).extend(publicActions);
  const evmSigner = toClientEvmSigner(walletClient);
  const evmScheme = new ExactEvmScheme(evmSigner);
  const client = new x402Client();
  client.register('base', evmScheme);
  const fetchPaid = wrapFetchWithPayment(fetch, client);

  console.log(`  EVM signer ready (${account.address}).\n`);
  return fetchPaid;
}

async function main() {
  const totalCost = ENDPOINTS.reduce((s, e) => s + parseFloat(e.price.replace('$', '')), 0);
  const chainLabel = chain === 'solana' ? 'Solana' : 'Base';
  console.log(`\n  Bazaar Activation — ${ENDPOINTS.length} endpoints, $${totalCost.toFixed(3)} USDC on ${chainLabel}\n`);

  let fetchPaid;
  try {
    fetchPaid = chain === 'solana' ? await setupSolana() : await setupBase();
  } catch (err) {
    console.error(`  Failed to set up ${chainLabel} signer: ${err.message}`);
    process.exit(1);
  }

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
