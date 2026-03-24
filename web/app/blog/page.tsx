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
