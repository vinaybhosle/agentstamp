const express = require('express');
const router = express.Router();
const { generatePassport, generateA2ACard } = require('../passport');

// GET /api/v1/passport/:walletAddress — Full signed passport
router.get('/:walletAddress', (req, res) => {
  try {
    const passport = generatePassport(req.params.walletAddress);
    if (!passport) {
      return res.status(404).json({
        success: false,
        error: 'No active agent found for this wallet address.',
        trusted: false,
        score: 0,
        reason: 'This wallet has no AgentStamp identity. Without a passport, other agents and services cannot verify your identity or capabilities.',
        action: {
          register_url: 'https://agentstamp.org/register',
          docs_url: 'https://agentstamp.org/docs',
          trust_check_url: `https://agentstamp.org/api/v1/trust/check/${req.params.walletAddress}`,
          message: 'Register for free in 60 seconds. Get a cryptographic identity, join the public registry, and start building reputation.',
        },
      });
    }

    res.json({ success: true, passport });
  } catch (err) {
    console.error('Passport error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/passport/:walletAddress/a2a — A2A Agent Card only
router.get('/:walletAddress/a2a', (req, res) => {
  try {
    const card = generateA2ACard(req.params.walletAddress);
    if (!card) {
      return res.status(404).json({
        success: false,
        error: 'No active agent found for this wallet address.',
        reason: 'Without an AgentStamp registration, this agent has no A2A agent card. Other agents using Google A2A protocol cannot discover or trust it.',
        action: {
          register_url: 'https://agentstamp.org/register',
          message: 'Register free to get an A2A-compatible agent card.',
        },
      });
    }

    // A2A spec returns the card directly (no wrapper)
    res.json(card);
  } catch (err) {
    console.error('A2A card error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
