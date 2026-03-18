const express = require('express');
const router = express.Router();
const { getDb, resolvePrimaryWallet, getAllLinkedWallets } = require('../database');
const { validateWalletAddress } = require('../utils/validators');

const MAX_LINKS_PER_PRIMARY = 10;

// POST /api/v1/wallet/link — Link a secondary wallet to the caller's primary
router.post('/link', (req, res) => {
  try {
    const primaryWallet = req.headers['x-wallet-address'] || req.body.wallet_address;
    const linkedWallet = req.body.linked_wallet;
    const chainHint = req.body.chain_hint || null;

    if (!linkedWallet) {
      return res.status(400).json({ success: false, error: 'linked_wallet is required in the request body' });
    }

    // Validate linked wallet format
    const validation = validateWalletAddress(linkedWallet);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: `linked_wallet: ${validation.error}` });
    }

    // No self-links
    if (primaryWallet.toLowerCase() === linkedWallet.toLowerCase()) {
      return res.status(400).json({ success: false, error: 'Cannot link a wallet to itself' });
    }

    // Validate chain_hint if provided
    const VALID_CHAINS = ['evm', 'ethereum', 'base', 'polygon', 'solana', 'arbitrum', 'optimism', null];
    if (chainHint && !VALID_CHAINS.includes(chainHint)) {
      return res.status(400).json({
        success: false,
        error: `chain_hint must be one of: ${VALID_CHAINS.filter(Boolean).join(', ')}`,
      });
    }

    const db = getDb();

    // Prevent chaining: primary must not itself be a linked (secondary) wallet
    const primaryIsSecondary = db.prepare(
      'SELECT primary_wallet FROM wallet_links WHERE linked_wallet = ?'
    ).get(primaryWallet);
    if (primaryIsSecondary) {
      return res.status(400).json({
        success: false,
        error: 'This wallet is already linked as a secondary wallet. Only primary wallets can link other wallets.',
      });
    }

    // Prevent chaining: linked wallet must not already be a primary for other links
    const linkedIsPrimary = db.prepare(
      'SELECT COUNT(*) as count FROM wallet_links WHERE primary_wallet = ?'
    ).get(linkedWallet);
    if (linkedIsPrimary && linkedIsPrimary.count > 0) {
      return res.status(400).json({
        success: false,
        error: 'That wallet is already a primary wallet with its own linked wallets. Unlink those first.',
      });
    }

    // Check max links per primary
    const existingCount = db.prepare(
      'SELECT COUNT(*) as count FROM wallet_links WHERE primary_wallet = ?'
    ).get(primaryWallet);
    if (existingCount.count >= MAX_LINKS_PER_PRIMARY) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${MAX_LINKS_PER_PRIMARY} linked wallets per primary wallet`,
      });
    }

    // Check if already linked to someone else
    const existingLink = db.prepare(
      'SELECT primary_wallet FROM wallet_links WHERE linked_wallet = ?'
    ).get(linkedWallet);
    if (existingLink) {
      if (existingLink.primary_wallet === primaryWallet) {
        return res.status(409).json({ success: false, error: 'This wallet is already linked to your identity' });
      }
      return res.status(409).json({ success: false, error: 'This wallet is already linked to another identity' });
    }

    // Insert link
    db.prepare(
      'INSERT INTO wallet_links (primary_wallet, linked_wallet, chain_hint, linked_at) VALUES (?, ?, ?, ?)'
    ).run(primaryWallet, linkedWallet, chainHint, new Date().toISOString());

    const walletInfo = getAllLinkedWallets(primaryWallet);

    try { require('../webhookDispatcher').dispatch(primaryWallet, 'wallet_linked', { linked_wallet: linkedWallet, chain_hint: chainHint }); } catch (e) { /* best-effort */ }

    res.status(201).json({
      success: true,
      message: `Wallet ${linkedWallet} linked to ${primaryWallet}`,
      wallets: {
        primary: walletInfo.primary,
        linked: walletInfo.linked.map(l => ({
          address: l.linked_wallet,
          chain: l.chain_hint,
          linked_at: l.linked_at,
        })),
      },
    });
  } catch (err) {
    console.error('Wallet link error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/wallet/unlink — Remove a linked wallet
router.post('/unlink', (req, res) => {
  try {
    const callerWallet = req.headers['x-wallet-address'] || req.body.wallet_address;
    const linkedWallet = req.body.linked_wallet;

    if (!linkedWallet) {
      return res.status(400).json({ success: false, error: 'linked_wallet is required in the request body' });
    }

    const db = getDb();

    // Resolve caller to primary
    const resolvedCaller = resolvePrimaryWallet(callerWallet);

    // Verify the link exists and belongs to the caller
    const link = db.prepare(
      'SELECT primary_wallet FROM wallet_links WHERE linked_wallet = ?'
    ).get(linkedWallet);

    if (!link) {
      return res.status(404).json({ success: false, error: 'No link found for this wallet' });
    }

    if (link.primary_wallet !== resolvedCaller) {
      return res.status(403).json({ success: false, error: 'Only the primary wallet owner can unlink wallets' });
    }

    db.prepare('DELETE FROM wallet_links WHERE linked_wallet = ?').run(linkedWallet);

    const walletInfo = getAllLinkedWallets(resolvedCaller);

    try { require('../webhookDispatcher').dispatch(resolvedCaller, 'wallet_unlinked', { unlinked_wallet: linkedWallet }); } catch (e) { /* best-effort */ }

    res.json({
      success: true,
      message: `Wallet ${linkedWallet} unlinked`,
      wallets: {
        primary: walletInfo.primary,
        linked: walletInfo.linked.map(l => ({
          address: l.linked_wallet,
          chain: l.chain_hint,
          linked_at: l.linked_at,
        })),
      },
    });
  } catch (err) {
    console.error('Wallet unlink error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/wallet/links/:wallet — Public: view all linked wallets for an identity
router.get('/links/:wallet', (req, res) => {
  try {
    const walletInfo = getAllLinkedWallets(req.params.wallet);

    res.json({
      success: true,
      primary: walletInfo.primary,
      linked: walletInfo.linked.map(l => ({
        address: l.linked_wallet,
        chain: l.chain_hint,
        linked_at: l.linked_at,
      })),
      total: walletInfo.linked.length,
    });
  } catch (err) {
    console.error('Wallet links error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
