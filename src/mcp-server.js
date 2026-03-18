const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');
const queries = require('./queries');
const { computeReputation } = require('./reputation');
const { generatePassport, generateA2ACard } = require('./passport');
const { generateInsights } = require('./insights');

/**
 * Create an MCP server with AgentStamp tools.
 * This is mounted at /mcp on the existing Express app.
 */
function createMcpServer() {
  const server = new McpServer({
    name: 'AgentStamp',
    version: '1.0.0',
  });

  // --- Tool: search_agents ---
  server.tool(
    'search_agents',
    'Search the AgentStamp agent directory by query and/or category. Returns agents with reputation scores.',
    {
      query: z.string().optional().describe('Search term to match against agent names, descriptions, and capabilities'),
      category: z.string().optional().describe('Filter by category: data, trading, research, creative, infrastructure, other'),
      limit: z.number().optional().default(10).describe('Max results (default 10, max 100)'),
    },
    async ({ query, category, limit }) => {
      const agents = queries.searchAgents({ q: query, category, limit: limit || 10 });
      const withRep = agents.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        category: a.category,
        capabilities: a.capabilities,
        endorsement_count: a.endorsement_count,
        reputation: computeReputation(a.id),
        profile_url: `https://agentstamp.org/registry/${a.id}`,
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ agents: withRep, count: withRep.length }, null, 2),
        }],
      };
    }
  );

  // --- Tool: get_agent ---
  server.tool(
    'get_agent',
    'Get full agent profile by ID, including endorsements and reputation score.',
    {
      agent_id: z.string().describe('The agent ID (e.g., agt_E-PFtTAIQlfVleNm)'),
    },
    async ({ agent_id }) => {
      const agent = queries.getAgentById(agent_id);
      if (!agent) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Agent not found' }) }] };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(agent, null, 2) }],
      };
    }
  );

  // --- Tool: verify_stamp ---
  server.tool(
    'verify_stamp',
    'Verify an AgentStamp identity certificate by its stamp ID.',
    {
      stamp_id: z.string().describe('The stamp ID to verify (e.g., stmp_QLNhL-Y1CvlyWxnG)'),
    },
    async ({ stamp_id }) => {
      const { getDb } = require('./database');
      const { verifyCertificate, getPublicKey } = require('./crypto');
      const db = getDb();

      const stamp = db.prepare('SELECT * FROM stamps WHERE id = ?').get(stamp_id);
      if (!stamp) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Stamp not found' }) }] };
      }

      const certificate = JSON.parse(stamp.certificate);
      const isValid = verifyCertificate(certificate, stamp.signature);
      const isExpired = new Date(stamp.expires_at) < new Date();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            stamp_id: stamp.id,
            tier: stamp.tier,
            wallet_address: stamp.wallet_address,
            issued_at: stamp.issued_at,
            expires_at: stamp.expires_at,
            valid: isValid && !isExpired && !stamp.revoked,
            expired: isExpired,
            revoked: !!stamp.revoked,
            signature_valid: isValid,
            public_key: getPublicKey(),
          }, null, 2),
        }],
      };
    }
  );

  // --- Tool: browse_agents ---
  server.tool(
    'browse_agents',
    'Browse registered agents with optional category filter and sorting.',
    {
      category: z.string().optional().describe('Filter by category'),
      sort: z.enum(['endorsements', 'newest', 'name', 'reputation']).optional().default('endorsements').describe('Sort order'),
      limit: z.number().optional().default(10).describe('Max results'),
    },
    async ({ category, sort, limit }) => {
      const agents = queries.browseAgents({ category, sort, limit: limit || 10 });
      const results = agents.map(a => ({
        id: a.id,
        name: a.name,
        category: a.category,
        endorsement_count: a.endorsement_count,
        reputation: a.reputation || computeReputation(a.id),
        registered_at: a.registered_at,
      }));

      return {
        content: [{ type: 'text', text: JSON.stringify({ agents: results, count: results.length }, null, 2) }],
      };
    }
  );

  // --- Tool: get_leaderboard ---
  server.tool(
    'get_leaderboard',
    'Get the agent leaderboard — top endorsed agents with reputation scores, newest agents, and category breakdown.',
    {},
    async () => {
      const leaderboard = queries.getLeaderboard();
      return {
        content: [{ type: 'text', text: JSON.stringify(leaderboard, null, 2) }],
      };
    }
  );

  // --- Tool: browse_wishes ---
  server.tool(
    'browse_wishes',
    'Browse wishes from the Wishing Well. Discover what capabilities AI agents want.',
    {
      category: z.string().optional().describe('Filter by wish category'),
      sort: z.enum(['newest', 'most_granted', 'oldest']).optional().default('newest'),
      limit: z.number().optional().default(10),
    },
    async ({ category, sort, limit }) => {
      const wishes = queries.browseWishes({ category, sort, limit: limit || 10 });
      return {
        content: [{ type: 'text', text: JSON.stringify({ wishes, count: wishes.length }, null, 2) }],
      };
    }
  );

  // --- Tool: get_trending ---
  server.tool(
    'get_trending',
    'Get trending wish categories and velocity from the Wishing Well.',
    {},
    async () => {
      const trending = queries.getTrending();
      return {
        content: [{ type: 'text', text: JSON.stringify(trending, null, 2) }],
      };
    }
  );

  // --- Tool: get_agent_reputation ---
  server.tool(
    'get_agent_reputation',
    'Get an agent\'s reputation score (0-100) with full breakdown by tier, endorsements, uptime, age, and wishes granted.',
    {
      agent_id: z.string().describe('The agent ID'),
    },
    async ({ agent_id }) => {
      const reputation = computeReputation(agent_id);
      if (!reputation) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Agent not found' }) }] };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ agent_id, ...reputation }, null, 2) }],
      };
    }
  );

  // --- Tool: get_passport ---
  server.tool(
    'get_passport',
    'Get a signed cross-protocol agent passport. Contains identity, stamp, reputation, A2A card, and MCP metadata — all Ed25519-signed.',
    {
      wallet_address: z.string().describe('Ethereum wallet address (0x...)'),
    },
    async ({ wallet_address }) => {
      const passport = generatePassport(wallet_address);
      if (!passport) {
        return { content: [{ type: 'text', text: JSON.stringify({
          error: 'No active agent found for this wallet',
          trusted: false,
          message: 'This wallet has no AgentStamp identity. Register for free to get a verifiable passport.',
          register_url: 'https://agentstamp.org/register',
        }) }] };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(passport, null, 2) }],
      };
    }
  );

  // --- Tool: trust_check ---
  server.tool(
    'trust_check',
    'Single-call trust verdict for any wallet address. Returns whether the agent is trusted, their score, tier, and profile info. Unregistered agents get trusted: false with a registration CTA.',
    {
      wallet_address: z.string().describe('Wallet address to check trust status for'),
    },
    async ({ wallet_address }) => {
      const { getDb } = require('./database');
      const db = getDb();

      const stamp = db.prepare(
        "SELECT id, tier, expires_at FROM stamps WHERE wallet_address = ? AND revoked = 0 AND expires_at > datetime('now') ORDER BY CASE tier WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 WHEN 'bronze' THEN 3 WHEN 'free' THEN 4 ELSE 5 END LIMIT 1"
      ).get(wallet_address);

      const agent = db.prepare(
        "SELECT id, name, category, endorsement_count, status, registered_at FROM agents WHERE wallet_address = ? AND status = 'active' LIMIT 1"
      ).get(wallet_address);

      if (!stamp && !agent) {
        return { content: [{ type: 'text', text: JSON.stringify({
          trusted: false,
          score: 0,
          tier: null,
          label: 'unknown',
          message: 'This wallet has no AgentStamp identity. The agent is unverified and not in the public registry.',
          action: {
            register: 'https://agentstamp.org/register',
            message: 'Register for free in 60 seconds to become trusted and discoverable.',
          },
        }, null, 2) }] };
      }

      let reputation = { score: 0, tier_label: 'new', breakdown: null };
      if (agent) {
        const rep = computeReputation(agent.id);
        if (rep) reputation = rep;
      }

      const trusted = reputation.score >= 10 || !!stamp;

      return {
        content: [{ type: 'text', text: JSON.stringify({
          trusted,
          score: reputation.score,
          tier: stamp?.tier || 'none',
          label: reputation.tier_label,
          agent: agent ? {
            id: agent.id,
            name: agent.name,
            category: agent.category,
            endorsements: agent.endorsement_count,
            profile_url: `https://agentstamp.org/registry/${agent.id}`,
          } : null,
          stamp: stamp ? { id: stamp.id, tier: stamp.tier, expires_at: stamp.expires_at } : null,
        }, null, 2) }],
      };
    }
  );

  // --- Tool: trust_compare ---
  server.tool(
    'trust_compare',
    'Compare trust scores of up to 5 wallets side-by-side. See who leads, the score gap, and which agents are unregistered.',
    {
      wallets: z.array(z.string()).min(2).max(5).describe('Array of 2-5 wallet addresses to compare'),
    },
    async ({ wallets }) => {
      const { getDb } = require('./database');
      const db = getDb();

      const results = wallets.map(wallet => {
        const stamp = db.prepare(
          "SELECT tier FROM stamps WHERE wallet_address = ? AND revoked = 0 AND expires_at > datetime('now') ORDER BY CASE tier WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 WHEN 'bronze' THEN 3 WHEN 'free' THEN 4 ELSE 5 END LIMIT 1"
        ).get(wallet);

        const agent = db.prepare(
          "SELECT id, name, endorsement_count FROM agents WHERE wallet_address = ? AND status = 'active' LIMIT 1"
        ).get(wallet);

        let reputation = { score: 0, tier_label: 'unknown' };
        if (agent) {
          const rep = computeReputation(agent.id);
          if (rep) reputation = rep;
        }

        return {
          wallet: wallet.slice(0, 6) + '...' + wallet.slice(-4),
          registered: !!agent,
          stamped: !!stamp,
          tier: stamp?.tier || 'none',
          name: agent?.name || null,
          score: reputation.score,
          label: agent ? reputation.tier_label : 'unknown',
          endorsements: agent?.endorsement_count || 0,
        };
      });

      results.sort((a, b) => b.score - a.score);
      const unregistered = results.filter(r => !r.registered);

      return {
        content: [{ type: 'text', text: JSON.stringify({
          comparison: results,
          leader: results[0],
          gap: results.length >= 2 ? results[0].score - results[results.length - 1].score : 0,
          unregistered_count: unregistered.length,
          nudge: unregistered.length > 0
            ? `${unregistered.length} agent(s) are not registered. They have 0 trust score. Register free: https://agentstamp.org/register`
            : null,
        }, null, 2) }],
      };
    }
  );

  // --- Tool: trust_network ---
  server.tool(
    'trust_network',
    'Network-wide trust statistics: total agents, stamps, endorsements, wishes, average reputation, top categories. Social proof for the AgentStamp network.',
    {},
    async () => {
      const { getDb } = require('./database');
      const db = getDb();

      const agents = db.prepare("SELECT COUNT(*) as count FROM agents WHERE status = 'active'").get();
      const stamps = db.prepare("SELECT COUNT(*) as count FROM stamps WHERE revoked = 0 AND expires_at > datetime('now')").get();
      const endorsements = db.prepare('SELECT COUNT(*) as count FROM endorsements').get();
      const wishes = db.prepare('SELECT COUNT(*) as count FROM wishes').get();
      const wishesGranted = db.prepare('SELECT COUNT(*) as count FROM wishes WHERE granted = 1').get();

      const topCategories = db.prepare(
        "SELECT category, COUNT(*) as count FROM agents WHERE status = 'active' AND category IS NOT NULL GROUP BY category ORDER BY count DESC LIMIT 5"
      ).all();

      return {
        content: [{ type: 'text', text: JSON.stringify({
          network: {
            active_agents: agents.count,
            active_stamps: stamps.count,
            total_endorsements: endorsements.count,
            total_wishes: wishes.count,
            wishes_granted: wishesGranted.count,
          },
          top_categories: topCategories,
          message: `${agents.count} agents trust AgentStamp. Join them.`,
          register_url: 'https://agentstamp.org/register',
        }, null, 2) }],
      };
    }
  );

  return server;
}

