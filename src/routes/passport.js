const express = require('express');
const router = express.Router();
const { generatePassport, generateA2ACard } = require('../passport');
const { validateWalletAddress } = require('../utils/validators');

// GET /api/v1/passport/:walletAddress — Full signed passport
router.get('/:walletAddress', (req, res) => {
  try {
    const walletCheck = validateWalletAddress(req.params.walletAddress);
    if (!walletCheck.valid) {
      return res.status(400).json({ success: false, error: 'Invalid wallet address format' });
    }

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
    const walletCheck = validateWalletAddress(req.params.walletAddress);
    if (!walletCheck.valid) {
      return res.status(400).json({ success: false, error: 'Invalid wallet address format' });
    }

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

// GET /api/v1/passport/:walletAddress/vc — W3C Verifiable Credential format
router.get('/:walletAddress/vc', (req, res) => {
  try {
    const walletCheck = validateWalletAddress(req.params.walletAddress);
    if (!walletCheck.valid) {
      return res.status(400).json({ success: false, error: 'Invalid wallet address format' });
    }

    const passport = generatePassport(req.params.walletAddress);
    if (!passport) {
      return res.status(404).json({
        success: false,
        error: 'No active agent found for this wallet address.',
      });
    }

    // Transform AgentStamp passport into W3C Verifiable Credential format
    // https://www.w3.org/TR/vc-data-model-2.0/
    const now = new Date().toISOString();
    const agent = passport.agent;
    const reputation = passport.reputation;
    const stamp = passport.stamp;
    const accountability = passport.accountability;

    const vc = {
      '@context': [
        'https://www.w3.org/ns/credentials/v2',
        'https://agentstamp.org/ns/credentials/v1',
      ],
      type: ['VerifiableCredential', 'AgentTrustCredential'],
      issuer: {
        id: 'did:web:agentstamp.org',
        name: 'AgentStamp',
      },
      validFrom: now,
      validUntil: agent.expires_at,
      credentialSubject: {
        id: `did:pkh:eip155:8453:${agent.wallet_address}`,
        type: 'AIAgent',
        name: agent.name,
        description: agent.description,
        category: agent.category,
        trustScore: reputation?.score || 0,
        trustTier: reputation?.label || 'new',
        humanSponsor: accountability?.human_sponsor || null,
        stamp: stamp ? {
          id: stamp.id,
          tier: stamp.tier,
          valid: stamp.valid,
          issuedAt: stamp.issued_at,
          expiresAt: stamp.expires_at,
        } : null,
        capabilities: agent.capabilities,
        protocols: agent.protocols,
        registeredAt: agent.registered_at,
      },
      credentialStatus: {
        id: `https://agentstamp.org/api/v1/trust/check/${agent.wallet_address}`,
        type: 'AgentStampTrustCheck',
      },
      proof: passport.signature ? {
        type: 'Ed25519Signature2020',
        created: now,
        verificationMethod: 'https://agentstamp.org/.well-known/passport-public-key',
        proofValue: passport.signature,
      } : undefined,
    };

    res.json(vc);
  } catch (err) {
    console.error('VC credential error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
