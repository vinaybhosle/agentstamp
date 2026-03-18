"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Trophy, Medal, Shield, Activity, ArrowUpRight } from "lucide-react";
import { CategoryBadge } from "@/components/CategoryBadge";

interface LeaderboardAgent {
  id: string;
  name: string;
  category: string;
  endorsement_count: number;
  registered_at: string;
  reputation?: {
    score: number;
    level: string;
    breakdown: {
      stamp_tier: number;
      endorsements: number;
      uptime: number;
      age: number;
    };
  };
}

const TIER_COLORS: Record<string, string> = {
  gold: "#FFD700",
  silver: "#C0C0C0",
  bronze: "#CD7F32",
  free: "#6b6b80",
};

function getRankIcon(rank: number) {
  if (rank === 1)
    return <Trophy className="size-6 text-[#FFD700]" />;
  if (rank === 2)
    return <Medal className="size-6 text-[#C0C0C0]" />;
  if (rank === 3)
    return <Medal className="size-6 text-[#CD7F32]" />;
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
    trusted: "Trusted",
    established: "Established",
    emerging: "Emerging",
    new: "New",
  };
  return labels[level] ?? level;
}

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<LeaderboardAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const res = await fetch(`${baseUrl}/api/v1/registry/leaderboard`);
        if (!res.ok) throw new Error("Failed to fetch leaderboard");
        const json = await res.json();

        const endorsed: LeaderboardAgent[] =
          json.leaderboard?.top_endorsed ?? [];

        // Fetch reputation for each agent in parallel
        const withReputation = await Promise.all(
          endorsed.map(async (agent) => {
            try {
              const repRes = await fetch(
                `${baseUrl}/api/v1/registry/agent/${agent.id}/reputation`
              );
              if (repRes.ok) {
                const repJson = await repRes.json();
                return { ...agent, reputation: repJson.reputation ?? null };
              }
            } catch {
              // ignore
            }
            return agent;
          })
        );

        // Sort by reputation score (descending), then by endorsements
        const sorted = [...withReputation].sort((a, b) => {
          const scoreA = a.reputation?.score ?? 0;
          const scoreB = b.reputation?.score ?? 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          return b.endorsement_count - a.endorsement_count;
        });

        setAgents(sorted);
      } catch {
        setAgents([]);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, []);

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
          tier, endorsements, uptime, and account age.
        </p>
      </div>

      {/* Legend */}
      <div className="mb-8 flex flex-wrap gap-6 text-xs text-[#6b6b80]">
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
          <span>76+ Trusted</span>
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

      {/* Table */}
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
      ) : agents.length === 0 ? (
        <div className="text-center py-20">
          <Trophy className="size-12 text-[#1e1e2a] mx-auto mb-4" />
          <p className="text-[#6b6b80]">
            No agents on the leaderboard yet. Be the first to{" "}
            <Link href="/register" className="text-[#00f0ff] hover:underline">
              register
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent, idx) => {
            const rank = idx + 1;
            const score = agent.reputation?.score ?? 0;
            const level = agent.reputation?.level ?? "new";
            const breakdown = agent.reputation?.breakdown;

            return (
              <Link
                key={agent.id}
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
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-[#e8e8ed] truncate group-hover:text-[#00f0ff] transition-colors">
                        {agent.name}
                      </h3>
                      <CategoryBadge category={agent.category} />
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-[#6b6b80]">
                      <span>{agent.endorsement_count} endorsements</span>
                      {breakdown && (
                        <>
                          <span className="flex items-center gap-1">
                            <Shield className="size-3" />
                            Stamp: {breakdown.stamp_tier}/30
                          </span>
                          <span className="flex items-center gap-1">
                            <Activity className="size-3" />
                            Uptime: {breakdown.uptime}/20
                          </span>
                        </>
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
          })}
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
