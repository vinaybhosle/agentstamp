const core = require('@actions/core');
const { fetchTrustCheck, resolveAgentId } = require('./api');
const { evaluateThresholds } = require('./evaluate');
const { generateBadgeSvg, writeBadge } = require('./badge');
const { TIER_ORDER } = require('./constants');

const VALID_TIERS = Object.keys(TIER_ORDER);

async function run() {
  try {
    // --- Parse inputs ---
    const walletAddress = core.getInput('wallet-address');
    const agentId = core.getInput('agent-id');
    const erc8004Id = core.getInput('erc8004-id');
    const minTier = core.getInput('min-tier') || 'none';
    const minScore = parseInt(core.getInput('min-score') || '0', 10);
    const minEndorsements = parseInt(core.getInput('min-endorsements') || '0', 10);
    const failOnError = core.getInput('fail-on-error') !== 'false';
    const generateBadge = core.getInput('generate-badge') === 'true';
    const badgePath = core.getInput('badge-path') || '.github/badges/agentstamp.svg';
    const apiBaseUrl = core.getInput('api-base-url') || 'https://agentstamp.org';

    // --- Validate inputs ---
    if (!walletAddress && !agentId && !erc8004Id) {
      core.setFailed(
        'At least one identifier is required: wallet-address, agent-id, or erc8004-id'
      );
      return;
    }

    if (!VALID_TIERS.includes(minTier)) {
      core.setFailed(
        `Invalid min-tier "${minTier}". Must be one of: ${VALID_TIERS.join(', ')}`
      );
      return;
    }

    if (isNaN(minScore) || minScore < 0) {
      core.setFailed('min-score must be a non-negative integer');
      return;
    }

    // --- Resolve identifier ---
    let identifier;
    if (erc8004Id) {
      identifier = `erc8004:${erc8004Id}`;
      core.info(`Looking up ERC-8004 agent #${erc8004Id}`);
    } else if (walletAddress) {
      identifier = walletAddress;
      core.info(`Checking trust for wallet ${walletAddress}`);
    } else {
      core.info(`Resolving agent ID "${agentId}" to wallet address`);
      identifier = await resolveAgentId(agentId, apiBaseUrl);
      core.info(`Resolved to wallet ${identifier}`);
    }

    // --- Call API ---
    core.info(`Fetching trust check from ${apiBaseUrl}`);
    const response = await fetchTrustCheck(identifier, apiBaseUrl);
    core.info(`Trust check complete: score=${response.score}, tier=${response.tier}, trusted=${response.trusted}`);

    // --- Set outputs ---
    core.setOutput('trusted', String(response.trusted));
    core.setOutput('score', String(response.score ?? 0));
    core.setOutput('tier', response.tier || 'none');
    core.setOutput('label', response.label || 'unknown');
    core.setOutput('agent-name', response.agent?.name || '');
    core.setOutput('agent-id', response.agent?.id || '');
    core.setOutput('endorsements', String(response.agent?.endorsements ?? 0));
    core.setOutput('stamp-expires', response.stamp?.expires_at || '');
    core.setOutput('profile-url', response.agent?.profile_url || '');

    // --- Evaluate thresholds ---
    const result = evaluateThresholds(response, {
      minTier,
      minScore,
      minEndorsements,
    });
    core.setOutput('verified', String(result.passed));

    // --- Generate badge ---
    if (generateBadge) {
      const svg = generateBadgeSvg(response);
      const absPath = writeBadge(svg, badgePath);
      core.info(`Badge written to ${absPath}`);
    }

    // --- Write job summary ---
    const agentName = response.agent?.name || 'Unknown Agent';
    const statusEmoji = result.passed ? '✅' : '❌';

    await core.summary
      .addHeading(`${statusEmoji} AgentStamp Trust Check`, 3)
      .addTable([
        [
          { data: 'Property', header: true },
          { data: 'Value', header: true },
        ],
        ['Agent', agentName],
        ['Score', String(response.score ?? 0)],
        ['Tier', response.tier || 'none'],
        ['Label', response.label || 'unknown'],
        ['Trusted', response.trusted ? '✅ Yes' : '❌ No'],
        ['Endorsements', String(response.agent?.endorsements ?? 0)],
        ['Stamp Expires', response.stamp?.expires_at || 'N/A'],
      ])
      .addLink('View on AgentStamp', response.agent?.profile_url || 'https://agentstamp.org')
      .write();

    // --- Handle result ---
    if (!result.passed) {
      const message = `Trust verification failed:\n${result.reasons.map(r => `  - ${r}`).join('\n')}`;
      if (failOnError) {
        core.setFailed(message);
      } else {
        for (const reason of result.reasons) {
          core.warning(reason);
        }
        core.info('Verification failed but fail-on-error is false — continuing workflow');
      }
    } else {
      core.info(`Trust verification passed: ${agentName} (score: ${response.score}, tier: ${response.tier})`);
    }
  } catch (error) {
    const message = `AgentStamp verification error: ${error.message}`;
    const failOnError = core.getInput('fail-on-error') !== 'false';
    if (failOnError) {
      core.setFailed(message);
    } else {
      core.warning(message);
    }
  }
}

run();
