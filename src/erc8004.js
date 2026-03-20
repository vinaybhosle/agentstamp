/**
 * ERC-8004 Registry Client — read-only bridge to on-chain agent identity.
 *
 * Uses ethers.js (already a dependency) to query the ERC-8004 Identity Registry
 * and Reputation Registry on Base L2. All operations are view functions = zero gas.
 *
 * Contract addresses are deterministic (CREATE2) — same on all EVM chains.
 */

const { JsonRpcProvider, Contract } = require('ethers');

// ERC-8004 registry addresses (deterministic across chains via CREATE2)
const IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const REPUTATION_REGISTRY = '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63';

// Human-readable ABIs — only the view functions we need
const IDENTITY_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function getAgentWallet(uint256 agentId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
];

// Base L2 public RPC (free, no API key needed)
const BASE_RPC_URL = process.env.ERC8004_RPC_URL || 'https://mainnet.base.org';

// In-memory cache for RPC results (avoid redundant calls)
const _cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedOrNull(key) {
  const entry = _cache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  if (entry) _cache.delete(key);
  return null;
}

function setCache(key, data) {
  _cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  // Prevent unbounded growth
  if (_cache.size > 1000) {
    const oldest = _cache.keys().next().value;
    _cache.delete(oldest);
  }
}

let _provider = null;
let _identityRegistry = null;

function getProvider() {
  if (!_provider) {
    _provider = new JsonRpcProvider(BASE_RPC_URL);
  }
  return _provider;
}

function getIdentityRegistry() {
  if (!_identityRegistry) {
    _identityRegistry = new Contract(IDENTITY_REGISTRY, IDENTITY_ABI, getProvider());
  }
  return _identityRegistry;
}

/**
 * Look up an ERC-8004 agent by on-chain ID.
 * Returns owner address, agent wallet, and registration URI.
 * All view functions — zero gas cost.
 */
async function lookupAgent(agentId) {
  const cacheKey = `agent:${agentId}`;
  const cached = getCachedOrNull(cacheKey);
  if (cached) return cached;

  const registry = getIdentityRegistry();

  try {
    const [owner, agentURI, agentWallet] = await Promise.all([
      registry.ownerOf(agentId),
      registry.tokenURI(agentId),
      registry.getAgentWallet(agentId).catch(() => null), // May not be set
    ]);

    const result = Object.freeze({
      found: true,
      agentId: agentId.toString(),
      owner,
      agentURI,
      agentWallet: agentWallet || null,
      chain: 'base',
      registryAddress: IDENTITY_REGISTRY,
    });

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    // Token doesn't exist or RPC error
    if (err.message?.includes('ERC721') || err.message?.includes('nonexistent token')) {
      return Object.freeze({ found: false, agentId: agentId.toString(), error: 'Agent not found in ERC-8004 registry' });
    }
    throw new Error(`ERC-8004 lookup failed: ${err.message}`);
  }
}

// Maximum response body size for registration file fetches (512 KB)
const MAX_REGFILE_SIZE = 512 * 1024;
// Shorter cache TTL for failed/invalid URIs to prevent repeated fetch amplification
const NEGATIVE_CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Validate that a URI is safe to fetch (SSRF protection).
 * Only allows https:// scheme. Rejects http://, file://, etc.
 */
function isSafeUri(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Fetch and parse the ERC-8004 registration file from the agent URI.
 * Supports https:// and ipfs:// (via gateway). Rejects http:// (SSRF protection).
 * Enforces response body size limit (512 KB).
 *
 * SECURITY: Registration URIs are set by arbitrary ERC-8004 token owners.
 * Never fetch http://, never follow redirects to internal networks.
 */
async function fetchRegistrationFile(agentURI) {
  if (!agentURI) return null;

  const cacheKey = `regfile:${agentURI}`;
  const cached = getCachedOrNull(cacheKey);
  if (cached) return cached;

  let url = agentURI;

  // Convert IPFS URIs to gateway URLs (always https)
  if (url.startsWith('ipfs://')) {
    const cid = url.replace('ipfs://', '');
    url = `https://ipfs.io/ipfs/${cid}`;
  }

  // Handle data: URIs (inline base64 JSON — no network request)
  if (url.startsWith('data:')) {
    try {
      const base64 = url.split(',')[1];
      const json = Buffer.from(base64, 'base64').toString('utf-8');
      if (json.length > MAX_REGFILE_SIZE) return null;
      const parsed = JSON.parse(json);
      setCache(cacheKey, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  // SSRF protection: only allow https:// URIs
  if (!isSafeUri(url)) {
    // Cache negative result to prevent repeated attempts
    _cache.set(cacheKey, { data: null, expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS });
    return null;
  }

  // Fetch HTTPS URIs with size limit
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
      redirect: 'error',
    });
    clearTimeout(timeout);

    if (!response.ok) {
      // Cache negative result to prevent repeated fetches for broken URIs
      _cache.set(cacheKey, { data: null, expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS });
      return null;
    }

    // Enforce response body size limit before parsing
    const text = await response.text();
    if (text.length > MAX_REGFILE_SIZE) return null;

    const data = JSON.parse(text);
    setCache(cacheKey, data);
    return data;
  } catch {
    // Cache negative result for transient errors
    _cache.set(cacheKey, { data: null, expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS });
    return null;
  }
}

/**
 * Full lookup: on-chain data + off-chain registration file.
 * Returns a unified agent profile from both sources.
 */
async function getFullAgent(agentId) {
  const onChain = await lookupAgent(agentId);
  if (!onChain.found) return onChain;

  const regFile = await fetchRegistrationFile(onChain.agentURI);

  // SECURITY: Extract only known keys from regFile to prevent prototype pollution.
  // regFile comes from arbitrary external JSON — never spread it directly.
  return Object.freeze({
    ...onChain,
    registration: regFile ? Object.freeze({
      name: typeof regFile.name === 'string' ? regFile.name : null,
      description: typeof regFile.description === 'string' ? regFile.description : null,
      image: typeof regFile.image === 'string' ? regFile.image : null,
      services: Array.isArray(regFile.services) ? regFile.services : [],
    }) : null,
  });
}

module.exports = {
  lookupAgent,
  fetchRegistrationFile,
  getFullAgent,
  IDENTITY_REGISTRY,
  REPUTATION_REGISTRY,
};
