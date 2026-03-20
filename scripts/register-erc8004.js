#!/usr/bin/env node
/**
 * One-time script: Register AgentStamp on ERC-8004 Identity Registry (Base L2).
 *
 * Prerequisites:
 *   - Set ERC8004_PRIVATE_KEY in .env (private key of the wallet that will own the NFT)
 *   - Set ERC8004_RPC_URL in .env (or defaults to https://mainnet.base.org)
 *   - The registration file must be hosted at https://agentstamp.org/.well-known/erc8004-registration.json
 *
 * Usage: node scripts/register-erc8004.js
 *
 * Gas cost on Base: < $0.01 (one-time)
 */

require('dotenv').config();
const { JsonRpcProvider, Wallet, Contract } = require('ethers');

const IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const REGISTRATION_URI = 'https://agentstamp.org/.well-known/erc8004-registration.json';

const IDENTITY_ABI = [
  'function register(string calldata agentURI) external returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
];

async function main() {
  const privateKey = process.env.ERC8004_PRIVATE_KEY;
  if (!privateKey) {
    console.error('ERROR: Set ERC8004_PRIVATE_KEY in .env');
    console.error('This is the private key of the wallet that will own the AgentStamp ERC-8004 NFT.');
    process.exit(1);
  }

  const rpcUrl = process.env.ERC8004_RPC_URL || 'https://mainnet.base.org';
  console.log(`Connecting to Base L2: ${rpcUrl}`);

  const provider = new JsonRpcProvider(rpcUrl);
  const signer = new Wallet(privateKey, provider);
  const address = await signer.getAddress();

  console.log(`Wallet: ${address}`);

  // Check if already registered
  const registry = new Contract(IDENTITY_REGISTRY, IDENTITY_ABI, signer);
  const balance = await registry.balanceOf(address);
  console.log(`Existing ERC-8004 agents owned by this wallet: ${balance}`);

  if (balance > 0n) {
    console.log('WARNING: This wallet already has ERC-8004 agent(s). Proceeding will register another.');
    console.log('Press Ctrl+C within 5 seconds to cancel...');
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log(`\nRegistering AgentStamp on ERC-8004...`);
  console.log(`Registration URI: ${REGISTRATION_URI}`);

  const tx = await registry.register(REGISTRATION_URI);
  console.log(`Transaction sent: ${tx.hash}`);
  console.log('Waiting for confirmation...');

  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber}`);

  // Extract agentId from Transfer event (ERC-721 mint)
  const transferEvent = receipt.logs.find(log => {
    try {
      const iface = registry.interface;
      const parsed = iface.parseLog({ topics: log.topics, data: log.data });
      return parsed && parsed.name === 'Transfer';
    } catch {
      return false;
    }
  });

  if (transferEvent) {
    const parsed = registry.interface.parseLog({ topics: transferEvent.topics, data: transferEvent.data });
    const agentId = parsed.args[2]; // tokenId
    console.log(`\nSUCCESS: AgentStamp registered on ERC-8004!`);
    console.log(`Agent ID: ${agentId}`);
    console.log(`Owner: ${address}`);
    console.log(`\nSave this agent ID — you'll need it to set up the bridge.`);
    console.log(`\nNext steps:`);
    console.log(`  1. Add ERC8004_AGENT_ID=${agentId} to .env`);
    console.log(`  2. Restart PM2: pm2 restart agentstamp`);
    console.log(`  3. Verify: curl https://agentstamp.org/api/v1/bridge/erc8004/${agentId}`);
  } else {
    console.log('Transaction confirmed but could not extract agent ID from events.');
    console.log('Check the transaction on BaseScan:', `https://basescan.org/tx/${receipt.hash}`);
  }
}

main().catch(err => {
  console.error('Registration failed:', err.message);
  process.exit(1);
});
