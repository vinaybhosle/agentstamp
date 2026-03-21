import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";

const navigationLinks = [
  { href: "/registry", label: "Registry" },
  { href: "/well", label: "Well" },
  { href: "/verify", label: "Verify" },
  { href: "/docs", label: "Docs" },
  { href: "/about", label: "About" },
];

const discoveryLinks = [
  { href: "/.well-known/mcp.json", label: "MCP Manifest" },
  { href: "/.well-known/agent-card.json", label: "Agent Card" },
];

const listedOnLinks = [
  {
    href: "https://aiagentsdirectory.com/agent/agentstamp",
    label: "AI Agents Directory",
  },
  {
    href: "https://dev.to/vinaybhosle/add-trust-verification-to-your-ai-agent-in-3-lines-of-code-36c9",
    label: "DEV.to",
  },
];

const tipJarAddresses = [
  {
    label: "BTC",
    address:
      "xpub6BoKkQSFUGCLzswAkrTa15rqDei2wpQPemNFW6x3dEWSP2KtxVwZvyMg5nhP9nobiXob4yV8r5ZvjvsAnVFYzY4uc7oTMo9Symhv2e2MYaE",
  },
  {
    label: "DOGE",
    address:
      "xpub6CVjkf4ssfC1k56kkdewKukJhQz25DuLcvjWLfhq9WExpFerLJ8JwJGZNYXgoVY3pFDUsZqdYUuZnY8SHKWrpmJhtqXTy98vyTHz6FSembL",
  },
  {
    label: "ETH",
    address: "0x8c9e0882b4c6e6568fe76F16D59F7E080465E5C8",
  },
  {
    label: "LTC",
    address:
      "xpub6CJSoPwCBkpT8uv6oDLBfo3vNHmCRVVuzCajsSFJDGB4prvshcKrRnAXAevge5RmPeuFtwgsWbCTHZEqYV8HHHadGuMbiTkDWQvnJMT6qj3",
  },
  {
    label: "SOL",
    address: "Gcv56hKWuEGmXheBpJxAwQxvX6QAMimZzzVrHaVCbNWE",
  },
];

function truncate(str: string, maxLen: number = 16): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, 8)}...${str.slice(-6)}`;
}

export function Footer() {
  return (
    <footer className="border-t border-[#1e1e2a] bg-[#050508]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Navigation */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#6b6b80]">
              Navigation
            </h3>
            <ul className="space-y-2">
              {navigationLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#6b6b80] transition-colors hover:text-[#e8e8ed]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Discovery */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#6b6b80]">
              Discovery
            </h3>
            <ul className="space-y-2">
              {discoveryLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm font-mono text-[#00f0ff]/70 transition-colors hover:text-[#00f0ff]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Listed On */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#6b6b80]">
              Listed On
            </h3>
            <ul className="space-y-2">
              {listedOnLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#6b6b80] transition-colors hover:text-[#e8e8ed]"
                  >
                    {link.label} ↗
                  </a>
                </li>
              ))}
            </ul>
            <a
              href="https://aiagentsdirectory.com?utm_source=badge&utm_medium=referral&utm_campaign=free_listing&utm_content=homepage"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block"
            >
              <img
                src="https://aiagentsdirectory.com/featured-badge.svg?v=2024"
                alt="Featured AI Agents on AI Agents Directory"
                width={200}
                height={50}
              />
            </a>
          </div>

          {/* Tip Jar */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#6b6b80]">
              Tip Jar
            </h3>
            <ul className="space-y-2">
              {tipJarAddresses.map((entry) => (
                <li
                  key={entry.label}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="w-10 shrink-0 font-semibold text-[#ffaa00]">
                    {entry.label}
                  </span>
                  <span className="font-mono text-[#6b6b80] truncate">
                    {truncate(entry.address)}
                  </span>
                  <CopyButton text={entry.address} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-10 border-t border-[#1e1e2a] pt-6 text-center text-xs text-[#6b6b80]">
          &copy; 2026 AgentStamp. Built with x402 on Base.
        </div>
      </div>
    </footer>
  );
}
