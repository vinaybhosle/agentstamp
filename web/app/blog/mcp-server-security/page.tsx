import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "MCP Server Security: How to Verify the Tools Your AI Agent Connects To",
  description: "Over 30 CVEs filed against MCP servers in early 2026. 82% vulnerable to path traversal, 38% have no authentication. Here's how to verify the tools your agent uses.",
  alternates: { canonical: "https://agentstamp.org/blog/mcp-server-security" },
  openGraph: {
    title: "MCP Server Security: How to Verify the Tools Your AI Agent Connects To",
    description: "30+ CVEs in MCP servers, 82% vulnerable to path traversal. How to verify your agent's tools.",
    url: "https://agentstamp.org/blog/mcp-server-security",
    type: "article",
    publishedTime: "2026-03-25",
  },
  keywords: ["MCP server security", "Claude MCP tools security", "MCP authentication", "Model Context Protocol vulnerabilities", "AI agent tool verification", "MCP OWASP"],
};

export default function Article() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 prose prose-invert prose-lg">
      <Link href="/blog" className="text-sm text-[#818cf8] no-underline hover:underline mb-4 block">&larr; Back to Blog</Link>
      <time className="text-sm text-[#71717a]">March 25, 2026</time>
      <h1 className="text-3xl font-bold text-[#e8e8ed] mt-2">MCP Server Security: How to Verify the Tools Your AI Agent Connects To</h1>

      <p className="text-[#d4d4d8]">The Model Context Protocol has become the dominant standard for connecting AI agents to external tools. The ecosystem now includes over 5,800 servers, 300+ clients, and 97 million monthly SDK downloads. But the speed of adoption has outpaced security. Over 30 CVEs were filed against MCP servers in January and February 2026 alone, and the vulnerability patterns are systemic, not incidental.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">The Vulnerability Landscape</h2>
      <p className="text-[#d4d4d8]">A comprehensive audit of 2,614 MCP implementations published in early 2026 found staggering vulnerability rates. 82% were vulnerable to path traversal attacks, allowing an attacker to read or write files outside the intended directory. Two-thirds contained code injection flaws. More than a third had command injection vulnerabilities that could give an attacker shell access to the host system.</p>
      <p className="text-[#d4d4d8]">The breakdown of the 30+ CVEs tells a consistent story: 43% involved exec or shell injection, 20% were tooling-level flaws in how MCP servers processed tool calls, and 13% were authentication bypass issues where servers accepted unauthenticated requests.</p>
      <p className="text-[#d4d4d8]">The most severe example was CVE-2025-6514, scoring CVSS 9.6. This OS command injection vulnerability affected <code className="text-[#818cf8]">mcp-remote</code>, a package with over 437,000 downloads. An attacker could execute arbitrary commands on the host machine by crafting a malicious tool response.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">Why MCP Servers Are Uniquely Exposed</h2>
      <p className="text-[#d4d4d8]">MCP servers occupy a dangerous position in the software supply chain. They sit between the AI model and the operating system, translating natural language tool calls into system operations. A traditional web API might accept a JSON payload and return a JSON response. An MCP server might accept a tool call and execute a shell command, read a file, query a database, or make an HTTP request on the agent&apos;s behalf.</p>
      <p className="text-[#d4d4d8]">This means MCP servers have the attack surface of a web application with the privilege level of a system service. And 38% of them have no authentication at the MCP protocol level, according to the audit data. Anyone who can reach the server can invoke any tool it exposes.</p>
      <p className="text-[#d4d4d8]">Microsoft&apos;s MarkItDown MCP server illustrates the exposure. Research found that 36.7% of the 7,000+ servers analyzed had SSRF (Server-Side Request Forgery) vulnerabilities, allowing attackers to use MCP servers as proxies to access internal network resources that should never be reachable from the outside.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">The OWASP MCP Top 10</h2>
      <p className="text-[#d4d4d8]">The security community has responded by publishing an OWASP Top 10 specifically for MCP. The three highest-ranked risks are:</p>
      <p className="text-[#d4d4d8]"><strong className="text-[#e8e8ed]">Tool Poisoning</strong> occurs when a malicious or compromised MCP server returns crafted responses that manipulate the AI model&apos;s behavior. The model trusts tool outputs by default, so a poisoned tool response can redirect the agent&apos;s actions, exfiltrate data through the model&apos;s next tool call, or inject instructions that override the user&apos;s intent.</p>
      <p className="text-[#d4d4d8]"><strong className="text-[#e8e8ed]">Insufficient Authentication</strong> is the 38% problem. MCP servers that accept unauthenticated connections allow any client to invoke any tool. In a multi-tenant environment, this means one user&apos;s agent can access another user&apos;s tools.</p>
      <p className="text-[#d4d4d8]"><strong className="text-[#e8e8ed]">Prompt-State Manipulation</strong> exploits the stateful nature of MCP sessions. By injecting carefully crafted tool responses at specific points in a conversation, an attacker can alter the model&apos;s understanding of the session context, causing it to take actions the user never requested.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">A Verification Checklist</h2>
      <p className="text-[#d4d4d8]">Before connecting your agent to any MCP server, verify the following:</p>
      <pre className="bg-[#1a1a2e] rounded-lg p-4 overflow-x-auto text-sm">
{`1. Authentication: Does the server require auth for tool calls?
2. Transport security: Is the connection encrypted (TLS/HTTPS)?
3. Input validation: Does the server sanitize tool parameters?
4. Output sanitization: Are tool responses stripped of injection payloads?
5. Scope limitation: Does the server restrict file/network access?
6. Audit logging: Are tool calls logged with caller identity?
7. Version pinning: Is the server version locked to a known-good release?
8. CVE monitoring: Is there a process for patching disclosed vulns?`}
      </pre>
      <p className="text-[#d4d4d8]">Most teams skip every item on this list. They install an MCP server, connect it to their agent, and move on. The result is an agent with shell access running tools that have never been audited.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">Server Identity as a Foundation</h2>
      <p className="text-[#d4d4d8]">The checklist above addresses individual server hygiene, but it does not solve the discovery problem. When an agent or developer encounters an MCP server, how do they know the server is what it claims to be? A malicious actor can publish an MCP server with the same name and description as a popular legitimate one. Without server identity verification, there is no way to distinguish the real server from the impersonator.</p>
      <p className="text-[#d4d4d8]">This is where registry-based verification becomes essential. A trust registry that tracks MCP server identity, assigns verifiable credentials to server operators, and maintains a public record of audit results gives agents and developers a way to verify servers before connecting.</p>
      <p className="text-[#d4d4d8]">AgentStamp&apos;s registry includes MCP server verification as a core capability. Servers registered with the platform receive stamp-verified status that agents can check programmatically before establishing a connection. The registry tracks 17 MCP tools internally and provides verification infrastructure for external servers through the same trust scoring and credential system used for agent identity.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">Defense in Depth for MCP</h2>
      <p className="text-[#d4d4d8]">No single measure eliminates MCP server risk. The practical approach is defense in depth:</p>
      <pre className="bg-[#1a1a2e] rounded-lg p-4 overflow-x-auto text-sm">
{`Layer 1: Server identity verification (trust registry)
Layer 2: Transport encryption (TLS for SSE/HTTP, stdin for stdio)
Layer 3: Authentication (wallet signature, OAuth, API key)
Layer 4: Input sanitization (parameterized commands, no shell exec)
Layer 5: Output filtering (strip injection patterns from responses)
Layer 6: Runtime monitoring (log every tool call, alert on anomalies)
Layer 7: Least privilege (file access limited, network access restricted)`}
      </pre>
      <p className="text-[#d4d4d8]">Most MCP security incidents to date could have been prevented by layers 3 and 4 alone. Adding layer 1 prevents the supply chain attacks that are harder to detect because they compromise the server before it ever processes a malicious input.</p>

      <h2 className="text-2xl font-semibold text-[#e8e8ed] mt-8">The Path Forward</h2>
      <p className="text-[#d4d4d8]">MCP is not going away. The protocol fills a genuine need, and the ecosystem momentum is too large to reverse. But the current security posture is unsustainable. With 82% of servers vulnerable to path traversal and 38% lacking any authentication, the question is not whether a major MCP-related breach will occur, but when.</p>
      <p className="text-[#d4d4d8]">The fix is not to abandon MCP. It is to treat MCP servers with the same rigor applied to any other component in the software supply chain: verify identity, enforce authentication, audit regularly, and monitor continuously. The tools to do this exist today. The gap is adoption.</p>
    </article>
  );
}
