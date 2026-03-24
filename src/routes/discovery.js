const express = require('express');
const router = express.Router();
const dns = require('dns');
const { getDb } = require('../database');
const { validateWalletAddress } = require('../utils/validators');

/**
 * DNS-based agent discovery.
 *
 * Agents add a TXT record to their domain:
 *   _agentstamp.example.com TXT "v=as1; wallet=0x...; stamp=gold"
 *
 * This endpoint verifies the TXT record and cross-checks with the registry.
 */

// GET /api/v1/discovery/dns/:domain — Verify a domain's AgentStamp TXT record
router.get('/dns/:domain', async (req, res) => {
  try {
    const domain = req.params.domain.toLowerCase().replace(/[^a-z0-9.\-]/g, '');
    if (!domain || domain.length > 253) {
      return res.status(400).json({ success: false, error: 'Invalid domain' });
    }

    const txtHost = `_agentstamp.${domain}`;

    let records;
    try {
      records = await new Promise((resolve, reject) => {
        dns.resolveTxt(txtHost, (err, recs) => {
          if (err) reject(err);
          else resolve(recs);
        });
      });
    } catch (dnsErr) {
      return res.json({
        success: true,
        found: false,
        domain,
        txt_host: txtHost,
        message: `No _agentstamp TXT record found for ${domain}`,
        setup_guide: {
          record_type: 'TXT',
          host: txtHost,
          value: 'v=as1; wallet=YOUR_WALLET; stamp=TIER',
          example: 'v=as1; wallet=0x8c9e0882b4c6e6568fe76F16D59F7E080465E5C8; stamp=gold',
        },
      });
    }

    // Parse TXT records (may be multiple strings concatenated)
    const flatRecords = records.map(r => r.join('')).filter(r => r.startsWith('v=as1'));
    if (flatRecords.length === 0) {
      return res.json({
        success: true,
        found: false,
        domain,
        txt_host: txtHost,
        message: 'TXT record exists but does not contain AgentStamp data (must start with v=as1)',
      });
    }

    // Parse the first valid record
    const txtData = flatRecords[0];
    const fields = Object.fromEntries(
      txtData.split(';').map(s => s.trim().split('=', 2)).filter(([k]) => k)
    );

    const walletAddress = fields.wallet;
    if (!walletAddress) {
      return res.json({
        success: true,
        found: true,
        valid: false,
        domain,
        error: 'TXT record missing wallet field',
      });
    }

    // Validate wallet format from untrusted DNS source
    const walletCheck = validateWalletAddress(walletAddress);
    if (!walletCheck.valid) {
      return res.json({
        success: true,
        found: true,
        valid: false,
        domain,
        error: 'TXT record contains invalid wallet address format',
      });
    }

    // Cross-check with registry
    const db = getDb();
    const agent = db.prepare(
      "SELECT id, name, category, status FROM agents WHERE wallet_address = ? AND status = 'active' LIMIT 1"
    ).get(walletAddress);

    const stamp = db.prepare(
      "SELECT tier, expires_at FROM stamps WHERE wallet_address = ? AND revoked = 0 AND expires_at > datetime('now') ORDER BY CASE tier WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 WHEN 'bronze' THEN 3 ELSE 4 END LIMIT 1"
    ).get(walletAddress);

    res.json({
      success: true,
      found: true,
      valid: !!agent,
      domain,
      txt_host: txtHost,
      dns_record: {
        version: fields.v,
        wallet: walletAddress,
        claimed_stamp: fields.stamp || null,
      },
      registry_check: agent ? {
        agent_id: agent.id,
        name: agent.name,
        category: agent.category,
        status: agent.status,
        actual_stamp: stamp?.tier || 'none',
        stamp_match: (fields.stamp || 'none') === (stamp?.tier || 'none'),
      } : {
        registered: false,
        message: 'Wallet not found in AgentStamp registry',
      },
      trust_check_url: `https://agentstamp.org/api/v1/trust/check/${walletAddress}`,
    });
  } catch (err) {
    console.error('DNS discovery error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/discovery/txt-record/:walletAddress — Generate TXT record for a wallet
router.get('/txt-record/:walletAddress', (req, res) => {
  try {
    const walletCheck = validateWalletAddress(req.params.walletAddress);
    if (!walletCheck.valid) {
      return res.status(400).json({ success: false, error: 'Invalid wallet address' });
    }

    const db = getDb();
    const stamp = db.prepare(
      "SELECT tier FROM stamps WHERE wallet_address = ? AND revoked = 0 AND expires_at > datetime('now') ORDER BY CASE tier WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 WHEN 'bronze' THEN 3 ELSE 4 END LIMIT 1"
    ).get(req.params.walletAddress);

    const tier = stamp?.tier || 'none';

    res.json({
      success: true,
      wallet_address: req.params.walletAddress,
      txt_record: {
        type: 'TXT',
        host: '_agentstamp.yourdomain.com',
        value: `v=as1; wallet=${req.params.walletAddress}; stamp=${tier}`,
      },
      instructions: [
        '1. Go to your DNS provider (Cloudflare, Route53, etc.)',
        '2. Add a TXT record with the host and value above',
        '3. Replace "yourdomain.com" with your actual domain',
        `4. Verify: GET https://agentstamp.org/api/v1/discovery/dns/yourdomain.com`,
      ],
    });
  } catch (err) {
    console.error('TXT record generation error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
