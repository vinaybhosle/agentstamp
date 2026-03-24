import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Why AI Agents Need Verifiable Identity",
  description: "In a world of autonomous agents, identity isn't optional. It's the foundation for trust, accountability, and commerce between AI systems.",
  alternates: { canonical: "https://agentstamp.org/blog/why-agents-need-identity" },
  openGraph: {
    title: "Why AI Agents Need Verifiable Identity",
    description: "Identity is the foundation for trust, accountability, and commerce between AI systems.",
    url: "https://agentstamp.org/blog/why-agents-need-identity",
    type: "article",
    publishedTime: "2026-03-21",
  },
  keywords: ["AI agent identity", "agent verification", "cryptographic identity", "agent trust", "multi-agent systems"],
};

export default function Article() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 prose prose-invert prose-lg">
      <Link href="/blog" className="text-sm text-[#818cf8] no-underline hover:underline mb-4 block">&larr; Back to Blog</Link>
      <time className="text-sm text-[#71717a]">March 21, 2026</time>
      <h1 className="text-3xl font-bold text-[#e8e8ed] mt-2">Why AI Agents Need Verifiable Identity</h1>

      <p className="text-[#d4d4d8]">When a human developer calls an API, there&apos;s an implicit trust chain: the developer works at a company, the company has a domain, the domain has TLS certificates, and the API key is tied to a billing account. Identity is baked into the infrastructure.</p>

      <p className="text-[#d4d4d8]">AI agents have none of this. An agent calling another agent&apos;s API is, from the receiver&apos;s perspective, an anonymous HTTP request. There&apos;s no way to know who built it, who operates it, whether it has a track record, or if it should be trusted with sensitive data.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">The Three Problems</h2>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">1. Trust</h3>
      <p className="text-[#d4d4d8]">How do you know which agents are reliable before giving them work? A trust score that decays over time (not a one-time badge) forces continuous accountability. An agent that goes silent for 30 days should lose its trust, not coast on a registration from months ago.</p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">2. Accountability</h3>
      <p className="text-[#d4d4d8]">When something goes wrong in a multi-agent pipeline, how do you reconstruct what happened? Logs on the same server the agent controls are theater. The audit trail needs to survive the agent&apos;s own actions &mdash; external, hash-chained, tamper-evident.</p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">3. Commerce</h3>
      <p className="text-[#d4d4d8]">Agent-to-agent payments require identity. You don&apos;t pay an anonymous endpoint. x402 micropayments work because wallet addresses are cryptographic identities, but a wallet alone doesn&apos;t tell you anything about the agent behind it. Trust scoring bridges this gap.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">What Verifiable Identity Looks Like</h2>
      <p className="text-[#d4d4d8]">A verifiable agent identity includes: a cryptographic stamp (Ed25519 signed certificate), a public registry entry (searchable, browsable), a dynamic trust score (0-100, decays without activity), an audit trail (hash-chained, exportable), and optionally a human sponsor (who operates this agent).</p>

      <p className="text-[#d4d4d8]">This isn&apos;t a new idea. It&apos;s how TLS certificates, domain verification, and credit scores already work for humans and organizations. The gap is that no equivalent existed for AI agents &mdash; until standards like ERC-8004 and platforms like AgentStamp started filling it.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">The EU AI Act Connection</h2>
      <p className="text-[#d4d4d8]">Article 52 of the EU AI Act requires transparency: AI systems must disclose that they are AI. For agents operating autonomously, this means every agent needs a machine-readable transparency declaration &mdash; who built it, what it does, what risk level it carries, and who is accountable.</p>

      <p className="text-[#d4d4d8]">AgentStamp&apos;s compliance endpoint returns exactly this: a structured report with AI Act risk level, transparency declaration, human sponsor, audit chain integrity, and trust status. Enforcement begins August 2026.</p>

      <div className="mt-12 pt-6 border-t border-[#27272a]">
        <p className="text-sm text-[#71717a]">
          <Link href="/register" className="text-[#818cf8]">Register your agent</Link> | <Link href="/docs" className="text-[#818cf8]">API Docs</Link> | <Link href="https://github.com/vinaybhosle/agentstamp" className="text-[#818cf8]">GitHub</Link>
        </p>
      </div>
    </article>
  );
}
