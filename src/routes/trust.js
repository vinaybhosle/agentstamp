const express = require('express');
const router = express.Router();
const { getDb, resolvePrimaryWallet, getAllLinkedWallets } = require('../database');
const { computeReputation } = require('../reputation');

/**
 * Trust API — the "itch" hook.
 *
 * Any service can call GET /api/v1/trust/check/:wallet to get a simple
 * trust verdict. Unregistered agents get { trusted: false } with a CTA
 * to register. This makes AgentStamp the default trust oracle.
 *
 * GET /api/v1/trust/compare?wallets=0x...,0x... compares agents side-by-side
 * so agents can see where they rank vs competitors.
 */

// GET /api/v1/trust/check/:walletAddress — Single-call trust verdict (FREE)
router.get('/check/:walletAddress', (req, res) => {
  try {
    const db = getDb();
    const inputWallet = req.params.walletAddress;
    const wallet = resolvePrimaryWallet(inputWallet);
    const wasResolved = wallet !== inputWallet;

    // Get all wallets in this identity (primary + linked)
    const walletInfo = getAllLinkedWallets(wallet);
    const allWallets = walletInfo.all;
    const placeholders = allWallets.map(() => '?').join(',');

    // Look up best active stamp across all linked wallets
    const stamp = db.prepare(
      `SELECT id, tier, expires_at FROM stamps WHERE wallet_address IN (${placeholders}) AND revoked = 0 AND expires_at > datetime('now') ORDER BY CASE tier WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 WHEN 'bronze' THEN 3 WHEN 'free' THEN 4 ELSE 5 END LIMIT 1`
    ).get(...allWallets);

    // Look up active agent across all linked wallets
    const agent = db.prepare(
      `SELECT id, name, category, endorsement_count, status, registered_at FROM agents WHERE wallet_address IN (${placeholders}) AND status = 'active' ORDER BY registered_at ASC LIMIT 1`
    ).get(...allWallets);

    // No stamp AND no agent = completely unknown
    if (!stamp && !agent) {
      return res.json({
        trusted: false,
        score: 0,
        tier: null,
        label: 'unknown',
        agent: null,
        stamp: null,
        message: 'This wallet has no AgentStamp identity. The agent is unverified and not in the public registry.',
        action: {
          register: 'https://agentstamp.org/register',
          docs: 'https://agentstamp.org/docs',
          message: 'Register for free in 60 seconds to become trusted and discoverable.',
        },
      });
    }

    // Compute reputation
    let reputation = { score: 0, tier_label: 'new', breakdown: null };
    if (agent) {
      const rep = computeReputation(agent.id);
      if (rep) reputation = rep;
    }

    // Trust threshold: score >= 10 = trusted (any stamp or registration = trusted)
    const trusted = reputation.score >= 10 || !!stamp;

    const response = {
      trusted,
      score: reputation.score,
      tier: stamp?.tier || 'none',
      label: reputation.tier_label,
      agent: agent ? {
        id: agent.id,
        name: agent.name,
        category: agent.category,
        endorsements: agent.endorsement_count,
        registered_at: agent.registered_at,
        profile_url: `https://agentstamp.org/registry/${agent.id}`,
      } : null,
      stamp: stamp ? {
        id: stamp.id,
        tier: stamp.tier,
        expires_at: stamp.expires_at,
        verify_url: `https://agentstamp.org/api/v1/stamp/verify/${stamp.id}`,
      } : null,
    };

    // If wallet was resolved via linking, add resolution info
    if (wasResolved) {
      response.linked_from = inputWallet;
      response.resolved_to = wallet;
    }

    // Include linked wallets if any exist
    if (walletInfo.linked.length > 0) {
      response.wallets = {
        primary: walletInfo.primary,
        linked: walletInfo.linked.map(l => ({ address: l.linked_wallet, chain: l.chain_hint })),
      };
    }

    // If score is low, nudge them to upgrade
    if (reputation.score < 50) {
      response.upgrade_hint = {
        current_score: reputation.score,
        next_milestone: reputation.score < 26 ? 'emerging (26+)' : 'established (51+)',
        tips: [
          !stamp || stamp.tier === 'free' ? 'Upgrade to Gold stamp (+30 score)' : null,
          agent && agent.endorsement_count < 6 ? `Get ${6 - agent.endorsement_count} more endorsements (+${(6 - agent.endorsement_count) * 5} score)` : null,
          'Send heartbeats regularly for uptime score (+20 max)',
          'Grant wishes in the Wishing Well (+10 max)',
        ].filter(Boolean),
      };
    }

    res.json(response);
  } catch (err) {
    console.error('Trust check error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/trust/compare?wallets=0x...,0x... — Side-by-side trust comparison (FREE)
router.get('/compare', (req, res) => {
  try {
    const walletsParam = req.query.wallets || '';
    const wallets = walletsParam.split(',').map(w => w.trim()).filter(Boolean).slice(0, 5);

    if (wallets.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Provide at least 2 wallet addresses: ?wallets=0x...,0x...',
      });
    }

    const db = getDb();
    const results = wallets.map(inputWallet => {
      // Resolve linked wallets for comparison
      const resolved = resolvePrimaryWallet(inputWallet);
      const walletSet = getAllLinkedWallets(resolved);
      const allW = walletSet.all;
      const ph = allW.map(() => '?').join(',');

      const stamp = db.prepare(
        `SELECT id, tier, expires_at FROM stamps WHERE wallet_address IN (${ph}) AND revoked = 0 AND expires_at > datetime('now') ORDER BY CASE tier WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 WHEN 'bronze' THEN 3 WHEN 'free' THEN 4 ELSE 5 END LIMIT 1`
      ).get(...allW);

      const agent = db.prepare(
        `SELECT id, name, category, endorsement_count, status FROM agents WHERE wallet_address IN (${ph}) AND status = 'active' LIMIT 1`
      ).get(...allW);
      const wallet = resolved;

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

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Find any unregistered and add a nudge
    const unregistered = results.filter(r => !r.registered);

    res.json({
      success: true,
      comparison: results,
      leader: results[0],
      gap: results.length >= 2 ? results[0].score - results[results.length - 1].score : 0,
      unregistered_count: unregistered.length,
      nudge: unregistered.length > 0
        ? `${unregistered.length} agent(s) are not registered. They have 0 trust score and are invisible in the registry. Register free: https://agentstamp.org/register`
        : null,
    });
  } catch (err) {
    console.error('Trust compare error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/trust/network — Network-wide trust stats (FREE)
// Shows social proof: how many agents, endorsements, stamps exist
router.get('/network', (req, res) => {
  try {
    const db = getDb();

    const agents = db.prepare("SELECT COUNT(*) as count FROM agents WHERE status = 'active'").get();
    const stamps = db.prepare("SELECT COUNT(*) as count FROM stamps WHERE revoked = 0 AND expires_at > datetime('now')").get();
    const endorsements = db.prepare('SELECT COUNT(*) as count FROM endorsements').get();
    const wishes = db.prepare('SELECT COUNT(*) as count FROM wishes').get();
    const wishesGranted = db.prepare('SELECT COUNT(*) as count FROM wishes WHERE granted = 1').get();
    const heartbeats = db.prepare('SELECT COUNT(*) as count FROM heartbeat_log').get();

    // Activity in last 24h
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const stampsToday = db.prepare("SELECT COUNT(*) as count FROM stamps WHERE created_at >= ?").get(yesterday);
    const agentsToday = db.prepare("SELECT COUNT(*) as count FROM agents WHERE created_at >= ?").get(yesterday);
    const endorsementsToday = db.prepare("SELECT COUNT(*) as count FROM endorsements WHERE created_at >= ?").get(yesterday);

    // Top categories
    const topCategories = db.prepare(
      "SELECT category, COUNT(*) as count FROM agents WHERE status = 'active' AND category IS NOT NULL GROUP BY category ORDER BY count DESC LIMIT 5"
    ).all();

    // Reputation distribution
    const allAgents = db.prepare('SELECT id FROM agents').all();
    let repSum = 0;
    let repCount = 0;
    allAgents.forEach(a => {
      const rep = computeReputation(a.id);
      if (rep) { repSum += rep.score; repCount++; }
    });

    res.json({
      success: true,
      network: {
        active_agents: agents.count,
        active_stamps: stamps.count,
        total_endorsements: endorsements.count,
        total_wishes: wishes.count,
        wishes_granted: wishesGranted.count,
        heartbeats: heartbeats.count,
        average_reputation: repCount > 0 ? Math.round(repSum / repCount) : 0,
      },
      last_24h: {
        new_stamps: stampsToday.count,
        new_agents: agentsToday.count,
        new_endorsements: endorsementsToday.count,
      },
      top_categories: topCategories,
      message: `${agents.count} agents trust AgentStamp. Join them.`,
      register_url: 'https://agentstamp.org/register',
    });
  } catch (err) {
    console.error('Trust network error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/trust/pulse — Live network activity feed (FREE)
// Shows recent actions as social proof — stamps minted, agents registered, endorsements given
router.get('/pulse', (req, res) => {
  try {
    const db = getDb();
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    // Recent stamps
    const recentStamps = db.prepare(
      `SELECT id, wallet_address, tier, created_at, 'stamp_minted' as event_type
       FROM stamps WHERE revoked = 0
       ORDER BY created_at DESC LIMIT ?`
    ).all(limit);

    // Recent agent registrations
    const recentAgents = db.prepare(
      `SELECT id, name, category, wallet_address, created_at, 'agent_registered' as event_type
       FROM agents WHERE status = 'active'
       ORDER BY created_at DESC LIMIT ?`
    ).all(limit);

    // Recent endorsements
    const recentEndorsements = db.prepare(
      `SELECT e.id, e.endorser_wallet, e.agent_id, a.name as agent_name, e.created_at, 'endorsement_given' as event_type
       FROM endorsements e
       LEFT JOIN agents a ON e.agent_id = a.id
       ORDER BY e.created_at DESC LIMIT ?`
    ).all(limit);

    // Recent wishes
    const recentWishes = db.prepare(
      `SELECT id, wish_text, category, created_at, 'wish_created' as event_type
       FROM wishes
       ORDER BY created_at DESC LIMIT ?`
    ).all(limit);

    // Merge and sort by time
    const allEvents = [
      ...recentStamps.map(s => ({
        type: s.event_type,
        summary: `${s.wallet_address.slice(0, 6)}...${s.wallet_address.slice(-4)} minted a ${s.tier} stamp`,
        tier: s.tier,
        timestamp: s.created_at,
      })),
      ...recentAgents.map(a => ({
        type: a.event_type,
        summary: `${a.name} joined the registry`,
        category: a.category,
        agent_id: a.id,
        timestamp: a.created_at,
      })),
      ...recentEndorsements.map(e => ({
        type: e.event_type,
        summary: `${e.endorser_wallet.slice(0, 6)}...${e.endorser_wallet.slice(-4)} endorsed ${e.agent_name || e.agent_id}`,
        agent_id: e.agent_id,
        timestamp: e.created_at,
      })),
      ...recentWishes.map(w => ({
        type: w.event_type,
        summary: `New wish: "${w.wish_text.length > 60 ? w.wish_text.slice(0, 60) + '...' : w.wish_text}"`,
        category: w.category,
        timestamp: w.created_at,
      })),
    ];

    allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const feed = allEvents.slice(0, limit);

    // Quick stats
    const now = new Date();
    const hour = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const day = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const lastHour = {
      stamps: db.prepare("SELECT COUNT(*) as c FROM stamps WHERE created_at >= ?").get(hour).c,
      registrations: db.prepare("SELECT COUNT(*) as c FROM agents WHERE created_at >= ?").get(hour).c,
      endorsements: db.prepare("SELECT COUNT(*) as c FROM endorsements WHERE created_at >= ?").get(hour).c,
    };

    const lastDay = {
      stamps: db.prepare("SELECT COUNT(*) as c FROM stamps WHERE created_at >= ?").get(day).c,
      registrations: db.prepare("SELECT COUNT(*) as c FROM agents WHERE created_at >= ?").get(day).c,
      endorsements: db.prepare("SELECT COUNT(*) as c FROM endorsements WHERE created_at >= ?").get(day).c,
    };

    res.json({
      success: true,
      pulse: feed,
      velocity: { last_hour: lastHour, last_24h: lastDay },
      message: feed.length > 0
        ? `${feed.length} events happening on AgentStamp. Don't get left behind.`
        : 'The network is growing. Be one of the first to join.',
      register_url: 'https://agentstamp.org/register',
    });
  } catch (err) {
    console.error('Trust pulse error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
