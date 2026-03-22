#!/usr/bin/env node
/**
 * AgentStamp MCP Server — stdio transport entry point.
 *
 * Usage:
 *   node mcp-stdio.js
 *   npx agentstamp          (when installed via npm)
 *
 * This allows MCP clients (Claude Desktop, Glama inspector, etc.) to
 * connect to the AgentStamp MCP server over stdin/stdout.
 *
 * If WALLET_ADDRESS and other env vars are not set, the server runs in
 * "inspection mode" with a temporary in-memory database so that tool
 * definitions can still be listed.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

// Ensure required env vars exist — use safe defaults for inspection/demo mode
if (!process.env.WALLET_ADDRESS) {
  process.env.WALLET_ADDRESS = '0x0000000000000000000000000000000000000000';
}
if (!process.env.BLIND_TOKEN_SECRET) {
  process.env.BLIND_TOKEN_SECRET = 'stdio-inspection-mode-blind-token-secret';
}
if (!process.env.IP_HASH_SALT) {
  process.env.IP_HASH_SALT = 'stdio-inspection-mode-ip-hash-salt';
}

// Use a temp directory for database + keys so stdio mode doesn't touch production data
const tmpDir = path.join(os.tmpdir(), 'agentstamp-mcp-stdio');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}
if (!process.env.DB_PATH) {
  process.env.DB_PATH = path.join(tmpDir, 'agentstamp-stdio.db');
}
if (!process.env.SIGNING_KEY_PATH) {
  process.env.SIGNING_KEY_PATH = path.join(tmpDir, 'ed25519_private.pem');
}

// Redirect console to stderr BEFORE loading any modules —
// stdio transport uses stdout exclusively for JSON-RPC protocol messages.
console.log = (...args) => process.stderr.write(args.join(' ') + '\n');
console.warn = (...args) => process.stderr.write(args.join(' ') + '\n');
console.error = (...args) => process.stderr.write(args.join(' ') + '\n');

// Now load modules (config.js reads env vars at require time)
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { createMcpServer } = require('./src/mcp-server');
const database = require('./src/database');
const cryptoModule = require('./src/crypto');

async function main() {
  // Initialize core systems
  database.initialize();
  cryptoModule.initialize();

  // Create MCP server and connect via stdio
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  process.stderr.write('AgentStamp MCP server running on stdio transport\n');
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
