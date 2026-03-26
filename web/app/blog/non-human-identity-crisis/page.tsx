import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "The Non-Human Identity Crisis: Why AI Agents Need Their Own Identity Layer",
  description: "Non-human identities outnumber humans 144:1. With 80% of identity breaches involving NHIs, AI agents need purpose-built identity infrastructure.",
  alternates: { canonical: "https://agentstamp.org/blog/non-human-identity-crisis" },
  openGraph: {
    title: "The Non-Human Identity Crisis: Why AI Agents Need Their Own Identity Layer",
    description: "Non-human identities outnumber humans 144:1. AI agents need purpose-built identity infrastructure.",
    url: "https://agentstamp.org/blog/non-human-identity-crisis",
    type: "article",
    publishedTime: "2026-03-25",
  },
  keywords: ["non-human identity AI agent", "NHI security", "machine identity", "AI agent identity management", "secret leakage", "OWASP NHI"],
};

export default function Article() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 prose prose-invert prose-lg">
      <Link href="/blog" className="text-sm text-[#818cf8] no-underline hover:underline mb-4 block">&larr; Back to Blog</Link>
      <time className="text-sm text-[#71717a]">March 25, 2026</time>
      <h1 className="text-3xl font-bold text-[#e8e8ed] mt-2">The Non-Human Identity Crisis: Why AI Agents Need Their Own Identity Layer</h1>

      <p className="text-[#d4d4d8]">There are now 45 billion non-human identities operating across the world&apos;s digital infrastructure (World Economic Forum, 2025). Service accounts, API keys, OAuth tokens, bot credentials, CI/CD pipelines, and increasingly, autonomous AI agents. For every human identity in a typical enterprise, there are 144 machine identities running alongside it (Entro Security, 2025) &mdash; up from 92:1 just six months earlier.</p>

      <p className="text-[#d4d4d8]">The security industry has spent decades building identity infrastructure for humans: SSO, MFA, RBAC, SCIM provisioning. For non-human identities, the strategy has mostly been &ldquo;create an API key and hope for the best.&rdquo;</p>

      <p className="text-[#d4d4d8]">That hope is failing. Eighty percent of identity-related breaches now involve non-human identities (OWASP NHI Top 10, 2025). The identity crisis isn&apos;t coming. It&apos;s here.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">the scale of the problem</h2>

      <p className="text-[#d4d4d8]">Non-human identities have quietly become the dominant population on every network. They authenticate to databases, call third-party APIs, trigger webhooks, deploy infrastructure, and now &mdash; with agentic AI &mdash; they make decisions, negotiate with other services, and spend money on behalf of their operators.</p>

      <p className="text-[#d4d4d8]">Yet the tooling hasn&apos;t kept pace. A Token Security survey from early 2026 found that 45.6% of organizations still rely on shared API keys as the primary authentication method for their machine identities. Not per-service keys. Not short-lived tokens. Shared secrets, passed between teams in Slack messages and environment variables that haven&apos;t been rotated since the Obama administration.</p>

      <p className="text-[#d4d4d8]">The consequences are predictable. GitGuardian&apos;s 2025 report documented 28.65 million secrets leaked on GitHub in a single year, with an 81% surge in AI service credential leaks specifically. Every one of those secrets is an identity &mdash; a machine credential that grants access to some system, somewhere.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">when NHI breaches make headlines</h2>

      <p className="text-[#d4d4d8]">The pattern repeats across the industry&apos;s most notable incidents. In the Microsoft Midnight Blizzard attack, threat actors compromised an OAuth application to move laterally through Microsoft&apos;s corporate environment. Not a phished employee &mdash; an exploited machine identity. The New York Times GitHub breach exposed 270 gigabytes of source code through a single compromised personal access token. One secret, one identity, catastrophic access.</p>

      <p className="text-[#d4d4d8]">The tj-actions supply chain attack in early 2025 compromised over 23,000 repositories by injecting malicious code into a widely-used CI/CD action. The attack exploited the implicit trust that pipelines place in their dependencies &mdash; non-human identities trusting other non-human identities with no verification layer in between.</p>

      <p className="text-[#d4d4d8]">These aren&apos;t edge cases. They&apos;re the natural consequence of treating machine identities as second-class citizens in the security stack.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">the OWASP NHI top 10</h2>

      <p className="text-[#d4d4d8]">OWASP formalized this problem with their Non-Human Identity Top 10 in 2025, and the ranking tells you everything about the state of machine identity management:</p>

      <p className="text-[#d4d4d8]"><strong className="text-[#e8e8ed]">NHI1: Improper Offboarding.</strong> When an employee leaves, their human accounts get deprovisioned. The 47 service accounts they created? Those live forever. Orphaned machine identities with active credentials are the single biggest NHI risk.</p>

      <p className="text-[#d4d4d8]"><strong className="text-[#e8e8ed]">NHI2: Secret Leakage.</strong> Secrets embedded in code, configs, logs, and CI/CD artifacts. The GitGuardian numbers above make this one self-explanatory.</p>

      <p className="text-[#d4d4d8]"><strong className="text-[#e8e8ed]">NHI3: Vulnerable Third-Party NHI.</strong> Your supply chain is someone else&apos;s machine identities. The tj-actions incident is the canonical example.</p>

      <p className="text-[#d4d4d8]">The remaining entries cover excessive privileges, insecure authentication, overly broad scoping, long-lived credentials, environment isolation failures, NHI reuse across services, and lack of logging. Every single one maps directly to problems that AI agents amplify by an order of magnitude.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">why AI agents make this worse</h2>

      <p className="text-[#d4d4d8]">Traditional NHIs &mdash; service accounts, API keys, CI runners &mdash; are deterministic. They do what they&apos;re programmed to do. An API key for a payment processor processes payments. A CI token deploys code. The blast radius of a compromised credential is bounded by the service&apos;s function.</p>

      <p className="text-[#d4d4d8]">AI agents break this assumption. An autonomous agent with tool access can discover new APIs, chain actions together in unpredicted ways, and make decisions that its operator never explicitly authorized. The identity isn&apos;t just an access credential anymore &mdash; it&apos;s a proxy for judgment and authority.</p>

      <p className="text-[#d4d4d8]">Consider a coding agent with repository access. Its credential might be scoped to a single repo, but if the agent decides to open a pull request that modifies a GitHub Actions workflow, it has effectively escalated its own permissions through the CI/CD pipeline. The identity system saw a write to a repository. The actual impact was arbitrary code execution on every future merge.</p>

      <p className="text-[#d4d4d8]">Only 10% of executives currently have a well-developed NHI strategy (Okta/World Economic Forum, 2025). For autonomous AI agents specifically, that number is effectively zero.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">what a purpose-built agent identity layer looks like</h2>

      <p className="text-[#d4d4d8]">The fundamental problem is that NHI security was designed for static credentials, not autonomous entities. An agent identity layer needs to handle properties that API keys never had to address:</p>

      <p className="text-[#d4d4d8]"><strong className="text-[#e8e8ed]">Cryptographic uniqueness.</strong> Every agent needs its own keypair, not a shared secret. Ed25519 signatures give each agent a provable, non-replayable identity that can&apos;t be shared between services without detection.</p>

      <pre className="bg-[#1a1a2e] rounded-lg p-4 overflow-x-auto text-sm">
        <code className="text-[#d4d4d8]">{`// Each agent gets a unique Ed25519 identity at registration
const stamp = await agentstamp.verify("agent-uuid");
// Returns: { wallet, trust_score, human_sponsor, created_at }

// No shared keys. No static tokens.
// The agent proves identity by signing with its own keypair.`}</code>
      </pre>

      <p className="text-[#d4d4d8]"><strong className="text-[#e8e8ed]">Human accountability.</strong> Every agent identity should link back to a human or organization that takes responsibility for its behavior. AgentStamp&apos;s <code className="text-[#818cf8]">human_sponsor</code> field makes this explicit: an agent that causes harm has an accountable operator, not just an anonymous wallet address.</p>

      <p className="text-[#d4d4d8]"><strong className="text-[#e8e8ed]">Dynamic trust, not static access.</strong> A traditional API key is either valid or revoked. Agent trust needs to be continuous. A trust score that decays without activity and adjusts based on behavior is closer to how humans evaluate trustworthiness &mdash; recent track record matters more than a one-time registration.</p>

      <p className="text-[#d4d4d8]"><strong className="text-[#e8e8ed]">Tamper-evident audit trails.</strong> When agents interact with each other across organizational boundaries, the audit trail can&apos;t live on any single party&apos;s server. Hash-chained logs that reference previous entries make retroactive tampering detectable.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">the offboarding problem, solved differently</h2>

      <p className="text-[#d4d4d8]">OWASP ranked improper offboarding as the number one NHI risk for a reason. Organizations lose track of machine identities constantly. With AI agents, this gets worse &mdash; agents can spin up sub-agents, create new credentials, and establish connections that their operators don&apos;t know about.</p>

      <p className="text-[#d4d4d8]">A registry-based approach inverts the problem. Instead of trying to find and revoke every credential an agent ever created, you revoke the agent&apos;s identity at the registry level. Every service that verifies trust against the registry immediately sees the agent as untrusted. One action, complete offboarding.</p>

      <pre className="bg-[#1a1a2e] rounded-lg p-4 overflow-x-auto text-sm">
        <code className="text-[#d4d4d8]">{`// Before granting access, verify the agent is still active
const { trust_score, status } = await agentstamp.verify(agentId);

if (status === "revoked" || trust_score < 30) {
  return { error: "Agent identity no longer trusted" };
}

// Trust is checked at interaction time, not just at onboarding`}</code>
      </pre>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">where we go from here</h2>

      <p className="text-[#d4d4d8]">The non-human identity crisis is a solvable problem, but it requires accepting that the tools built for human IAM don&apos;t transfer cleanly to autonomous agents. Service accounts, API keys, and OAuth tokens were designed for a world where machines do exactly what they&apos;re told. That world is ending.</p>

      <p className="text-[#d4d4d8]">The next generation of agent identity needs cryptographic uniqueness per agent, human accountability chains, dynamic trust scoring, tamper-evident audit logs, and interoperability across platforms. Standards like ERC-8004 are formalizing how on-chain agent registration works. Platforms are starting to build the practical infrastructure.</p>

      <p className="text-[#d4d4d8]">Forty-five billion non-human identities are waiting for an identity layer that was actually designed for them. The organizations that build this into their agent infrastructure now &mdash; before a breach forces their hand &mdash; will be the ones still operating confidently when the NHI-to-human ratio hits 300:1.</p>

      <div className="mt-12 pt-6 border-t border-[#27272a]">
        <p className="text-sm text-[#71717a]">
          <Link href="/register" className="text-[#818cf8]">Register your agent</Link> | <Link href="/docs" className="text-[#818cf8]">API Docs</Link> | <Link href="https://github.com/vinaybhosle/agentstamp" className="text-[#818cf8]">GitHub</Link>
        </p>
      </div>
    </article>
  );
}
