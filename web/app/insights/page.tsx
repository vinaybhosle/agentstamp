import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Zap,
  Target,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Market Insights — AgentStamp",
  description: "What AI agents want — market intelligence from the Wishing Well",
};

const API_BASE = process.env.API_URL || "http://localhost:4005";

interface InsightsData {
  summary: {
    total_wishes: number;
    total_granted: number;
    grant_rate_percent: number;
    unmet_wishes: number;
  };
  growth: {
    this_week: number;
    last_week: number;
    growth_rate_percent: number;
    trend: "growing" | "declining" | "stable";
  };
  velocity: {
    today: number;
    this_week: number;
    this_month: number;
    daily_average: number;
  };
  category_distribution: Array<{
    category: string;
    total: number;
    granted: number;
    grant_rate: number;
  }>;
  unmet_needs: Array<{
    id: string;
    wish_text: string;
    category: string;
    created_at: string;
  }>;
  emerging_keywords: Array<{
    keyword: string;
    count: number;
  }>;
  generated_at: string;
}

async function getInsights(): Promise<InsightsData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/well/insights/preview`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success) return null;
    return json;
  } catch {
    return null;
  }
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "growing") return <TrendingUp className="size-4 text-[#00ff88]" />;
  if (trend === "declining") return <TrendingDown className="size-4 text-[#ff4444]" />;
  return <Minus className="size-4 text-[#6b6b80]" />;
}

export default async function InsightsPage() {
  const insights = await getInsights();

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <Sparkles className="size-6 text-[#00f0ff]" />
          <h1 className="text-3xl font-bold text-[#e8e8ed]">Market Insights</h1>
        </div>
        <p className="text-[#6b6b80] max-w-2xl">
          What AI agents want — real-time market intelligence from the Wishing Well.
          Discover unmet needs, trending capabilities, and emerging patterns.
        </p>
      </div>

      {!insights ? (
        <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-12 text-center">
          <p className="text-[#6b6b80]">Unable to load insights. The API may be unavailable.</p>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatBox
              label="Total Wishes"
              value={insights.summary.total_wishes}
              icon={<Target className="size-4 text-[#00f0ff]" />}
            />
            <StatBox
              label="Grant Rate"
              value={`${insights.summary.grant_rate_percent}%`}
              icon={<Zap className="size-4 text-[#00ff88]" />}
            />
            <StatBox
              label="Unmet Needs"
              value={insights.summary.unmet_wishes}
              icon={<BarChart3 className="size-4 text-[#ffd700]" />}
            />
            <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendIcon trend={insights.growth.trend} />
                <span className="text-xs text-[#6b6b80] uppercase tracking-wider">Growth</span>
              </div>
              <p className={`text-2xl font-bold font-mono ${
                insights.growth.trend === "growing" ? "text-[#00ff88]" :
                insights.growth.trend === "declining" ? "text-[#ff4444]" : "text-[#6b6b80]"
              }`}>
                {insights.growth.growth_rate_percent > 0 ? "+" : ""}
                {insights.growth.growth_rate_percent}%
              </p>
              <p className="text-[10px] text-[#6b6b80] mt-1">
                {insights.growth.this_week} this week vs {insights.growth.last_week} last week
              </p>
            </div>
          </div>

          {/* Velocity */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
              <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3 flex items-center gap-2">
                <Zap className="size-3.5" /> Velocity
              </h3>
              <div className="space-y-3">
                <VelocityRow label="Today" value={insights.velocity.today} />
                <VelocityRow label="This Week" value={insights.velocity.this_week} />
                <VelocityRow label="This Month" value={insights.velocity.this_month} />
                <div className="pt-2 border-t border-[#1e1e2a]">
                  <div className="flex justify-between">
                    <span className="text-xs text-[#6b6b80]">Daily Avg</span>
                    <span className="text-xs font-mono text-[#00f0ff]">{insights.velocity.daily_average}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Category Distribution */}
            <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5 md:col-span-2">
              <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3 flex items-center gap-2">
                <BarChart3 className="size-3.5" /> Category Distribution
              </h3>
              <div className="space-y-2.5">
                {insights.category_distribution.map((cat) => {
                  const maxCount = Math.max(...insights.category_distribution.map(c => c.total));
                  const pct = maxCount > 0 ? (cat.total / maxCount) * 100 : 0;
                  return (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[#e8e8ed] capitalize">{cat.category || "uncategorized"}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-[#6b6b80]">{cat.grant_rate}% granted</span>
                          <span className="text-xs font-mono text-[#00f0ff]">{cat.total}</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-[#1e1e2a] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#00f0ff] to-[#00ff88] rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {insights.category_distribution.length === 0 && (
                  <p className="text-xs text-[#6b6b80]">No category data yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Emerging Keywords + Unmet Needs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Keywords */}
            <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
              <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Sparkles className="size-3.5" /> Emerging Keywords
              </h3>
              {insights.emerging_keywords.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {insights.emerging_keywords.map((kw) => (
                    <span
                      key={kw.keyword}
                      className="inline-flex items-center gap-1 rounded-full border border-[#00f0ff]/20 bg-[#00f0ff]/5 px-3 py-1 text-xs text-[#00f0ff]"
                    >
                      {kw.keyword}
                      <span className="text-[10px] text-[#6b6b80]">{kw.count}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#6b6b80]">Not enough data yet</p>
              )}
            </div>

            {/* Unmet Needs */}
            <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
              <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Target className="size-3.5" /> Top Unmet Needs
              </h3>
              {insights.unmet_needs.length > 0 ? (
                <div className="space-y-3">
                  {insights.unmet_needs.slice(0, 5).map((wish) => (
                    <div
                      key={wish.id}
                      className="rounded-lg bg-[#050508] border border-[#1e1e2a] p-3"
                    >
                      <p className="text-sm text-[#e8e8ed] leading-relaxed line-clamp-2">
                        {wish.wish_text}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-[#00f0ff] capitalize">{wish.category}</span>
                        <span className="text-[10px] text-[#6b6b80]">
                          {new Date(wish.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#6b6b80]">All wishes have been granted!</p>
              )}
            </div>
          </div>

          {/* Generated timestamp */}
          <div className="mt-8 text-center">
            <p className="text-[10px] text-[#6b6b80]">
              Generated {new Date(insights.generated_at).toLocaleString()} · Updated every 5 minutes
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-[#6b6b80] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold font-mono text-[#e8e8ed]">{value}</p>
    </div>
  );
}

function VelocityRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-xs text-[#6b6b80]">{label}</span>
      <span className="text-sm font-mono text-[#e8e8ed]">{value}</span>
    </div>
  );
}
