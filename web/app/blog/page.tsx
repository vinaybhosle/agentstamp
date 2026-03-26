import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog",
  description: "Articles about AI agent trust, identity verification, MCP tools, and the future of agent-to-agent communication.",
  alternates: { canonical: "https://agentstamp.org/blog" },
  openGraph: {
    title: "Blog | AgentStamp",
    description: "Articles about AI agent trust, identity verification, and MCP tools.",
    url: "https://agentstamp.org/blog",
  },
};

const articles = [
  {
    slug: "non-human-identity-crisis",
    title: "The Non-Human Identity Crisis: Why AI Agents Need Their Own Identity Layer",
    description: "NHIs outnumber humans 144:1 and cause 80% of identity breaches. Why shared API keys are the agent security crisis nobody is solving.",
    date: "2026-03-25",
    tags: ["security", "identity", "NHI"],
  },
  {
    slug: "eu-ai-act-agent-compliance",
    title: "How to Make Your AI Agent EU AI Act Compliant Before August 2026",
    description: "Article 50 transparency requirements, fines up to EUR 35M, and the four-layer compliance stack your agent needs before the deadline.",
    date: "2026-03-25",
    tags: ["compliance", "eu-ai-act", "regulation"],
  },
  {
    slug: "zero-trust-ai-agents",
    title: "Zero Trust for AI Agents: Beyond the Perimeter",
    description: "Only 5% have agents in production. 60% cite security as the barrier. How cryptographic identity extends zero trust to autonomous agents.",
    date: "2026-03-25",
    tags: ["security", "zero-trust", "architecture"],
  },
  {
    slug: "dns-agent-discovery",
    title: "DNS-Based Agent Discovery: The Missing Infrastructure for the Agent Web",
    description: "Three IETF drafts, one GoDaddy deployment, and the DNS TXT record format that will make AI agents discoverable like websites.",
    date: "2026-03-25",
    tags: ["infrastructure", "DNS", "discovery"],
  },
  {
    slug: "tamper-evident-audit-trails",
    title: "Tamper-Proof Audit Logs for AI Agents: A Technical Deep Dive",
    description: "SHA-256 hash chains, Ed25519 signatures, and why append-only databases are not enough for agent compliance logging.",
    date: "2026-03-25",
    tags: ["audit", "cryptography", "compliance"],
  },
  {
    slug: "x402-identity-verified-commerce",
    title: "x402 Payments for AI Agents: Identity-Verified Commerce",
    description: "140M+ transactions but half are artificial. The missing piece in agentic commerce is identity — here is how to add it.",
    date: "2026-03-25",
    tags: ["payments", "x402", "commerce"],
  },
  {
    slug: "verifiable-credentials-ai-agents",
    title: "W3C Verifiable Credentials for AI Agents: From Theory to Implementation",
    description: "W3C DIDs v1.1 just hit Candidate Recommendation. How to issue and verify credentials for AI agents in production.",
    date: "2026-03-25",
    tags: ["W3C", "credentials", "standards"],
  },
  {
    slug: "guardian-agents-need-identity",
    title: "Guardian Agents Need Guarded Agents: Why Gartner's New Category Requires Agent Identity",
    description: "Gartner's first Market Guide for guardian agents landed. The framework assumes agent identity exists — but who provides it?",
    date: "2026-03-25",
    tags: ["gartner", "governance", "enterprise"],
  },
  {
    slug: "mcp-server-security",
    title: "MCP Server Security: How to Verify the Tools Your AI Agent Connects To",
    description: "30+ CVEs in 60 days. 82% vulnerable to path traversal. 38% have no auth. A security guide for the MCP ecosystem.",
    date: "2026-03-25",
    tags: ["MCP", "security", "claude"],
  },
  {
    slug: "agent-key-rotation-revocation",
    title: "Key Rotation and Revocation for AI Agents: The Lifecycle Nobody Manages",
    description: "78% lack formal agent decommissioning policies. 64% of leaked secrets from 2022 are still valid. The credential lifecycle problem.",
    date: "2026-03-25",
    tags: ["keys", "lifecycle", "security"],
  },
  {
    slug: "computer-use-trust-verification",
    title: "Claude Can Use Your Computer Now. Here's How to Make It Verify Trust First.",
    description: "When Claude calls another agent's API during Computer Use, how does it know that agent is trustworthy? 17 MCP tools that solve this.",
    date: "2026-03-25",
    tags: ["ai", "security", "mcp"],
  },
  {
    slug: "why-agents-need-identity",
    title: "Why AI Agents Need Verifiable Identity",
    description: "In a world of autonomous agents, identity isn't optional. It's the foundation for trust, accountability, and commerce.",
    date: "2026-03-21",
    tags: ["ai", "identity", "trust"],
  },
  {
    slug: "trust-verification-3-lines",
    title: "Add Trust Verification to Your AI Agent in 3 Lines of Code",
    description: "A practical guide to adding cryptographic trust verification to any AI agent using the AgentStamp SDK.",
    date: "2026-03-21",
    tags: ["tutorial", "sdk", "javascript"],
  },
];

export default function BlogPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-4xl font-bold text-[#e8e8ed] mb-2">Blog</h1>
      <p className="text-[#a1a1aa] mb-12">
        Articles about AI agent trust, identity verification, and the future of agent-to-agent communication.
      </p>

      <div className="space-y-8">
        {articles.map((article) => (
          <article key={article.slug} className="border border-[#27272a] rounded-lg p-6 hover:border-[#3f3f46] transition-colors">
            <Link href={`/blog/${article.slug}`}>
              <time className="text-sm text-[#71717a]">{article.date}</time>
              <h2 className="text-xl font-semibold text-[#e8e8ed] mt-1 mb-2 hover:text-[#a78bfa] transition-colors">
                {article.title}
              </h2>
              <p className="text-[#a1a1aa] text-sm">{article.description}</p>
              <div className="flex gap-2 mt-3">
                {article.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-[#1a1a2e] text-[#818cf8] px-2 py-1 rounded">
                    #{tag}
                  </span>
                ))}
              </div>
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
