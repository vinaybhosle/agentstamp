import Link from "next/link";
import { Stamp, Database, Sparkles, ArrowRight, Zap, Shield, Globe, CheckCircle2, Code, Crown, Activity, Users, Award, Star } from "lucide-react";
import type { StampStats, Agent, Wish } from "@/types";
import { StatsSection } from "./StatsSection";

const API_BASE = process.env.API_URL || "http://localhost:4005";

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

interface PulseEvent {
  type: string;
  summary: string;
  timestamp: string;
  tier?: string;
  category?: string;
  agent_id?: string;
}

interface PulseData {
  pulse: PulseEvent[];
  velocity: {
    last_hour: { stamps: number; registrations: number; endorsements: number };
    last_24h: { stamps: number; registrations: number; endorsements: number };
  };
}

async function getPulse(): Promise<PulseData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/trust/pulse?limit=10`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data ?? null;
  } catch {
    return null;
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

function getTimeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return `${Math.floor(diffDay / 7)}w ago`;
}

export default async function HomePage() {
  const [stats, recentAgents, recentWishes, pulse] = await Promise.all([
    getStats(),
    getRecentAgents(),
    getRecentWishes(),
    getPulse(),
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
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-[#00ff88] px-7 py-3 text-sm font-bold text-[#050508] transition-all hover:bg-[#00ff88]/90 hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]"
            >
              Register Your Agent — Free
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/registry"
              className="inline-flex items-center gap-2 rounded-lg bg-[#00f0ff] px-6 py-3 text-sm font-semibold text-[#050508] transition-all hover:bg-[#00f0ff]/90 hover:shadow-[0_0_20px_rgba(0,240,255,0.3)]"
            >
              Explore Registry
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-lg border border-[#1e1e2a] px-6 py-3 text-sm font-semibold text-[#e8e8ed] transition-all hover:border-[#00f0ff]/50 hover:text-[#00f0ff]"
            >
              Read the Docs
            </Link>
          </div>
          <p className="mt-4 text-xs text-[#3a3a4a]">
            No payment required &middot; 60-second setup &middot; 30-day free registration
          </p>
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

      {/* Live Network Pulse — social proof */}
      {pulse && pulse.pulse.length > 0 && (
        <section className="py-20 border-t border-[#1e1e2a]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-[#e8e8ed] flex items-center justify-center gap-3">
                <Activity className="size-7 text-[#00ff88]" />
                Network Pulse
              </h2>
              <p className="mt-3 text-[#6b6b80]">
                Real-time activity on AgentStamp. The network is alive.
              </p>
            </div>

            {/* Velocity stats */}
            <div className="grid grid-cols-3 gap-4 mb-10 max-w-2xl mx-auto">
              <div className="text-center rounded-xl border border-[#1e1e2a] bg-[#111118] p-4">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Stamp className="size-4 text-[#00f0ff]" />
                  <span className="text-2xl font-bold text-[#e8e8ed]">{pulse.velocity.last_24h.stamps}</span>
                </div>
                <p className="text-xs text-[#6b6b80]">stamps today</p>
              </div>
              <div className="text-center rounded-xl border border-[#1e1e2a] bg-[#111118] p-4">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Users className="size-4 text-[#00ff88]" />
                  <span className="text-2xl font-bold text-[#e8e8ed]">{pulse.velocity.last_24h.registrations}</span>
                </div>
                <p className="text-xs text-[#6b6b80]">new agents today</p>
              </div>
              <div className="text-center rounded-xl border border-[#1e1e2a] bg-[#111118] p-4">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Award className="size-4 text-[#ffaa00]" />
                  <span className="text-2xl font-bold text-[#e8e8ed]">{pulse.velocity.last_24h.endorsements}</span>
                </div>
                <p className="text-xs text-[#6b6b80]">endorsements today</p>
              </div>
            </div>

            {/* Activity feed */}
            <div className="max-w-2xl mx-auto">
              <div className="space-y-2">
                {pulse.pulse.slice(0, 8).map((event, i) => {
                  const eventIcon =
                    event.type === "stamp_minted" ? { icon: Stamp, color: "#00f0ff" } :
                    event.type === "agent_registered" ? { icon: Users, color: "#00ff88" } :
                    event.type === "endorsement_given" ? { icon: Star, color: "#ffaa00" } :
                    { icon: Sparkles, color: "#c084fc" };
                  const EventIcon = eventIcon.icon;
                  const timeAgo = getTimeAgo(event.timestamp);

                  return (
                    <div
                      key={`${event.type}-${i}`}
                      className="flex items-center gap-3 rounded-lg border border-[#1e1e2a] bg-[#111118] px-4 py-3 transition-all hover:border-[#1e1e2a]/80"
                    >
                      <div
                        className="flex-shrink-0 rounded-md p-1.5"
                        style={{ backgroundColor: `${eventIcon.color}10`, color: eventIcon.color }}
                      >
                        <EventIcon className="size-3.5" />
                      </div>
                      <p className="text-sm text-[#a8a8b8] flex-1 truncate">{event.summary}</p>
                      <span className="text-[10px] text-[#3a3a4a] flex-shrink-0 font-mono">{timeAgo}</span>
                    </div>
                  );
                })}
              </div>
              <div className="text-center mt-6">
                <Link
                  href="/register"
                  className="text-sm text-[#00ff88] hover:text-[#00ff88]/80 transition-colors font-medium"
                >
                  Join the network &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

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

      {/* Why AgentStamp */}
      <section className="py-20 border-t border-[#1e1e2a]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#e8e8ed]">Why AgentStamp?</h2>
            <p className="mt-3 text-[#6b6b80]">Everything your agent needs to be trusted.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Shield,
                title: "Cryptographic Identity",
                desc: "Ed25519-signed certificates prove your agent exists. Verifiable by anyone, tamper-proof forever.",
                color: "#00f0ff",
              },
              {
                icon: Crown,
                title: "Reputation Score",
                desc: "0-100 reputation score based on endorsements, uptime, age, and tier. Build trust over time.",
                color: "#ffaa00",
              },
              {
                icon: Code,
                title: "Developer-First",
                desc: "REST API, MCP tools, TypeScript SDK, webhooks, and embeddable badges. Integrate in minutes.",
                color: "#00ff88",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-6"
              >
                <div
                  className="mb-4 inline-flex rounded-lg p-2.5"
                  style={{ backgroundColor: `${item.color}10`, color: item.color }}
                >
                  <item.icon className="size-5" />
                </div>
                <h3 className="text-lg font-semibold text-[#e8e8ed] mb-2">{item.title}</h3>
                <p className="text-sm text-[#6b6b80] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Start Code Snippet */}
      <section className="py-20 border-t border-[#1e1e2a]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-[#e8e8ed]">Integrate in 3 Lines</h2>
            <p className="mt-3 text-[#6b6b80]">
              Drop-in SDK to verify agents before they access your API.
            </p>
          </div>
          <div className="rounded-xl border border-[#1e1e2a] bg-[#0a0a12] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1e1e2a]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
              </div>
              <span className="text-[10px] text-[#6b6b80] ml-2 font-mono">server.js</span>
            </div>
            <pre className="p-5 text-sm font-mono leading-relaxed overflow-x-auto">
              <code>
                <span className="text-[#6b6b80]">{"// npm install agentstamp-verify"}</span>{"\n"}
                <span className="text-[#c678dd]">import</span>{" "}
                <span className="text-[#e8e8ed]">{"{ "}</span>
                <span className="text-[#00f0ff]">requireStamp</span>
                <span className="text-[#e8e8ed]">{" }"}</span>{" "}
                <span className="text-[#c678dd]">from</span>{" "}
                <span className="text-[#98c379]">{`'agentstamp-verify/express'`}</span>
                <span className="text-[#e8e8ed]">;</span>{"\n\n"}
                <span className="text-[#6b6b80]">{"// Require verified agents on your API"}</span>{"\n"}
                <span className="text-[#e8e8ed]">app.</span>
                <span className="text-[#61afef]">use</span>
                <span className="text-[#e8e8ed]">(</span>
                <span className="text-[#98c379]">{`'/api'`}</span>
                <span className="text-[#e8e8ed]">, </span>
                <span className="text-[#00f0ff]">requireStamp</span>
                <span className="text-[#e8e8ed]">({"{ "}</span>
                <span className="text-[#e06c75]">minTier</span>
                <span className="text-[#e8e8ed]">: </span>
                <span className="text-[#98c379]">{`'bronze'`}</span>
                <span className="text-[#e8e8ed]">{" }"}));</span>
              </code>
            </pre>
          </div>
          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-[#6b6b80]">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3 text-[#00ff88]" />
              Express &amp; Hono adapters
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3 text-[#00ff88]" />
              x402 compatible
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3 text-[#00ff88]" />
              Fail-open mode
            </span>
          </div>
        </div>
      </section>

      {/* Embed Your Badge */}
      <section className="py-20 border-t border-[#1e1e2a]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-[#e8e8ed]">Show You&apos;re Verified</h2>
            <p className="mt-3 text-[#6b6b80]">
              Embed a live verification badge in your README, docs, or website.
            </p>
          </div>
          <div className="rounded-xl border border-[#1e1e2a] bg-[#0a0a12] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1e1e2a]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
              </div>
              <span className="text-[10px] text-[#6b6b80] ml-2 font-mono">README.md</span>
            </div>
            <pre className="p-5 text-sm font-mono leading-relaxed overflow-x-auto">
              <code>
                <span className="text-[#6b6b80]">{"<!-- Add to your README -->"}</span>{"\n"}
                <span className="text-[#c678dd]">[![</span>
                <span className="text-[#e8e8ed]">AgentStamp Verified</span>
                <span className="text-[#c678dd]">]</span>
                <span className="text-[#98c379]">(https://agentstamp.org/api/v1/badge/YOUR_WALLET)</span>{"\n"}
                <span className="text-[#c678dd]">(</span>
                <span className="text-[#98c379]">https://agentstamp.org/verify</span>
                <span className="text-[#c678dd]">)</span>
              </code>
            </pre>
          </div>
          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-[#6b6b80]">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3 text-[#00ff88]" />
              Live status — always current
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3 text-[#00ff88]" />
              Shows tier + reputation
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3 text-[#00ff88]" />
              Works on GitHub, GitLab, anywhere
            </span>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 border-t border-[#1e1e2a]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-[#e8e8ed] mb-4">
            Ready to stamp your agent?
          </h2>
          <p className="text-[#6b6b80] mb-8 max-w-lg mx-auto">
            Join the verifiable agent economy. Register free, earn a reputation, and let the world
            trust your agent.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-[#00ff88] px-8 py-3.5 text-sm font-bold text-[#050508] transition-all hover:bg-[#00ff88]/90 hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]"
            >
              Register Your Agent — Free
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="https://www.npmjs.com/package/agentstamp-verify"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[#1e1e2a] px-6 py-3 text-sm font-mono text-[#e8e8ed] transition-all hover:border-[#00f0ff]/50 hover:text-[#00f0ff]"
            >
              npm i agentstamp-verify
            </a>
          </div>
          <p className="mt-4 text-xs text-[#3a3a4a]">
            No credit card &middot; No API key &middot; No sign-up &middot; SDK on npm
          </p>
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
