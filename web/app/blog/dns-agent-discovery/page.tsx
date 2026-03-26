import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "DNS-Based Agent Discovery: The Missing Infrastructure for the Agent Web",
  description: "How DNS TXT records, IETF drafts like AID and BANDAID, and GoDaddy ANS are building agent discovery — and why trust verification completes the picture.",
  alternates: { canonical: "https://agentstamp.org/blog/dns-agent-discovery" },
  openGraph: {
    title: "DNS-Based Agent Discovery: The Missing Infrastructure for the Agent Web",
    description: "DNS-based agent discovery is being standardized. But discovery without trust is just a phone book.",
    url: "https://agentstamp.org/blog/dns-agent-discovery",
    type: "article",
    publishedTime: "2026-03-25",
  },
  keywords: ["DNS agent discovery", "AID specification", "agent endpoint discovery", "_agent TXT record", "BANDAID IETF draft", "GoDaddy ANS", "agent naming system"],
};

export default function Article() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 prose prose-invert prose-lg">
      <Link href="/blog" className="text-sm text-[#818cf8] no-underline hover:underline mb-4 block">&larr; Back to Blog</Link>
      <time className="text-sm text-[#71717a]">March 25, 2026</time>
      <h1 className="text-3xl font-bold text-[#e8e8ed] mt-2">DNS-Based Agent Discovery: The Missing Infrastructure for the Agent Web</h1>

      <p className="text-[#d4d4d8]">When you want to find a website, you type a domain name and DNS resolves it to an IP address. It takes roughly 20 milliseconds and the entire internet depends on it. But when an AI agent needs to find another agent, there is no equivalent mechanism. That is changing fast, with at least three competing IETF drafts racing to become the standard for agent discovery over DNS.</p>

      <p className="text-[#d4d4d8]">The stakes are significant. Over 60 organizations in Google&apos;s Agent-to-Agent Protocol (A2P) coalition are already experimenting with DNS-based discovery mechanisms. The question is no longer whether agents will be discoverable via DNS, but which specification wins — and what happens after discovery.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">Three Competing Drafts</h2>

      <p className="text-[#d4d4d8]">The agent discovery landscape has three serious contenders, each taking a different approach to the same fundamental problem.</p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">1. AID (Agent Identification via DNS)</h3>

      <p className="text-[#d4d4d8]">The <code className="text-[#818cf8]">draft-nemethi-aid</code> specification uses DNS TXT records with a structured format. An agent publishes its endpoint, protocol, public key, and description directly in the domain&apos;s DNS zone file.</p>

      <pre className="bg-[#1a1a2e] rounded-lg p-4 overflow-x-auto text-sm">
{`# AID TXT Record Format
_agent.example.com  TXT  "v=aid1;u=https://example.com/agent;p=a2a;k=ed25519:abc123...;a=x402;s=Shipping rate intelligence agent"`}
      </pre>

      <p className="text-[#d4d4d8]">The fields map cleanly: <code className="text-[#818cf8]">v</code> is the spec version, <code className="text-[#818cf8]">u</code> is the agent endpoint URL, <code className="text-[#818cf8]">p</code> is the protocol (A2A, MCP, HTTP), <code className="text-[#818cf8]">k</code> is a public key for message verification, <code className="text-[#818cf8]">a</code> is the authentication method, and <code className="text-[#818cf8]">s</code> is a human-readable description. It is elegant in its simplicity — a single TXT record tells a calling agent everything it needs to initiate contact.</p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">2. DNS-AID / BANDAID</h3>

      <p className="text-[#d4d4d8]">Published in February 2026 as <code className="text-[#818cf8]">draft-mozleywilliams-dnsop-dnsaid-00</code>, BANDAID (Building Agent Naming with DNS for Agent IDentification and Discovery) takes a more structured approach using SVCB records and protocol-specific subzones.</p>

      <pre className="bg-[#1a1a2e] rounded-lg p-4 overflow-x-auto text-sm">
{`# BANDAID SVCB Records with Protocol Subzones
_a2a._agents.example.com   SVCB  1  agent.example.com alpn="h2" port=443
_mcp._agents.example.com   SVCB  1  mcp.example.com  alpn="h2" port=8080`}
      </pre>

      <p className="text-[#d4d4d8]">The subzone approach has a key advantage: a single domain can advertise multiple agents across different protocols. An enterprise might run an A2A agent for inter-company communication and an MCP server for developer tooling, each discoverable under its own protocol prefix. The tradeoff is additional DNS complexity and more records to manage.</p>

      <h3 className="text-xl font-semibold text-[#e8e8ed] mt-6">3. ANS (Agent Name System)</h3>

      <p className="text-[#d4d4d8]">GoDaddy&apos;s Agent Name System (<code className="text-[#818cf8]">draft-narajala-ans-00</code>) is the most ambitious of the three. Unlike the other drafts, ANS already has a production deployment at AgentNameRegistry.org, launched in November 2025. OWASP released ANS v1.0 in May 2025, giving it additional institutional weight.</p>

      <p className="text-[#d4d4d8]">ANS goes beyond simple DNS records. It defines a full naming hierarchy, resolution protocol, and registration system — closer to a domain registrar for agents than a simple TXT record convention. The upside is a richer feature set. The downside is that it introduces a centralized registry dependency that DNS purists find uncomfortable.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">A Practical Walkthrough</h2>

      <p className="text-[#d4d4d8]">Let&apos;s say you operate a logistics agent and want to make it discoverable. Using the AID approach, you would add a single TXT record to your DNS zone.</p>

      <pre className="bg-[#1a1a2e] rounded-lg p-4 overflow-x-auto text-sm">
{`# Step 1: Add the TXT record to your DNS zone
_agent.logistics.example.com  IN  TXT  "v=aid1;u=https://logistics.example.com/a2a;p=a2a;k=ed25519:MCow...;a=x402;s=Container rate comparison agent"

# Step 2: Verify it resolves
dig TXT _agent.logistics.example.com +short

# Expected output:
# "v=aid1;u=https://logistics.example.com/a2a;p=a2a;k=ed25519:MCow...;a=x402;s=Container rate comparison agent"`}
      </pre>

      <p className="text-[#d4d4d8]">A calling agent performs a DNS lookup, parses the TXT record, and now knows the endpoint URL, protocol, and public key. In under 50 milliseconds, discovery is complete. The agent can initiate communication.</p>

      <p className="text-[#d4d4d8]">But here is the problem.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">Discovery Without Trust Is Just a Phone Book</h2>

      <p className="text-[#d4d4d8]">DNS discovery answers one question: <strong className="text-[#e8e8ed]">where is this agent?</strong> It does not answer the harder question: <strong className="text-[#e8e8ed]">should I trust this agent?</strong></p>

      <p className="text-[#d4d4d8]">A TXT record can be published by anyone who controls a domain. There is no built-in mechanism to verify that the agent behind the endpoint has been audited, that its operator has a track record, or that its behavior matches its description. DNS tells you the phone number exists. It does not tell you whether the person answering is trustworthy.</p>

      <p className="text-[#d4d4d8]">This gap is not theoretical. In the web2 world, HTTPS certificates solved the authentication problem for websites, but it took years and the entire Certificate Authority infrastructure to get there. The agent web needs a trust layer that works at the same speed as DNS discovery but provides verifiable identity and reputation signals.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">Closing the Trust Gap</h2>

      <p className="text-[#d4d4d8]">The natural complement to DNS discovery is a verification step that runs immediately after resolution. Once you know where an agent lives, you check whether it has a verifiable on-chain identity and what its trust score looks like.</p>

      <pre className="bg-[#1a1a2e] rounded-lg p-4 overflow-x-auto text-sm">
{`// After DNS discovery resolves the agent endpoint
const agentEndpoint = parseTxtRecord(dnsResult); // "https://logistics.example.com/a2a"
const agentWallet = extractWalletFromHandshake(agentEndpoint);

// Verify the agent's identity before sending any data
const trust = await fetch(
  \`https://api.agentstamp.org/verify/\${agentWallet}\`
).then(r => r.json());

if (trust.stamp?.tier === "gold" && trust.score >= 70) {
  // Agent has verified identity + strong reputation
  await initiateA2ASession(agentEndpoint);
} else {
  console.log("Agent discovered but trust insufficient:", trust.score);
}`}
      </pre>

      <p className="text-[#d4d4d8]">This pattern — discover via DNS, verify via on-chain identity — adds roughly 200 milliseconds to the initial handshake but provides cryptographic assurance that the agent is who it claims to be. The ERC-8004 stamp is bound to a wallet address, not a domain name, so it survives domain transfers and DNS hijacking attempts.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">What Comes Next</h2>

      <p className="text-[#d4d4d8]">All three IETF drafts are still in early stages. AID has the simplest implementation path. BANDAID has the richest protocol separation. ANS has the most production traction. It is possible that the ecosystem converges on one, or more likely, that different use cases adopt different approaches — TXT records for simple single-agent domains, SVCB for multi-protocol enterprises, and ANS for managed registries.</p>

      <p className="text-[#d4d4d8]">Regardless of which discovery mechanism wins, the trust layer remains independent. Agent identity verification operates at the wallet level, not the DNS level. Whether an agent is found via a TXT record, an SVCB lookup, or an ANS registry query, the verification step is the same: check the on-chain stamp, read the trust score, and make an informed decision about whether to interact.</p>

      <p className="text-[#d4d4d8]">The agent web needs both halves of this infrastructure. Discovery tells you where agents live. Trust tells you which ones are safe to work with. The teams building DNS discovery are solving a real problem. The teams building verifiable identity are solving the other half.</p>

      <p className="text-[#a1a1aa] text-sm mt-12 border-t border-[#2a2a3e] pt-6">Sources: IETF draft-nemethi-aid, draft-mozleywilliams-dnsop-dnsaid-00 (February 2026), draft-narajala-ans-00, GoDaddy AgentNameRegistry.org (November 2025), OWASP ANS v1.0 (May 2025), Google A2P coalition documentation.</p>
    </article>
  );
}
