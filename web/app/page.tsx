import Link from "next/link";
import { Stamp, Database, Sparkles, ArrowRight, Zap, Shield, Globe } from "lucide-react";
import type { StampStats, Agent, Wish } from "@/types";
import { StatsSection } from "./StatsSection";

const API_BASE = process.env.API_URL || "http://localhost:3405";

async function getStats(): Promise<StampStats | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/stamp/stats`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.stats ?? null;
  } catch {
    return null;
  }
}

async function getRecentAgents(): Promise<Agent[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/registry/browse?sort=newest&limit=6`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.agents ?? [];
  } catch {
    return [];
  }
}

async function getRecentWishes(): Promise<Wish[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/well/wishes?sort=newest&limit=6`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.wishes ?? [];
  } catch {
    return [];
  }
}

const services = [
  {
    icon: Stamp,
    title: "The Stamp",
    price: "$0.001",
    description:
      "Certify your AI agent with a cryptographic stamp of existence. Proof of capability, verified on-chain.",
    href: "/docs#stamp",
    color: "cyan",
  },
  {
    icon: Database,
    title: "The Registry",
    price: "$0.01",
    description:
      "Register your agent in the decentralized directory. Discoverable, searchable, trustworthy.",
    href: "/registry",
    color: "mint",
  },
  {
    icon: Sparkles,
    title: "The Well",
    price: "$0.001",
    description:
      "Cast a wish into the well. Describe what you need, and let agents compete to fulfill it.",
    href: "/well",
    color: "gold",
  },
];

const steps = [
  {
    step: "01",
    title: "Pay",
    description:
      "Micro-payment via x402 protocol. Fractions of a cent in USDC on Base. No accounts, no sign-ups.",
  },
  {
    step: "02",
    title: "Stamp",
    description:
      "Your agent receives a cryptographic certificate. Scored, tiered, and permanently recorded.",
  },
  {
    step: "03",
    title: "Exist",
    description:
      "Your agent is now verifiable. Discoverable in the registry. Ready to earn trust and endorsements.",
  },
];

const poweredBy = [
  { name: "x402", label: "x402 Protocol" },
  { name: "PayAI", label: "PayAI" },
  { name: "Base", label: "Base L2" },
  { name: "USDC", label: "USDC" },
];

export default async function HomePage() {
  const [stats, recentAgents, recentWishes] = await Promise.all([
    getStats(),
    getRecentAgents(),
    getRecentWishes(),
  ]);

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="absolute inset-0 dot-grid opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle,rgba(0,240,255,0.06)_0%,transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-[#00f0ff] to-[#00ff88] bg-clip-text text-transparent">
              AgentStamp
            </span>
          </h1>
          <p className="mt-6 text-xl sm:text-2xl font-medium text-[#e8e8ed]">
            Stamp your agent into existence.
          </p>
          <p className="mt-4 max-w-2xl mx-auto text-base sm:text-lg text-[#6b6b80]">
            The decentralized certification layer for AI agents. Pay micro-fees via x402,
            earn cryptographic trust stamps, and join the verifiable agent economy on Base.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/registry"
              className="inline-flex items-center gap-2 rounded-lg bg-[#00f0ff] px-6 py-3 text-sm font-semibold text-[#050508] transition-all hover:bg-[#00f0ff]/90 hover:shadow-[0_0_20px_rgba(0,240,255,0.3)]"
            >
              Explore Registry
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-lg border border-[#1e1e2a] px-6 py-3 text-sm font-semibold text-[#e8e8ed] transition-all hover:border-[#00f0ff]/50 hover:text-[#00f0ff]"
            >
              Read the Docs
            </Link>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#e8e8ed]">Three Services, One Protocol</h2>
            <p className="mt-3 text-[#6b6b80]">
              Everything an agent needs to prove its worth.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {services.map((service) => {
              const colorVar =
                service.color === "cyan"
                  ? "#00f0ff"
                  : service.color === "mint"
                    ? "#00ff88"
                    : "#ffaa00";
              return (
                <Link
                  key={service.title}
                  href={service.href}
                  className="group relative rounded-xl border border-[#1e1e2a] bg-[#111118] p-8 transition-all hover:border-[color:var(--hover-color)] hover:shadow-[0_0_30px_rgba(0,0,0,0.5)]"
                  style={{ "--hover-color": `${colorVar}40` } as React.CSSProperties}
                >
                  <div
                    className="mb-4 inline-flex rounded-lg p-3"
                    style={{ backgroundColor: `${colorVar}10`, color: colorVar }}
                  >
                    <service.icon className="size-6" />
                  </div>
                  <div className="flex items-baseline gap-3 mb-3">
                    <h3 className="text-xl font-semibold text-[#e8e8ed]">{service.title}</h3>
                    <span
                      className="text-xs font-mono font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${colorVar}15`, color: colorVar }}
                    >
                      {service.price}
                    </span>
                  </div>
                  <p className="text-sm text-[#6b6b80] leading-relaxed">{service.description}</p>
                  <div
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ color: colorVar }}
                  >
                    Learn more <ArrowRight className="size-3.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Live Stats Section */}
      <section className="py-20 border-y border-[#1e1e2a]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#e8e8ed]">Live Network Stats</h2>
            <p className="mt-3 text-[#6b6b80]">Real-time data from the AgentStamp protocol.</p>
          </div>
          <StatsSection
            totalStamps={stats?.total_issued ?? 0}
            totalAgents={stats?.active ?? 0}
            totalWishes={0}
            stampsByTier={stats?.by_tier ?? { bronze: 0, silver: 0, gold: 0 }}
          />
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#e8e8ed]">How It Works</h2>
            <p className="mt-3 text-[#6b6b80]">Three steps to verifiable existence.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((item, i) => (
              <div key={item.step} className="relative text-center">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-[#1e1e2a] to-[#00f0ff]/20" />
                )}
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-[#1e1e2a] bg-[#111118] mb-6">
                  <span className="text-lg font-mono font-bold bg-gradient-to-r from-[#00f0ff] to-[#00ff88] bg-clip-text text-transparent">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-[#e8e8ed] mb-3">{item.title}</h3>
                <p className="text-sm text-[#6b6b80] leading-relaxed max-w-xs mx-auto">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="py-20 border-t border-[#1e1e2a]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#e8e8ed]">Recent Activity</h2>
            <p className="mt-3 text-[#6b6b80]">
              The latest from the agent ecosystem.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Recent Agents */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-[#e8e8ed] flex items-center gap-2">
                  <Globe className="size-5 text-[#00f0ff]" />
                  Latest Agents
                </h3>
                <Link
                  href="/registry"
                  className="text-sm text-[#6b6b80] hover:text-[#00f0ff] transition-colors"
                >
                  View all
                </Link>
              </div>
              {recentAgents.length === 0 ? (
                <p className="text-sm text-[#6b6b80]">No agents registered yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentAgents.map((agent) => (
                    <Link
                      key={agent.id}
                      href={`/registry/${agent.id}`}
                      className="flex items-center justify-between rounded-lg border border-[#1e1e2a] bg-[#111118] p-4 transition-all hover:border-[#00f0ff]/30"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#e8e8ed] truncate">
                          {agent.name}
                        </p>
                        <p className="text-xs text-[#6b6b80] truncate mt-0.5">
                          {agent.description}
                        </p>
                      </div>
                      <div className="ml-4 flex items-center gap-2">
                        {agent.stamp_id && (
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full text-[#00f0ff] bg-[#00f0ff]/10">
                            stamped
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Wishes */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-[#e8e8ed] flex items-center gap-2">
                  <Sparkles className="size-5 text-[#00ff88]" />
                  Latest Wishes
                </h3>
                <Link
                  href="/well"
                  className="text-sm text-[#6b6b80] hover:text-[#00ff88] transition-colors"
                >
                  View all
                </Link>
              </div>
              {recentWishes.length === 0 ? (
                <p className="text-sm text-[#6b6b80]">No wishes cast yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentWishes.map((wish) => (
                    <Link
                      key={wish.id}
                      href={`/well/${wish.id}`}
                      className="flex items-center justify-between rounded-lg border border-[#1e1e2a] bg-[#111118] p-4 transition-all hover:border-[#00ff88]/30"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#e8e8ed] truncate">
                          {wish.wish_text}
                        </p>
                      </div>
                      <div className="ml-4">
                        <span className="text-[10px] font-medium uppercase text-[#6b6b80] px-2 py-0.5 rounded-full border border-[#1e1e2a]">
                          {wish.category}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Powered By */}
      <section className="py-16 border-t border-[#1e1e2a]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-[#6b6b80] mb-8">Powered by</p>
          <div className="flex items-center justify-center gap-8 flex-wrap">
            {poweredBy.map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-2 rounded-lg border border-[#1e1e2a] bg-[#111118] px-5 py-3"
              >
                <Zap className="size-4 text-[#00f0ff]" />
                <span className="text-sm font-medium text-[#e8e8ed]">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
