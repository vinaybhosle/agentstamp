import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Add Trust Verification to Your AI Agent in 3 Lines of Code",
  description: "A practical guide to adding cryptographic trust verification to any AI agent using the AgentStamp SDK. Express middleware, LangChain tool, or raw API.",
  alternates: { canonical: "https://agentstamp.org/blog/trust-verification-3-lines" },
  openGraph: {
    title: "Add Trust Verification to Your AI Agent in 3 Lines of Code",
    description: "Trust verification for AI agents in 3 lines. Express middleware, LangChain tool, or raw API.",
    url: "https://agentstamp.org/blog/trust-verification-3-lines",
    type: "article",
    publishedTime: "2026-03-21",
  },
  keywords: ["AgentStamp SDK", "trust verification tutorial", "Express middleware", "LangChain tool", "AI agent security", "x402 payments"],
};

export default function Article() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 prose prose-invert prose-lg">
      <Link href="/blog" className="text-sm text-[#818cf8] no-underline hover:underline mb-4 block">&larr; Back to Blog</Link>
      <time className="text-sm text-[#71717a]">March 21, 2026</time>
      <h1 className="text-3xl font-bold text-[#e8e8ed] mt-2">Add Trust Verification to Your AI Agent in 3 Lines of Code</h1>

      <p className="text-[#d4d4d8]">Every AI agent service should verify who is calling it before processing requests. Here&apos;s how to add cryptographic trust verification to any Node.js or Python agent in under a minute.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">Option 1: Express Middleware (Node.js)</h2>
      <pre className="bg-[#1a1a2e] rounded-lg p-4 overflow-x-auto text-sm">
{`npm install agentstamp-verify`}
      </pre>
      <pre className="bg-[#1a1a2e] rounded-lg p-4 overflow-x-auto text-sm mt-4">
{`const { requireStamp } = require('agentstamp-verify');

// Gate your endpoint — only gold-stamped agents can access
app.use('/api/premium', requireStamp({ minTier: 'gold' }));`}
      </pre>
      <p className="text-[#d4d4d8]">That&apos;s it. Three lines. Every request to <code className="text-[#818cf8]">/api/premium</code> now requires the caller to present a valid AgentStamp identity via the <code className="text-[#818cf8]">X-Wallet-Address</code> header. The middleware checks the stamp tier, validates the wallet signature, and returns 401 if the agent doesn&apos;t meet the threshold.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">Option 2: Python Client</h2>
      <pre className="bg-[#1a1a2e] rounded-lg p-4 overflow-x-auto text-sm">
{`pip install agentstamp`}
      </pre>
      <pre className="bg-[#1a1a2e] rounded-lg p-4 overflow-x-auto text-sm mt-4">
{`from agentstamp import trust_check

result = trust_check("0x1234...abcd")
print(f"Score: {result['score']}, Tier: {result['tier']}")`}
      </pre>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">Option 3: Raw API (Any Language)</h2>
      <pre className="bg-[#1a1a2e] rounded-lg p-4 overflow-x-auto text-sm">
{`GET https://agentstamp.org/api/v1/trust/check/0x1234...abcd

{
  "trusted": true,
  "score": 72,
  "tier": "gold",
  "label": "Established"
}`}
      </pre>
      <p className="text-[#d4d4d8]">Free, no API key, no signup. Works from any language that can make HTTP requests.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">Option 4: MCP Tools (Claude Desktop)</h2>
      <pre className="bg-[#1a1a2e] rounded-lg p-4 overflow-x-auto text-sm">
{`claude mcp add --transport sse agentstamp https://agentstamp.org/mcp`}
      </pre>
      <p className="text-[#d4d4d8]">17 MCP tools available including <code className="text-[#818cf8]">trust_check</code>, <code className="text-[#818cf8]">compliance_report</code>, <code className="text-[#818cf8]">get_verifiable_credential</code>, and <code className="text-[#818cf8]">dns_discovery</code>.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">What the Trust Score Means</h2>
      <p className="text-[#d4d4d8]">AgentStamp&apos;s trust score (0-100) is dynamic. It decays without activity:</p>
      <ul className="text-[#d4d4d8]">
        <li>0-3 days: full score</li>
        <li>3-7 days: 75% of earned score</li>
        <li>7-14 days: 50%</li>
        <li>14-30 days: 25%</li>
        <li>30+ days: zero</li>
      </ul>
      <p className="text-[#d4d4d8]">This forces continuous accountability. An agent can&apos;t register once and coast forever. It has to maintain its reputation through regular heartbeats, endorsements, and activity.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">Next Steps</h2>
      <ul className="text-[#d4d4d8]">
        <li><Link href="/register" className="text-[#818cf8]">Register your agent</Link> (free, 60 seconds)</li>
        <li><Link href="/docs" className="text-[#818cf8]">Full API documentation</Link></li>
        <li><Link href="https://github.com/vinaybhosle/agentstamp" className="text-[#818cf8]">GitHub (MIT license)</Link></li>
        <li><Link href="https://www.npmjs.com/package/agentstamp-verify" className="text-[#818cf8]">npm: agentstamp-verify</Link></li>
        <li><Link href="https://pypi.org/project/agentstamp/" className="text-[#818cf8]">PyPI: agentstamp</Link></li>
      </ul>

      <div className="mt-12 pt-6 border-t border-[#27272a]">
        <p className="text-sm text-[#71717a]">AgentStamp is open-source. Free tier includes: 7-day stamp, 30-day registration, unlimited trust checks, 17 MCP tools.</p>
      </div>
    </article>
  );
}
