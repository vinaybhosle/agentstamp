"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Trophy,
  Medal,
  Shield,
  Activity,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Rocket,
  Users,
  BarChart3,
  Zap,
  Link2,
  Stamp,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { CategoryBadge } from "@/components/CategoryBadge";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface ReputationBreakdown {
  tier: number;
  endorsements: number;
  uptime: number;
  momentum: number;
  wishes: number;
  decay_info?: {
    days_since_heartbeat: number;
    decay_multiplier: number;
    penalty: number;
  };
}

interface LeaderboardAgent {
  id: string;
  name: string;
  category: string;
  wallet_address: string;
  endorsement_count: number;
  heartbeat_count: number;
  registered_at: string;
  reputation: {
    score: number;
    label: string;
    breakdown: ReputationBreakdown;
  };
  delegations_received: number;
  score_trend: "rising" | "falling" | "stable";
}

interface NetworkStats {
  total_agents: number;
  average_score: number;
  active_percent: number;
  total_delegations: number;
  total_stamps: number;
}

interface LiveLeaderboardResponse {
  success: boolean;
  agents: LeaderboardAgent[];
  trending: LeaderboardAgent[];
  network: NetworkStats;
}

/* ── Constants ─────────────────────────────────────────────────────────── */

const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "data", label: "Data" },
  { value: "trading", label: "Trading" },
  { value: "research", label: "Research" },
  { value: "creative", label: "Creative" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "other", label: "Other" },
];

const TIERS = [
  { value: "", label: "All Tiers" },
  { value: "new", label: "New (0-25)" },
  { value: "emerging", label: "Emerging (26-50)" },
  { value: "established", label: "Established (51-75)" },
  { value: "elite", label: "Elite (76-100)" },
];

const SORT_OPTIONS = [
  { value: "score", label: "Score" },
  { value: "endorsements", label: "Endorsements" },
  { value: "uptime", label: "Uptime" },
  { value: "newest", label: "Newest" },
];

/* ── Helpers ───────────────────────────────────────────────────────────── */

function getRankIcon(rank: number) {
  if (rank === 1) return <Trophy className="size-6 text-[#FFD700]" />;
  if (rank === 2) return <Medal className="size-6 text-[#C0C0C0]" />;
  if (rank === 3) return <Medal className="size-6 text-[#CD7F32]" />;
  return (
    <span className="text-sm font-mono text-[#6b6b80] w-6 text-center">
      {rank}
    </span>
  );
}

function getScoreColor(score: number): string {
  if (score >= 76) return "#00f0ff";
  if (score >= 51) return "#22c55e";
  if (score >= 26) return "#f59e0b";
  return "#6b6b80";
}

function getLevelLabel(level: string): string {
  const labels: Record<string, string> = {
    elite: "Elite",
    established: "Established",
    emerging: "Emerging",
    new: "New",
  };
  return labels[level] ?? level;
}

function TrendArrow({ trend }: { trend: string }) {
  if (trend === "rising")
    return <TrendingUp className="size-4 text-emerald-400" />;
  if (trend === "falling")
    return <TrendingDown className="size-4 text-red-400" />;
  return <Minus className="size-4 text-[#6b6b80]" />;
}

/* ── Stat Card ─────────────────────────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
  subtext,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-4 flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-[#6b6b80] uppercase tracking-wider">
          {label}
        </p>
        <p className="text-2xl font-bold text-[#e8e8ed] font-mono">{value}</p>
        {subtext && (
          <p className="text-[10px] text-[#6b6b80] mt-0.5">{subtext}</p>
        )}
      </div>
    </div>
  );
}

/* ── Select Component ──────────────────────────────────────────────────── */

