import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Key Rotation and Revocation for AI Agents: The Lifecycle Nobody Manages",
  description: "NHIs outnumber humans 144:1 and 78% of orgs lack formal agent decommissioning policies. The agent credential lifecycle gap is a breach waiting to happen.",
  alternates: { canonical: "https://agentstamp.org/blog/agent-key-rotation-revocation" },
  openGraph: {
    title: "Key Rotation and Revocation for AI Agents: The Lifecycle Nobody Manages",
    description: "144:1 NHI ratio, 78% lack decommissioning policies. The agent key lifecycle nobody manages.",
    url: "https://agentstamp.org/blog/agent-key-rotation-revocation",
    type: "article",
    publishedTime: "2026-03-25",
  },
  keywords: ["AI agent key rotation", "agent credential lifecycle", "cryptographic key management AI", "non-human identity management", "NHI security", "agent decommissioning"],
};

export default function Article() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 prose prose-invert prose-lg">
      <Link href="/blog" className="text-sm text-[#818cf8] no-underline hover:underline mb-4 block">&larr; Back to Blog</Link>
      <time className="text-sm text-[#71717a]">March 25, 2026</time>
      <h1 className="text-3xl font-bold text-[#e8e8ed] mt-2">Key Rotation and Revocation for AI Agents: The Lifecycle Nobody Manages</h1>

      <p className="text-[#d4d4d8]">Every security team knows that credentials need rotation. Passwords expire. Certificates renew. API keys get cycled. But when it comes to AI agent credentials, the industry has collectively decided to skip this step. The result is a credential management crisis that grows worse every quarter as agent deployments accelerate.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">The Numbers Paint a Clear Picture</h2>
      <p className="text-[#d4d4d8]">Non-human identities grew 44% in the past year and now outnumber human identities at a ratio of 144 to 1, according to Entro Security&apos;s 2025 research. Only 12% of organizations report high confidence in their ability to prevent NHI-based attacks, per the Cloud Security Alliance. And 78% lack formal policies for creating and decommissioning agent identities.</p>
      <p className="text-[#d4d4d8]">Meanwhile, enterprise AI agents grew 466.7% year-over-year (BeyondTrust and Phantom Labs, March 2026). Each of those agents carries credentials: API keys, OAuth tokens, wallet keys, service account passwords. The math is straightforward. Exponential growth in agents multiplied by near-zero credential lifecycle management equals an expanding attack surface that nobody is shrinking.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">What the Lifecycle Should Look Like</h2>
      <p className="text-[#d4d4d8]">A proper agent credential lifecycle has five stages:</p>
      <pre className="bg-[#1a1a2e] rounded-lg p-4 overflow-x-auto text-sm">
{`PROVISION  -> Agent created, credentials issued with defined scope
CERTIFY    -> Credentials verified against trust registry, tier assigned
ROTATE     -> Credentials cycled on schedule or on trigger event
MONITOR    -> Continuous observation of credential usage patterns
DECOMMISSION -> Agent retired, all credentials revoked, access removed`}
      </pre>
      <p className="text-[#d4d4d8]">What actually happens in most organizations:</p>
      <pre className="bg-[#1a1a2e] rounded-lg p-4 overflow-x-auto text-sm">
{`CREATE -> FORGET -> BREACH`}
      </pre>
      <p className="text-[#d4d4d8]">The gap between these two workflows is not a tooling problem. The tools exist. It is an awareness and process problem. Teams that would never deploy a human user account without an offboarding plan routinely deploy agent credentials with no rotation schedule, no revocation procedure, and no decommissioning plan.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">The Cost of Getting It Wrong</h2>
      <p className="text-[#d4d4d8]">Shadow AI breaches, where unauthorized or unmanaged agents are compromised, cost an average of $4.63 million per incident. That is $670,000 more than a standard data breach. The premium exists because shadow AI breaches are harder to detect, harder to contain, and harder to attribute. When no one knows the agent exists, no one notices when its credentials are stolen.</p>
      <p className="text-[#d4d4d8]">GitGuardian&apos;s 2025 report found 28.65 million secrets leaked on GitHub that year. Of the secrets that were valid at the time of detection, 64% of those originally leaked in 2022 were still not revoked three years later. Secrets from 2020 had a 58% still-valid rate. These are not agent-specific numbers, but they illustrate the industry&apos;s fundamental inability to revoke credentials even when they are known to be compromised.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">Real-World Cascading Failures</h2>
      <p className="text-[#d4d4d8]">The Drift/Salesforce incident demonstrated how unmanaged agent credentials cascade. A single compromised OAuth token chain propagated across 700+ organizations because the tokens were never scoped to individual agent instances and there was no mechanism to revoke one agent&apos;s access without affecting every other agent using the same credential chain.</p>
      <p className="text-[#d4d4d8]">The Clawdbot incident exposed over 1,000 agents through leaked credentials that were never rotated after initial deployment. The agents had accumulated permissions over months of operation, far exceeding their original scope, but no audit process existed to detect the privilege creep.</p>
      <p className="text-[#d4d4d8]">Both incidents share the same root cause: credentials were issued at deployment time and never touched again. No rotation. No scope review. No decommissioning plan.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">Why Agent Credentials Are Harder Than Human Credentials</h2>
      <p className="text-[#d4d4d8]">Human credential management benefits from natural lifecycle events. Employees have start dates, role changes, and termination dates. Each event triggers a credential review. Agents have none of these natural checkpoints.</p>
      <p className="text-[#d4d4d8]">An agent might be deployed once and run continuously for months without anyone reviewing its access. It might be cloned across multiple environments, each clone inheriting the original&apos;s credentials. It might be decommissioned by deleting its container, leaving its credentials active in every external service it authenticated with.</p>
      <p className="text-[#d4d4d8]">Agents also accumulate credentials faster than humans. A human employee might have credentials for 20-50 services. An agent orchestrating a complex workflow might authenticate with dozens of APIs, databases, and third-party services in a single execution. Each credential is a potential vector if the agent is compromised.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">Building the Rotation and Revocation Layer</h2>
      <p className="text-[#d4d4d8]">Effective agent credential lifecycle management requires four capabilities:</p>
      <p className="text-[#d4d4d8]"><strong className="text-[#e8e8ed]">Automated rotation</strong> on a defined schedule and on trigger events (version update, security incident, scope change). Rotation must be seamless, issuing new credentials before revoking old ones to prevent service interruption.</p>
      <p className="text-[#d4d4d8]"><strong className="text-[#e8e8ed]">Instant revocation</strong> that propagates to every service the agent has authenticated with. When an agent&apos;s credentials are revoked, every downstream service should reject the agent&apos;s next request within seconds, not hours or days.</p>
      <p className="text-[#d4d4d8]"><strong className="text-[#e8e8ed]">Webhook-driven notifications</strong> so that dependent systems learn about revocations in real time. Polling-based revocation checking introduces a window where revoked credentials are still accepted.</p>
      <p className="text-[#d4d4d8]"><strong className="text-[#e8e8ed]">Task-scoped credentials</strong> that limit an agent&apos;s access to exactly what it needs for a specific task, and expire when the task completes. Instead of issuing an agent a long-lived token with broad access, issue a short-lived token scoped to the specific APIs and data the agent needs for its current operation.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">Implementation in Practice</h2>
      <p className="text-[#d4d4d8]">AgentStamp&apos;s approach to agent credential lifecycle addresses each of these requirements. Registered agents receive wallet-based identity with built-in rotation support. The trust score decays without activity, creating a natural forcing function for credential renewal. Revocation endpoints allow instant credential invalidation, and webhook subscriptions ensure every dependent service is notified in real time.</p>
      <pre className="bg-[#1a1a2e] rounded-lg p-4 overflow-x-auto text-sm">
{`# Revoke an agent's credentials instantly
POST /api/v1/admin/revoke
{
  "wallet": "0x1234...abcd",
  "reason": "security_incident",
  "propagate": true
}

# Subscribe to revocation events
POST /api/v1/webhooks
{
  "url": "https://your-service.com/hooks/revocation",
  "events": ["stamp.revoked", "trust.decayed", "key.rotated"]
}`}
      </pre>
      <p className="text-[#d4d4d8]">The trust score decay mechanism is particularly important. An agent that stops heartbeating sees its trust score decline on a defined schedule. Services that gate access on trust thresholds will naturally reject agents whose operators have abandoned them, solving the decommissioning problem without requiring an explicit decommission action that someone inevitably forgets to perform.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">Start Managing What You Deploy</h2>
      <p className="text-[#d4d4d8]">The 144:1 ratio of non-human to human identities is not going to shrink. The 466.7% growth in enterprise agents is not going to slow down. And the 78% of organizations without formal agent identity policies are not going to become more secure by accident.</p>
      <p className="text-[#d4d4d8]">Every agent you deploy should have a rotation schedule, a revocation plan, and a decommissioning procedure before it processes its first request. The credential lifecycle is not an afterthought. It is the foundation that every other security measure depends on. Without it, your agents are not deployed. They are abandoned in production with the keys still in the ignition.</p>
    </article>
  );
}
