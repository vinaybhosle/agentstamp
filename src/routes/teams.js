const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../database');
const { requireSignature } = require('../middleware/walletSignature');
const { mutationLimiter, readLimiter } = require('../middleware/rateLimit');
const { computeTeamReputation, TEAM_MAX_MEMBERS } = require('../reputation');
const { appendEvent } = require('../eventLog');

const router = express.Router();

// ─── Create Team (free, signature required) ──────────────────────────────────

router.post('/', mutationLimiter, requireSignature({ required: true }), (req, res) => {
  const { name, description } = req.body;
  const ownerWallet = req.walletAddress;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Team name is required' });
  }
  if (name.trim().length > 100) {
    return res.status(400).json({ success: false, error: 'Team name must be 100 characters or fewer' });
  }
  if (description && typeof description === 'string' && description.length > 500) {
    return res.status(400).json({ success: false, error: 'Description must be 500 characters or fewer' });
  }

  const db = getDb();

  // Owner must be a registered active agent
  const ownerAgent = db.prepare(
    "SELECT id FROM agents WHERE wallet_address = ? AND status = 'active' ORDER BY registered_at ASC LIMIT 1"
  ).get(ownerWallet);
  if (!ownerAgent) {
    return res.status(403).json({ success: false, error: 'Team owner must be a registered active agent' });
  }

  // Max 5 teams per wallet
  const teamCount = db.prepare(
    "SELECT COUNT(*) as cnt FROM teams WHERE owner_wallet = ? AND status = 'active'"
  ).get(ownerWallet);
  if (teamCount.cnt >= 5) {
    return res.status(429).json({ success: false, error: 'Maximum 5 active teams per wallet' });
  }

  const teamId = `team_${crypto.randomBytes(8).toString('hex')}`;
  const now = new Date().toISOString();

  const createTeam = db.transaction(() => {
    db.prepare(
      'INSERT INTO teams (id, name, description, owner_wallet, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(teamId, name.trim(), description?.trim() || null, ownerWallet, 'active', now, now);

    // Auto-add owner as first member with 'owner' role
    const memberId = `tm_${crypto.randomBytes(8).toString('hex')}`;
    db.prepare(
      'INSERT INTO team_members (id, team_id, agent_id, role, added_at) VALUES (?, ?, ?, ?, ?)'
    ).run(memberId, teamId, ownerAgent.id, 'owner', now);
  });

  createTeam();

  appendEvent('team_created', {
    wallet_address: ownerWallet,
    agent_id: ownerAgent.id,
    team_id: teamId,
    name: name.trim(),
  });

  res.status(201).json({
    success: true,
    team: { id: teamId, name: name.trim(), description: description?.trim() || null, owner_wallet: ownerWallet, created_at: now },
  });
});

// ─── Add Member (owner signature required) ────────────────────────────────────

router.post('/:teamId/members', mutationLimiter, requireSignature({ required: true }), (req, res) => {
  const { teamId } = req.params;
  const { agent_id } = req.body;
  const callerWallet = req.walletAddress;

  if (!agent_id || typeof agent_id !== 'string') {
    return res.status(400).json({ success: false, error: 'agent_id is required' });
  }

  const db = getDb();

  const team = db.prepare("SELECT * FROM teams WHERE id = ? AND status = 'active'").get(teamId);
  if (!team) {
    return res.status(404).json({ success: false, error: 'Team not found' });
  }
  if (team.owner_wallet !== callerWallet) {
    return res.status(403).json({ success: false, error: 'Only the team owner can add members' });
  }

  // Verify agent exists and is active
  const agent = db.prepare("SELECT id, wallet_address FROM agents WHERE id = ? AND status = 'active'").get(agent_id);
  if (!agent) {
    return res.status(404).json({ success: false, error: 'Agent not found or not active' });
  }

  // Check member count
  const memberCount = db.prepare('SELECT COUNT(*) as cnt FROM team_members WHERE team_id = ?').get(teamId);
  if (memberCount.cnt >= TEAM_MAX_MEMBERS) {
    return res.status(429).json({ success: false, error: `Maximum ${TEAM_MAX_MEMBERS} members per team` });
  }

  // Check duplicate
  const existing = db.prepare('SELECT id FROM team_members WHERE team_id = ? AND agent_id = ?').get(teamId, agent_id);
  if (existing) {
    return res.status(409).json({ success: false, error: 'Agent is already a member of this team' });
  }

  const memberId = `tm_${crypto.randomBytes(8).toString('hex')}`;
  const now = new Date().toISOString();

  const addMember = db.transaction(() => {
    db.prepare('INSERT INTO team_members (id, team_id, agent_id, role, added_at) VALUES (?, ?, ?, ?, ?)').run(
      memberId, teamId, agent_id, 'member', now
    );
    db.prepare('UPDATE teams SET updated_at = ? WHERE id = ?').run(now, teamId);
  });
  addMember();

  appendEvent('team_member_added', {
    wallet_address: callerWallet,
    agent_id: agent_id,
    team_id: teamId,
  });

  res.json({ success: true, member: { id: memberId, team_id: teamId, agent_id, role: 'member', added_at: now } });
});