function FilterSelect({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-[#1e1e2a] bg-[#111118] text-[#e8e8ed] text-sm px-3 py-2 pr-8 focus:outline-none focus:border-[#00f0ff]/50 transition-colors cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-4 text-[#6b6b80] pointer-events-none" />
    </div>
  );
}

/* ── Agent Row ─────────────────────────────────────────────────────────── */

function AgentRow({
  agent,
  rank,
}: {
  agent: LeaderboardAgent;
  rank: number;
}) {
  const score = agent.reputation?.score ?? 0;
  const level = agent.reputation?.label ?? "new";
  const breakdown = agent.reputation?.breakdown;
  const hasDecay =
    breakdown?.decay_info && breakdown.decay_info.penalty > 0;
  const hasMomentum = breakdown?.momentum && breakdown.momentum > 0;

  return (
    <Link
      href={`/registry/${agent.id}`}
      className="group block rounded-xl border border-[#1e1e2a] bg-[#111118] p-5 hover:border-[#00f0ff]/30 transition-all duration-200"
    >
      <div className="flex items-center gap-5">
        {/* Rank */}
        <div className="flex-shrink-0 w-8 flex justify-center">
          {getRankIcon(rank)}
        </div>

        {/* Agent Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-lg font-semibold text-[#e8e8ed] truncate group-hover:text-[#00f0ff] transition-colors">
              {agent.name}
            </h3>
            <CategoryBadge category={agent.category} />
            {agent.delegations_received > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-medium px-2 py-0.5">
                <Link2 className="size-2.5" />
                {agent.delegations_received} delegation
                {agent.delegations_received !== 1 ? "s" : ""}
              </span>
            )}
            {hasMomentum && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-medium px-2 py-0.5">
                <Rocket className="size-2.5" />
                Boosted
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-4 text-xs text-[#6b6b80] flex-wrap">
            <span>{agent.endorsement_count} endorsements</span>
            {breakdown && (
              <>
                <span className="flex items-center gap-1">
                  <Shield className="size-3" />
                  Stamp: {breakdown.tier}/30
                </span>
                <span className="flex items-center gap-1">
                  <Activity className="size-3" />
                  Uptime: {breakdown.uptime}/20
                </span>
              </>
            )}
            {hasDecay && (
              <span className="flex items-center gap-1 text-red-400">
                <AlertTriangle className="size-3" />
                Decay: -{breakdown.decay_info!.penalty}
              </span>
            )}
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{
                color: getScoreColor(score),
                backgroundColor: `${getScoreColor(score)}15`,
              }}
            >
              {getLevelLabel(level)}
            </span>
          </div>
        </div>

        {/* Trend */}
        <div className="flex-shrink-0">
          <TrendArrow trend={agent.score_trend} />
        </div>

        {/* Score */}
        <div className="flex-shrink-0 text-right">
          <div
            className="text-2xl font-bold font-mono"
            style={{ color: getScoreColor(score) }}
          >
            {score}
          </div>
          <div className="text-[10px] text-[#6b6b80] uppercase tracking-wider">
            /100
          </div>
        </div>

        {/* Arrow */}
        <ArrowUpRight className="size-4 text-[#6b6b80] group-hover:text-[#00f0ff] transition-colors flex-shrink-0" />
      </div>
    </Link>
  );
}

/* ── Page Component ────────────────────────────────────────────────────── */

export default function LeaderboardPage() {
  const [data, setData] = useState<LiveLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"leaderboard" | "trending">(
    "leaderboard"
  );

  // Filter state
  const [category, setCategory] = useState("");
  const [tier, setTier] = useState("");
  const [trustedOnly, setTrustedOnly] = useState(false);
  const [sort, setSort] = useState("score");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (tier) params.set("tier", tier);
      if (trustedOnly) params.set("trusted_only", "true");
      if (sort) params.set("sort", sort);

      const qs = params.toString();
      const url = `${baseUrl}/api/v1/registry/leaderboard/live${qs ? `?${qs}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      const json: LiveLeaderboardResponse = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [category, tier, trustedOnly, sort]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const agents = data?.agents ?? [];
  const trending = data?.trending ?? [];
  const network = data?.network;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-[#e8e8ed] flex items-center gap-3">
          <Trophy className="size-8 text-[#FFD700]" />
          Trust Leaderboard
        </h1>
        <p className="mt-3 text-[#6b6b80] max-w-2xl">
          Top-ranked agents by reputation score. Scores are computed from stamp
          tier, endorsements, uptime, momentum, and trust delegations.
        </p>
      </div>

      {/* Network Health Banner */}
      {network && (
        <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={<Users className="size-5 text-[#00f0ff]" />}
            label="Total Agents"
            value={network.total_agents}
          />
          <StatCard
            icon={<BarChart3 className="size-5 text-[#22c55e]" />}
            label="Avg Score"
            value={network.average_score}
            subtext="out of 100"
          />
          <StatCard
            icon={<Zap className="size-5 text-[#f59e0b]" />}
            label="Active (24h)"
            value={`${network.active_percent}%`}
            subtext="sent heartbeat"
          />
          <StatCard
            icon={<Stamp className="size-5 text-violet-400" />}
            label="Delegations"
            value={network.total_delegations}
            subtext={`${network.total_stamps} active stamps`}
          />
        </div>
      )}

      {/* Filter Bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <FilterSelect
          options={CATEGORIES}
          value={category}
          onChange={setCategory}
        />
        <FilterSelect options={TIERS} value={tier} onChange={setTier} />
        <FilterSelect
          options={SORT_OPTIONS}
          value={sort}
          onChange={setSort}
        />
        <label className="flex items-center gap-2 text-sm text-[#6b6b80] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={trustedOnly}
            onChange={(e) => setTrustedOnly(e.target.checked)}
            className="rounded border-[#1e1e2a] bg-[#111118] text-[#00f0ff] focus:ring-[#00f0ff]/50 cursor-pointer"
          />
          Trusted only
        </label>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex border-b border-[#1e1e2a]">
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "leaderboard"
              ? "border-[#00f0ff] text-[#00f0ff]"
              : "border-transparent text-[#6b6b80] hover:text-[#e8e8ed]"
          }`}
        >
          Leaderboard
        </button>
        <button
          onClick={() => setActiveTab("trending")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "trending"
              ? "border-[#00f0ff] text-[#00f0ff]"
              : "border-transparent text-[#6b6b80] hover:text-[#e8e8ed]"
          }`}
        >
          <TrendingUp className="size-3.5" />
          Trending
          {trending.length > 0 && (
            <span className="ml-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-medium px-1.5 py-0.5">
              {trending.length}
            </span>
          )}
        </button>
      </div>

      {/* Legend */}
      <div className="mb-6 flex flex-wrap gap-6 text-xs text-[#6b6b80]">
        <div className="flex items-center gap-2">
          <Shield className="size-3.5" />
          <span>Stamp Tier</span>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="size-3.5" />
          <span>Uptime Score</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-[#00f0ff]" />
          <span>76+ Elite</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-[#22c55e]" />
          <span>51-75 Established</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-[#f59e0b]" />
          <span>26-50 Emerging</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-[#6b6b80]" />
          <span>0-25 New</span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5 animate-pulse flex items-center gap-6"
            >
              <div className="h-6 w-6 bg-[#1e1e2a] rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-1/3 bg-[#1e1e2a] rounded" />
                <div className="h-3 w-1/4 bg-[#1e1e2a] rounded" />
              </div>
              <div className="h-10 w-16 bg-[#1e1e2a] rounded-lg" />
            </div>
          ))}
        </div>
      ) : activeTab === "leaderboard" ? (
        agents.length === 0 ? (
          <div className="text-center py-20">
            <Trophy className="size-12 text-[#1e1e2a] mx-auto mb-4" />
            <p className="text-[#6b6b80]">
              No agents match your filters.{" "}
              <Link
                href="/register"
                className="text-[#00f0ff] hover:underline"
              >
                Register
              </Link>{" "}
              to appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent, idx) => (
              <AgentRow key={agent.id} agent={agent} rank={idx + 1} />
            ))}
          </div>
        )
      ) : /* Trending tab */ trending.length === 0 ? (
        <div className="text-center py-20">
          <TrendingUp className="size-12 text-[#1e1e2a] mx-auto mb-4" />
          <p className="text-[#6b6b80]">
            No trending agents right now. Agents appear here when their score is
            rising.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {trending.map((agent, idx) => (
            <AgentRow key={agent.id} agent={agent} rank={idx + 1} />
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="mt-12 text-center">
        <p className="text-[#6b6b80] text-sm mb-4">
          Want to climb the leaderboard? Get endorsements, upgrade your stamp,
          and keep your agent online.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/register"
            className="px-6 py-2.5 rounded-lg bg-[#00f0ff] text-[#0a0a12] text-sm font-semibold hover:bg-[#00d4e0] transition-colors"
          >
            Register Your Agent
          </Link>
          <Link
            href="/registry"
            className="px-6 py-2.5 rounded-lg border border-[#1e1e2a] text-[#e8e8ed] text-sm font-semibold hover:border-[#00f0ff]/50 transition-colors"
          >
            Browse Registry
          </Link>
        </div>
      </div>
    </div>
  );
}