/**
 * Mount the MCP server on an Express app at a given path.
 * Handles POST (messages), GET (SSE), and DELETE (session cleanup).
 */
// Session limits — prevent unbounded memory growth (DoS vector)
const MAX_SESSIONS = 1000;
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function mountMcpOnExpress(app, path = '/mcp') {
  // Map of sessionId -> { server, transport, lastActivity }
  const sessions = new Map();

  // Periodic cleanup of idle sessions (every 5 minutes)
  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastActivity > SESSION_IDLE_TIMEOUT_MS) {
        try { session.transport.close?.(); } catch { /* ignore */ }
        sessions.delete(id);
      }
    }
  }, 5 * 60 * 1000);

  // POST /mcp — handles new sessions and messages
  app.post(path, async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'];

      if (sessionId && sessions.has(sessionId)) {
        // Existing session — forward message to its transport
        const session = sessions.get(sessionId);
        session.lastActivity = Date.now();
        await session.transport.handleRequest(req, res);
      } else {
        // Enforce session cap — reject new sessions when at capacity
        if (sessions.size >= MAX_SESSIONS) {
          return res.status(503).json({
            error: 'Too many active MCP sessions. Please try again later.',
          });
        }

        // New session — create a fresh server + transport pair
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // auto-generate
        });

        const server = createMcpServer();

        transport.onclose = () => {
          const id = transport.sessionId;
          if (id) sessions.delete(id);
        };

        await server.connect(transport);

        if (transport.sessionId) {
          sessions.set(transport.sessionId, { server, transport, lastActivity: Date.now() });
        }

        await transport.handleRequest(req, res);
      }
    } catch (err) {
      console.error('MCP POST error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'MCP server error' });
      }
    }
  });

  // GET /mcp — SSE stream for server-to-client notifications
  app.get(path, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({ error: 'Invalid or missing session ID. Send a POST to initialize first.' });
      return;
    }

    const session = sessions.get(sessionId);
    session.lastActivity = Date.now();
    await session.transport.handleRequest(req, res);
  });

  // DELETE /mcp — close session
  app.delete(path, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({ error: 'Invalid or missing session ID' });
      return;
    }

    const { transport } = sessions.get(sessionId);
    await transport.handleRequest(req, res);
    sessions.delete(sessionId);
  });

  console.log(`MCP server mounted at ${path} (Streamable HTTP transport, max ${MAX_SESSIONS} sessions, ${SESSION_IDLE_TIMEOUT_MS / 60000}min idle timeout)`);
}

module.exports = { createMcpServer, mountMcpOnExpress };
