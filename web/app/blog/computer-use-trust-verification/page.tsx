import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Claude Can Use Your Computer Now. Here's How to Make It Verify Trust First.",
  description: "When Claude calls another agent's API during Computer Use, how does it know that agent is trustworthy? 17 MCP tools that solve this.",
  alternates: { canonical: "https://agentstamp.org/blog/computer-use-trust-verification" },
  openGraph: {
    title: "Claude Can Use Your Computer Now. Here's How to Make It Verify Trust First.",
    description: "When Claude calls another agent's API during Computer Use, how does it know that agent is trustworthy?",
    url: "https://agentstamp.org/blog/computer-use-trust-verification",
    type: "article",
    publishedTime: "2026-03-25",
  },
  keywords: ["Claude Computer Use", "MCP trust tools", "agent verification", "AI agent trust", "AgentStamp MCP"],
};

export default function Article() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 prose prose-invert prose-lg">
      <Link href="/blog" className="text-sm text-[#818cf8] no-underline hover:underline mb-4 block">&larr; Back to Blog</Link>
      <time className="text-sm text-[#71717a]">March 25, 2026</time>
      <h1 className="text-3xl font-bold text-[#e8e8ed] mt-2">Claude Can Use Your Computer Now. Here&apos;s How to Make It Verify Trust First.</h1>

      <p className="text-[#d4d4d8]">Anthropic shipped Computer Use. Claude can open apps, browse the web, call APIs, and run tools on your Mac. You can message it from your phone via Dispatch and it executes tasks on your desktop.</p>

      <p className="text-[#d4d4d8]">But when your Claude agent calls another agent&apos;s API during a Computer Use session, how does it know that agent is trustworthy?</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">The Problem</h2>
      <p className="text-[#d4d4d8]">A Claude Desktop agent calling an external API trusts it implicitly. No verification, no trust score, no audit trail. This is fine for code autocomplete. Not fine when making API calls with real data on your behalf.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">The Solution: MCP Trust Tools</h2>
      <p className="text-[#d4d4d8]">AgentStamp provides 17 MCP tools that let any Claude agent verify trust before interacting with external services. All free, no API key needed.</p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">Setup (30 seconds)</h3>
      <pre className="bg-[#1a1a2e] rounded-lg p-4 overflow-x-auto text-sm">
{`claude mcp add --transport sse agentstamp https://agentstamp.org/mcp`}
      </pre>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">Verify Before You Trust</h3>
      <p className="text-[#d4d4d8]">Before sending data to an external service, Claude calls <code className="text-[#818cf8]">trust_check</code> and gets a trust score (0-100), tier, stamp status, and delegation count. If below your threshold, it refuses to proceed.</p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">Present Your Own Identity</h3>
      <p className="text-[#d4d4d8]">Claude calls <code className="text-[#818cf8]">get_verifiable_credential</code> and gets a W3C VC Data Model 2.0 credential, interoperable with any VC verifier. The agent equivalent of showing your ID.</p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">Compliance Check Before Delegation</h3>
      <p className="text-[#d4d4d8]">Claude calls <code className="text-[#818cf8]">compliance_report</code> to get EU AI Act risk level, human sponsor info, audit trail integrity, and trust status before delegating tasks.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">The Audit Trail</h2>
      <p className="text-[#d4d4d8]">Every interaction through AgentStamp MCP tools is logged in a SHA-256 hash-chained audit trail. Tamper-evident, exportable as JSON, independently verifiable.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">Why This Matters Now</h2>
      <p className="text-[#d4d4d8]">Computer Use turns Claude into a full desktop agent. Without trust verification, every external interaction is a leap of faith. The agents that survive won&apos;t be the ones that do the most &mdash; they&apos;ll be the ones that can prove they should be trusted.</p>

      <div className="mt-12 pt-6 border-t border-[#27272a]">
        <p className="text-sm text-[#71717a]">AgentStamp is open-source. <Link href="https://github.com/vinaybhosle/agentstamp" className="text-[#818cf8]">GitHub</Link> | <Link href="/docs" className="text-[#818cf8]">Docs</Link> | <Link href="/" className="text-[#818cf8]">agentstamp.org</Link></p>
      </div>
    </article>
  );
}