// ─── Remove Member (owner signature required) ────────────────────────────────

router.delete('/:teamId/members/:agentId', mutationLimiter, requireSignature({ required: true }), (req, res) => {
  const { teamId, agentId } = req.params;
  const callerWallet = req.walletAddress;

  const db = getDb();

  const team = db.prepare("SELECT * FROM teams WHERE id = ? AND status = 'active'").get(teamId);
  if (!team) {
    return res.status(404).json({ success: false, error: 'Team not found' });
  }
  if (team.owner_wallet !== callerWallet) {
    return res.status(403).json({ success: false, error: 'Only the team owner can remove members' });
  }

  // Cannot remove the owner
  const member = db.prepare('SELECT * FROM team_members WHERE team_id = ? AND agent_id = ?').get(teamId, agentId);
  if (!member) {
    return res.status(404).json({ success: false, error: 'Member not found in this team' });
  }
  if (member.role === 'owner') {
    return res.status(400).json({ success: false, error: 'Cannot remove the team owner. Delete the team instead.' });
  }

  db.prepare('DELETE FROM team_members WHERE team_id = ? AND agent_id = ?').run(teamId, agentId);
  db.prepare('UPDATE teams SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), teamId);

  appendEvent('team_member_removed', {
    wallet_address: callerWallet,
    agent_id: agentId,
    team_id: teamId,
  });

  res.json({ success: true, removed: agentId });
});

// ─── Get Team with Trust Score (free) ─────────────────────────────────────────

router.get('/:teamId', readLimiter, (req, res) => {
  const { teamId } = req.params;
  const db = getDb();

  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
  if (!team) {
    return res.status(404).json({ success: false, error: 'Team not found' });
  }

  const reputation = computeTeamReputation(teamId);

  res.json({
    success: true,
    team: {
      id: team.id,
      name: team.name,
      description: team.description,
      owner_wallet: team.owner_wallet,
      status: team.status,
      created_at: team.created_at,
      updated_at: team.updated_at,
    },
    trust: reputation,
  });
});

// ─── Team Trust Check (free — viral hook) ─────────────────────────────────────

router.get('/:teamId/trust', readLimiter, (req, res) => {
  const { teamId } = req.params;
  const db = getDb();

  const team = db.prepare("SELECT id, name, status FROM teams WHERE id = ?").get(teamId);
  if (!team) {
    return res.status(404).json({ success: false, error: 'Team not found' });
  }

  const reputation = computeTeamReputation(teamId);

  res.json({
    trusted: reputation.score >= 10 && reputation.member_count >= 2,
    team_id: team.id,
    team_name: team.name,
    score: reputation.score,
    label: reputation.label,
    member_count: reputation.member_count,
    weakest_link_applied: reputation.weakest_link_applied,
    weakest_member: reputation.weakest_member,
    coverage_bonus: reputation.coverage_bonus,
    mean_score: reputation.mean_score,
  });
});

// ─── List Teams for a Wallet (free) ───────────────────────────────────────────

router.get('/', readLimiter, (req, res) => {
  const { wallet } = req.query;
  if (!wallet || typeof wallet !== 'string' || wallet.trim().length < 10 || wallet.trim().length > 100) {
    return res.status(400).json({ success: false, error: 'Valid wallet address is required' });
  }

  const db = getDb();
  const sanitizedWallet = wallet.trim();

  // Teams owned by this wallet — project specific columns
  const owned = db.prepare(
    "SELECT id, name, description, owner_wallet, status, created_at, updated_at FROM teams WHERE owner_wallet = ? AND status = 'active'"
  ).all(sanitizedWallet);

  // Teams this wallet's agent is a member of
  const memberOf = db.prepare(`
    SELECT t.id, t.name, t.description, t.owner_wallet, t.status, t.created_at, t.updated_at
    FROM teams t
    JOIN team_members tm ON tm.team_id = t.id
    JOIN agents a ON a.id = tm.agent_id
    WHERE a.wallet_address = ? AND t.status = 'active' AND tm.role != 'owner'
  `).all(sanitizedWallet);

  res.json({ success: true, owned, member_of: memberOf });
});

module.exports = router;
