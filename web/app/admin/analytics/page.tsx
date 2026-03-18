"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  TrendingUp,
  Shield,
  Users,
  Heart,
  Star,
  Coins,
  Activity,
  Database,
  Clock,
  LogOut,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Wallet,
  Award,
  Zap,
  Target,
  ArrowUpRight,
  Hash,
  Layers,
  Sparkles,
  Bell,
  ArrowDownRight,
  Filter,
  GitBranch,
  Globe,
  Eye,
  Bot,
  MonitorSmartphone,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────
interface AnalyticsData {
  generated_at: string;
  period: { days: number; start: string; end: string };
  revenue: {
    total_usdc: number;
    today: number;
    this_week: number;
    this_month: number;
    total_transactions: number;
    average_transaction: number;
    unique_wallets: number;
    monthly_projection: number;
    by_action: Array<{ action: string; count: number; total_usdc: number }>;
    by_day: Array<{ date: string; count: number; total_usdc: number }>;
    top_payers: Array<{
      wallet_address: string;
      transaction_count: number;
      total_usdc: number;
    }>;
  };
  stamps: {
    total: number;
    active: number;
    expired: number;
    revoked: number;
    today: number;
    this_week: number;
    this_month: number;
    by_tier: Record<string, number>;
    expiring_soon: number;
    by_day: Array<{ date: string; count: number }>;
  };
  agents: {
    total: number;
    active: number;
    expired: number;
    today: number;
    this_week: number;
    this_month: number;
    by_category: Record<string, number>;
    with_stamps: number;
    without_stamps: number;
    average_endorsements: number;
    by_day: Array<{ date: string; count: number }>;
  };
  endorsements: {
    total: number;
    today: number;
    this_week: number;
    this_month: number;
    unique_endorsers: number;
    most_endorsed: Array<{
      agent_id: string;
      name: string;
      count: number;
    }>;
    top_endorsers: Array<{ wallet: string; count: number }>;
    by_day: Array<{ date: string; count: number }>;
  };
  reputation: {
    average_score: number;
    distribution: Record<string, number>;
    top_agents: Array<{
      agent_id: string;
      name: string;
      score: number;
      label: string;
    }>;
  };
  wishes: {
    total: number;
    granted: number;
    unmet: number;
    grant_rate: number;
    today: number;
    this_week: number;
    this_month: number;
    by_category: Array<{
      category: string;
      total: number;
      granted: number;
    }>;
    top_wishes: Array<{
      id: string;
      wish_text: string;
      category: string;
      grant_count: number;
    }>;
    top_wishers: Array<{ wallet: string; count: number }>;
    by_day: Array<{ date: string; count: number }>;
    grants_by_day: Array<{ date: string; count: number }>;
  };
  heartbeats: {
    total: number;
    today: number;
    this_week: number;
    active_agents_today: number;
  };
  funnel: {
    free_stamps: number;
    paid_stamps: number;
    free_stamps_month: number;
    paid_stamps_month: number;
    free_registrations: number;
    paid_registrations: number;
    total_free_users: number;
    total_paying_users: number;
    stamp_upgrades: number;
    reg_upgrades: number;
    stamp_conversion_rate: number;
    reg_conversion_rate: number;
    free_stamps_by_day: Array<{ date: string; count: number }>;
    paid_stamps_by_day: Array<{ date: string; count: number }>;
  };
  webhooks_stats: {
    total: number;
    active: number;
    inactive: number;
    event_distribution: Record<string, number>;
    recent: Array<{
      id: string;
      wallet_address: string;
      url: string;
      events: string;
      active: number;
      created_at: string;
    }>;
  };
  traffic: {
    total_hits: number;
    today: number;
    this_week: number;
    this_month: number;
    unique_visitors: number;
    unique_visitors_today: number;
    unique_visitors_week: number;
    bot_hits: number;
    human_hits: number;
    bot_ratio: number;
    identified_hits: number;
    unique_wallet_visitors: number;
    top_endpoints: Array<{
      path: string;
      method: string;
      hits: number;
      avg_response_ms: number;
      errors: number;
    }>;
    endpoint_groups: Array<{
      route: string;
      method: string;
      hits: number;
      unique_visitors: number;
      avg_ms: number;
    }>;
    by_day: Array<{
      date: string;
      hits: number;
      visitors: number;
      bot_hits: number;
      human_hits: number;
    }>;
    by_hour: Array<{ hour: string; hits: number }>;
    top_user_agents: Array<{
      user_agent: string;
      hits: number;
      is_bot: number;
    }>;
    top_referrers: Array<{ referrer: string; hits: number }>;
    response_time: { avg_ms: number; min_ms: number; max_ms: number };
    status_codes: Record<string, number>;
    error_rate: number;
  };
  system: {
    db_size_mb: number;
    tables: Record<string, number>;
    server_start: number | null;
  };
  recent_activity: {
    transactions: Array<{
      id: string;
      endpoint: string;
      wallet_address: string;
      amount: string;
      action: string;
      reference_id: string;
      created_at: string;
    }>;
    agents: Array<{
      id: string;
      name: string;
      category: string;
      wallet_address: string;
      created_at: string;
    }>;
    stamps: Array<{
      id: string;
      wallet_address: string;
      tier: string;
      issued_at: string;
      expires_at: string;
    }>;
  };
}

// ─── Helpers ────────────────────────────────────────────
function truncateWallet(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatUSDC(amount: number) {
  if (amount >= 1) return `$${amount.toFixed(2)}`;
  if (amount >= 0.01) return `$${amount.toFixed(3)}`;
  return `$${amount.toFixed(6)}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatUptime(seconds: number | null) {
  if (!seconds) return "N/A";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const tierColors: Record<string, string> = {
  free: "#a855f7",
  bronze: "#cd7f32",
  silver: "#c0c0c0",
  gold: "#ffd700",
};

const funnelStages = [
  { key: "free_users", label: "Free Users", color: "#a855f7" },
  { key: "free_stamps", label: "Free Stamps", color: "#00f0ff" },
  { key: "paid_users", label: "Paid Users", color: "#00ff88" },
  { key: "paid_stamps", label: "Paid Stamps", color: "#ffd700" },
];

const actionLabels: Record<string, string> = {
  stamp_mint: "Stamp Mint",
  register: "Registration",
  endorse: "Endorsement",
  cast_wish: "Wish Cast",
  grant_wish: "Wish Grant",
  insights: "Insights",
  update: "Agent Update",
};

// ─── Components ─────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon,
  color = "#00f0ff",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-4 hover:border-[#2a2a3a] transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-[10px] text-[#6b6b80] uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold font-mono text-[#e8e8ed]">{value}</p>
      {sub && <p className="text-[10px] text-[#6b6b80] mt-1">{sub}</p>}
    </div>
  );
}

function MiniBar({
  label,
  value,
  max,
  color = "#00f0ff",
  suffix = "",
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
  suffix?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[#e8e8ed] capitalize">{label}</span>
        <span className="text-xs font-mono" style={{ color }}>
          {value}
          {suffix}
        </span>
      </div>
      <div className="w-full h-1.5 bg-[#1e1e2a] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  collapsible,
  collapsed,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 mb-4 w-full text-left group"
      disabled={!collapsible}
    >
      {icon}
      <h2 className="text-sm font-semibold text-[#e8e8ed] uppercase tracking-wider">
        {title}
      </h2>
      {collapsible && (
        <span className="ml-auto text-[#6b6b80] group-hover:text-[#e8e8ed] transition-colors">
          {collapsed ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronUp className="size-4" />
          )}
        </span>
      )}
    </button>
  );
}

function SparkLine({
  data,
  color = "#00f0ff",
  height = 40,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const width = 200;
  const points = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * width;
    const y = height - (v / max) * (height - 4);
    return `${x},${y}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height }}
      preserveAspectRatio="none"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={`0,${height} ${points.join(" ")} ${width},${height}`}
        fill={`${color}15`}
        stroke="none"
      />
    </svg>
  );
}

function FunnelStep({
  label,
  value,
  maxValue,
  color,
  conversionRate,
  isLast,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  conversionRate?: number;
  isLast?: boolean;
}) {
  const widthPct = maxValue > 0 ? Math.max((value / maxValue) * 100, 8) : 8;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[#e8e8ed]">{label}</span>
          <span className="text-xs font-mono" style={{ color }}>
            {value}
          </span>
        </div>
        <div className="w-full h-6 bg-[#1e1e2a] rounded-md overflow-hidden">
          <div
            className="h-full rounded-md transition-all duration-700 flex items-center justify-end pr-2"
            style={{
              width: `${widthPct}%`,
              backgroundColor: `${color}30`,
              borderLeft: `3px solid ${color}`,
            }}
          >
            {widthPct > 20 && (
              <span className="text-[10px] font-mono" style={{ color }}>
                {((value / Math.max(maxValue, 1)) * 100).toFixed(0)}%
              </span>
            )}
          </div>
        </div>
      </div>
      {!isLast && conversionRate !== undefined && (
        <div className="w-16 text-center shrink-0">
          <ArrowDownRight className="size-3 text-[#6b6b80] mx-auto" />
          <span className="text-[10px] font-mono text-[#00ff88]">
            {conversionRate}%
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────
export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const router = useRouter();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/analytics?days=${days}`);
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [days, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  function toggle(section: string) {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-[#6b6b80]">
          <RefreshCw className="size-5 animate-spin" />
          <span className="text-sm">Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#ff4444] mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 rounded-lg bg-[#111118] border border-[#1e1e2a] text-sm text-[#e8e8ed] hover:border-[#00f0ff] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const totalRows = Object.values(data.system.tables).reduce(
    (s, v) => s + v,
    0
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* ─── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <BarChart3 className="size-6 text-[#00f0ff]" />
            <h1 className="text-2xl font-bold text-[#e8e8ed]">
              Analytics Dashboard
            </h1>
          </div>
          <p className="text-xs text-[#6b6b80]">
            Last updated{" "}
            {new Date(data.generated_at).toLocaleString()}
            {loading && " (refreshing...)"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex rounded-lg border border-[#1e1e2a] overflow-hidden">
            {[
              { label: "7D", value: 7 },
              { label: "30D", value: 30 },
              { label: "90D", value: 90 },
              { label: "ALL", value: 365 },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  days === opt.value
                    ? "bg-[#00f0ff]/10 text-[#00f0ff]"
                    : "text-[#6b6b80] hover:text-[#e8e8ed] hover:bg-[#1e1e2a]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            className="p-2 rounded-lg border border-[#1e1e2a] text-[#6b6b80] hover:text-[#00f0ff] hover:border-[#00f0ff] transition-colors"
            title="Refresh"
          >
            <RefreshCw
              className={`size-4 ${loading ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg border border-[#1e1e2a] text-[#6b6b80] hover:text-[#ff4444] hover:border-[#ff4444] transition-colors"
            title="Logout"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>

      {/* ─── Top-Level Overview Cards ────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-3 mb-8">
        <StatCard
          label="API Hits"
          value={data.traffic?.total_hits ?? 0}
          sub={`${data.traffic?.today ?? 0} today`}
          icon={<Globe className="size-4" />}
          color="#60a5fa"
        />
        <StatCard
          label="Visitors"
          value={data.traffic?.unique_visitors ?? 0}
          sub={`${data.traffic?.unique_visitors_today ?? 0} today`}
          icon={<Eye className="size-4" />}
          color="#c084fc"
        />
        <StatCard
          label="Revenue"
          value={formatUSDC(data.revenue.total_usdc)}
          sub={`${data.revenue.total_transactions} txns`}
          icon={<Coins className="size-4" />}
          color="#00ff88"
        />
        <StatCard
          label="Stamps"
          value={data.stamps.total}
          sub={`${data.stamps.active} active`}
          icon={<Shield className="size-4" />}
          color="#00f0ff"
        />
        <StatCard
          label="Agents"
          value={data.agents.total}
          sub={`${data.agents.active} active`}
          icon={<Users className="size-4" />}
          color="#a855f7"
        />
        <StatCard
          label="Conversion"
          value={`${data.funnel.stamp_conversion_rate}%`}
          sub={`${data.funnel.stamp_upgrades} upgrades`}
          icon={<Filter className="size-4" />}
          color="#ff6b6b"
        />
        <StatCard
          label="Endorsements"
          value={data.endorsements.total}
          sub={`${data.endorsements.unique_endorsers} endorsers`}
          icon={<Heart className="size-4" />}
          color="#ff6b6b"
        />
        <StatCard
          label="Wishes"
          value={data.wishes.total}
          sub={`${data.wishes.grant_rate}% granted`}
          icon={<Sparkles className="size-4" />}
          color="#ffd700"
        />
        <StatCard
          label="Webhooks"
          value={data.webhooks_stats.total}
          sub={`${data.webhooks_stats.active} active`}
          icon={<Bell className="size-4" />}
          color="#ff6b6b"
        />
        <StatCard
          label="Reputation"
          value={data.reputation.average_score}
          sub="avg score"
          icon={<Star className="size-4" />}
          color="#ffaa00"
        />
      </div>

      {/* ═══════════════ TRAFFIC & VISITORS SECTION ═══════════════ */}
      {data.traffic && (
        <section className="mb-8">
          <SectionHeader
            icon={<Globe className="size-4 text-[#60a5fa]" />}
            title="Traffic & Visitors"
            collapsible
            collapsed={collapsed.traffic}
            onToggle={() => toggle("traffic")}
          />
          {!collapsed.traffic && (
            <div className="space-y-4">
              {/* Traffic KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <StatCard
                  label="Total Hits"
                  value={data.traffic.total_hits}
                  sub={`${data.traffic.today} today`}
                  icon={<Globe className="size-3.5" />}
                  color="#60a5fa"
                />
                <StatCard
                  label="Unique Visitors"
                  value={data.traffic.unique_visitors}
                  sub={`${data.traffic.unique_visitors_today} today`}
                  icon={<Eye className="size-3.5" />}
                  color="#c084fc"
                />
                <StatCard
                  label="Bot Traffic"
                  value={`${data.traffic.bot_ratio}%`}
                  sub={`${data.traffic.bot_hits} bot hits`}
                  icon={<Bot className="size-3.5" />}
                  color="#f59e0b"
                />
                <StatCard
                  label="Human Traffic"
                  value={data.traffic.human_hits}
                  sub={`${(100 - data.traffic.bot_ratio).toFixed(1)}%`}
                  icon={<MonitorSmartphone className="size-3.5" />}
                  color="#00ff88"
                />
                <StatCard
                  label="Identified"
                  value={data.traffic.unique_wallet_visitors}
                  sub={`${data.traffic.identified_hits} hits w/ wallet`}
                  icon={<Wallet className="size-3.5" />}
                  color="#00f0ff"
                />
                <StatCard
                  label="Error Rate"
                  value={`${data.traffic.error_rate}%`}
                  sub={`avg ${data.traffic.response_time?.avg_ms ?? 0}ms`}
                  icon={<Activity className="size-3.5" />}
                  color={data.traffic.error_rate > 5 ? "#ff4444" : "#00ff88"}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Daily Traffic Chart */}
                <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                  <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                    Daily Traffic (Hits vs Visitors)
                  </h3>
                  <div className="h-36 flex items-end gap-[2px]">
                    {data.traffic.by_day.slice(-30).map((d, i) => {
                      const maxHits = Math.max(
                        ...data.traffic.by_day.slice(-30).map((x) => x.hits),
                        1
                      );
                      return (
                        <div
                          key={i}
                          className="flex-1 flex flex-col justify-end gap-[1px]"
                          title={`${d.date}\n${d.hits} hits, ${d.visitors} visitors\n${d.bot_hits} bot, ${d.human_hits} human`}
                        >
                          <div
                            className="rounded-t bg-[#60a5fa]/30"
                            style={{
                              height: `${Math.max(1, (d.hits / maxHits) * 100)}%`,
                            }}
                          />
                          <div
                            className="rounded-b bg-[#c084fc]"
                            style={{
                              height: `${Math.max(1, (d.visitors / maxHits) * 100)}%`,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-[10px] text-[#6b6b80]">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded bg-[#60a5fa]/30" />
                      Hits
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded bg-[#c084fc]" />
                      Visitors
                    </span>
                  </div>
                </div>

                {/* Status Code Distribution */}
                <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                  <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                    Response Status & Performance
                  </h3>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      {
                        label: "2xx Success",
                        value: data.traffic.status_codes?.["2xx"] ?? 0,
                        color: "#00ff88",
                      },
                      {
                        label: "3xx Redirect",
                        value: data.traffic.status_codes?.["3xx"] ?? 0,
                        color: "#60a5fa",
                      },
                      {
                        label: "4xx Client Error",
                        value: data.traffic.status_codes?.["4xx"] ?? 0,
                        color: "#f59e0b",
                      },
                      {
                        label: "5xx Server Error",
                        value: data.traffic.status_codes?.["5xx"] ?? 0,
                        color: "#ff4444",
                      },
                    ].map((s) => (
                      <div key={s.label} className="text-center">
                        <div
                          className="text-lg font-bold font-mono"
                          style={{ color: s.color }}
                        >
                          {s.value}
                        </div>
                        <div className="text-[10px] text-[#6b6b80]">
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-[#1e1e2a] pt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-sm font-mono text-[#60a5fa]">
                        {data.traffic.response_time?.avg_ms ?? 0}ms
                      </div>
                      <div className="text-[10px] text-[#6b6b80]">Avg</div>
                    </div>
                    <div>
                      <div className="text-sm font-mono text-[#00ff88]">
                        {data.traffic.response_time?.min_ms ?? 0}ms
                      </div>
                      <div className="text-[10px] text-[#6b6b80]">Min</div>
                    </div>
                    <div>
                      <div className="text-sm font-mono text-[#f59e0b]">
                        {data.traffic.response_time?.max_ms ?? 0}ms
                      </div>
                      <div className="text-[10px] text-[#6b6b80]">Max</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top Endpoints */}
                <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                  <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                    Top Endpoints (Grouped)
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {data.traffic.endpoint_groups.map((ep, i) => {
                      const maxEp = data.traffic.endpoint_groups[0]?.hits ?? 1;
                      const methodColor =
                        ep.method === "GET"
                          ? "#00ff88"
                          : ep.method === "POST"
                            ? "#60a5fa"
                            : ep.method === "PUT"
                              ? "#f59e0b"
                              : "#ff4444";
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded"
                                style={{
                                  color: methodColor,
                                  backgroundColor: `${methodColor}15`,
                                }}
                              >
                                {ep.method}
                              </span>
                              <span className="text-[#e8e8ed] truncate font-mono text-[11px]">
                                {ep.route}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[#6b6b80] shrink-0 ml-2">
                              <span>{ep.hits} hits</span>
                              <span>{ep.unique_visitors} visitors</span>
                              <span>{ep.avg_ms}ms</span>
                            </div>
                          </div>
                          <div className="h-1 bg-[#1e1e2a] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(ep.hits / maxEp) * 100}%`,
                                backgroundColor: methodColor,
                                opacity: 0.5,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {data.traffic.endpoint_groups.length === 0 && (
                      <p className="text-xs text-[#6b6b80]">
                        No traffic recorded yet
                      </p>
                    )}
                  </div>
                </div>

                {/* Top User Agents + Referrers */}
                <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                  <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                    Top User Agents
                  </h3>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto mb-4">
                    {data.traffic.top_user_agents.map((ua, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`text-[9px] px-1 rounded ${
                              ua.is_bot
                                ? "text-[#f59e0b] bg-[#f59e0b]/10"
                                : "text-[#00ff88] bg-[#00ff88]/10"
                            }`}
                          >
                            {ua.is_bot ? "BOT" : "USER"}
                          </span>
                          <span className="text-[#e8e8ed] truncate max-w-[200px]">
                            {ua.user_agent.length > 60
                              ? ua.user_agent.slice(0, 60) + "..."
                              : ua.user_agent}
                          </span>
                        </div>
                        <span className="text-[#6b6b80] shrink-0 ml-2">
                          {ua.hits}
                        </span>
                      </div>
                    ))}
                    {data.traffic.top_user_agents.length === 0 && (
                      <p className="text-xs text-[#6b6b80]">No data yet</p>
                    )}
                  </div>

                  {data.traffic.top_referrers.length > 0 && (
                    <>
                      <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-2 border-t border-[#1e1e2a] pt-3">
                        Top Referrers
                      </h3>
                      <div className="space-y-1.5 max-h-24 overflow-y-auto">
                        {data.traffic.top_referrers.map((ref, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="text-[#e8e8ed] truncate max-w-[250px]">
                              {ref.referrer}
                            </span>
                            <span className="text-[#6b6b80] shrink-0 ml-2">
                              {ref.hits}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ═══════════════ FUNNEL CONVERSION SECTION ═══════════════ */}
      <section className="mb-8">
        <SectionHeader
          icon={<Filter className="size-4 text-[#a855f7]" />}
          title="Funnel & Conversion"
          collapsible
          collapsed={collapsed.funnel}
          onToggle={() => toggle("funnel")}
        />
        {!collapsed.funnel && (
          <div className="space-y-4">
            {/* Funnel KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Free Users"
                value={data.funnel.total_free_users}
                sub={`${data.funnel.free_registrations} registrations`}
                icon={<Users className="size-3.5" />}
                color="#a855f7"
              />
              <StatCard
                label="Paying Users"
                value={data.funnel.total_paying_users}
                sub={`${data.funnel.paid_registrations} paid registrations`}
                icon={<Coins className="size-3.5" />}
                color="#00ff88"
              />
              <StatCard
                label="Stamp Conversion"
                value={`${data.funnel.stamp_conversion_rate}%`}
                sub={`${data.funnel.stamp_upgrades} upgraded`}
                icon={<TrendingUp className="size-3.5" />}
                color="#00f0ff"
              />
              <StatCard
                label="Reg Conversion"
                value={`${data.funnel.reg_conversion_rate}%`}
                sub={`${data.funnel.reg_upgrades} upgraded`}
                icon={<ArrowUpRight className="size-3.5" />}
                color="#ffd700"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Visual Funnel */}
              <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-4">
                  Acquisition Funnel
                </h3>
                <div className="space-y-3">
                  <FunnelStep
                    label="Free Users (Total)"
                    value={data.funnel.total_free_users}
                    maxValue={data.funnel.total_free_users}
                    color="#a855f7"
                    conversionRate={
                      data.funnel.total_free_users > 0
                        ? parseFloat(
                            (
                              ((data.funnel.free_stamps + data.funnel.free_registrations) /
                                Math.max(data.funnel.total_free_users, 1)) *
                              100
                            ).toFixed(1)
                          )
                        : 0
                    }
                  />
                  <FunnelStep
                    label="Free Stamps Minted"
                    value={data.funnel.free_stamps}
                    maxValue={data.funnel.total_free_users}
                    color="#00f0ff"
                    conversionRate={data.funnel.stamp_conversion_rate}
                  />
                  <FunnelStep
                    label="Paid Upgrades"
                    value={data.funnel.stamp_upgrades + data.funnel.reg_upgrades}
                    maxValue={data.funnel.total_free_users}
                    color="#00ff88"
                    conversionRate={
                      data.funnel.total_paying_users > 0
                        ? parseFloat(
                            (
                              (data.funnel.paid_stamps /
                                Math.max(data.funnel.total_paying_users, 1)) *
                              100
                            ).toFixed(1)
                          )
                        : 0
                    }
                  />
                  <FunnelStep
                    label="Paid Stamps (Bronze+)"
                    value={data.funnel.paid_stamps}
                    maxValue={data.funnel.total_free_users}
                    color="#ffd700"
                    isLast
                  />
                </div>
              </div>

              {/* Free vs Paid Over Time */}
              <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                  Free vs Paid Stamps (This Period)
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-3 rounded-lg bg-[#1e1e2a]/50">
                    <p className="text-2xl font-bold font-mono text-[#00f0ff]">
                      {data.funnel.free_stamps_month}
                    </p>
                    <p className="text-[10px] text-[#6b6b80]">Free (30d)</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-[#1e1e2a]/50">
                    <p className="text-2xl font-bold font-mono text-[#ffd700]">
                      {data.funnel.paid_stamps_month}
                    </p>
                    <p className="text-[10px] text-[#6b6b80]">Paid (30d)</p>
                  </div>
                </div>
                {data.funnel.free_stamps_by_day.length > 0 && (
                  <>
                    <div className="flex items-center gap-4 mb-2">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-1 rounded bg-[#00f0ff]" />
                        <span className="text-[10px] text-[#6b6b80]">Free</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-1 rounded bg-[#ffd700]" />
                        <span className="text-[10px] text-[#6b6b80]">Paid</span>
                      </div>
                    </div>
                    <SparkLine
                      data={data.funnel.free_stamps_by_day.map((d) => d.count)}
                      color="#00f0ff"
                      height={40}
                    />
                    <SparkLine
                      data={data.funnel.paid_stamps_by_day.map((d) => d.count)}
                      color="#ffd700"
                      height={40}
                    />
                  </>
                )}
                {data.funnel.free_stamps_by_day.length === 0 &&
                  data.funnel.paid_stamps_by_day.length === 0 && (
                    <p className="text-xs text-[#6b6b80]">No stamp data yet</p>
                  )}
              </div>
            </div>

            {/* Tier Breakdown & Free Tier Stats */}
            <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
              <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                Stamp Tier Breakdown
              </h3>
              <div className="space-y-2.5">
                <MiniBar
                  label="Free"
                  value={data.funnel.free_stamps}
                  max={data.stamps.total || 1}
                  color="#a855f7"
                />
                {["bronze", "silver", "gold"].map((tier) => (
                  <MiniBar
                    key={tier}
                    label={tier}
                    value={data.stamps.by_tier[tier] || 0}
                    max={data.stamps.total || 1}
                    color={tierColors[tier]}
                  />
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-[#1e1e2a] flex items-center justify-between text-xs">
                <span className="text-[#6b6b80]">
                  Free-to-paid ratio
                </span>
                <span className="font-mono text-[#00ff88]">
                  {data.funnel.paid_stamps > 0
                    ? `1:${(data.funnel.free_stamps / data.funnel.paid_stamps).toFixed(1)}`
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ═══════════════ WEBHOOKS SECTION ═══════════════ */}
      <section className="mb-8">
        <SectionHeader
          icon={<Bell className="size-4 text-[#ff6b6b]" />}
          title="Webhooks"
          collapsible
          collapsed={collapsed.webhooks_stats}
          onToggle={() => toggle("webhooks_stats")}
        />
        {!collapsed.webhooks_stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard
                label="Total Webhooks"
                value={data.webhooks_stats.total}
                icon={<Bell className="size-3.5" />}
                color="#ff6b6b"
              />
              <StatCard
                label="Active"
                value={data.webhooks_stats.active}
                sub={`${data.webhooks_stats.inactive} inactive`}
                icon={<Activity className="size-3.5" />}
                color="#00ff88"
              />
              <StatCard
                label="Event Types"
                value={Object.keys(data.webhooks_stats.event_distribution).length}
                icon={<GitBranch className="size-3.5" />}
                color="#00f0ff"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Event Distribution */}
              <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                  Event Subscriptions
                </h3>
                <div className="space-y-2.5">
                  {Object.entries(data.webhooks_stats.event_distribution)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([event, count]) => {
                      const maxEvt = Math.max(
                        ...Object.values(data.webhooks_stats.event_distribution)
                      );
                      return (
                        <MiniBar
                          key={event}
                          label={event.replace(/_/g, " ")}
                          value={count as number}
                          max={maxEvt}
                          color="#ff6b6b"
                        />
                      );
                    })}
                  {Object.keys(data.webhooks_stats.event_distribution).length === 0 && (
                    <p className="text-xs text-[#6b6b80]">No webhooks registered</p>
                  )}
                </div>
              </div>

              {/* Recent Webhooks */}
              <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                  Recent Webhooks
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {data.webhooks_stats.recent.map((wh) => (
                    <div
                      key={wh.id}
                      className="text-xs border-b border-[#1e1e2a]/50 pb-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[#e8e8ed] truncate max-w-[60%]">
                          {new URL(wh.url).hostname}
                        </span>
                        <span
                          className={`text-[10px] ${
                            wh.active ? "text-[#00ff88]" : "text-[#ff4444]"
                          }`}
                        >
                          {wh.active ? "active" : "inactive"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[#6b6b80]">
                          {truncateWallet(wh.wallet_address)}
                        </span>
                        <span className="text-[10px] text-[#6b6b80]">
                          {timeAgo(wh.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {data.webhooks_stats.recent.length === 0 && (
                    <p className="text-xs text-[#6b6b80]">No webhooks yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ═══════════════ REVENUE SECTION ═══════════════ */}
      <section className="mb-8">
        <SectionHeader
          icon={<Coins className="size-4 text-[#00ff88]" />}
          title="Revenue"
          collapsible
          collapsed={collapsed.revenue}
          onToggle={() => toggle("revenue")}
        />
        {!collapsed.revenue && (
          <div className="space-y-4">
            {/* Revenue KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Today"
                value={formatUSDC(data.revenue.today)}
                icon={<Coins className="size-3.5" />}
                color="#00ff88"
              />
              <StatCard
                label="This Week"
                value={formatUSDC(data.revenue.this_week)}
                icon={<TrendingUp className="size-3.5" />}
                color="#00ff88"
              />
              <StatCard
                label="This Month"
                value={formatUSDC(data.revenue.this_month)}
                icon={<BarChart3 className="size-3.5" />}
                color="#00ff88"
              />
              <StatCard
                label="Monthly Projection"
                value={formatUSDC(data.revenue.monthly_projection)}
                sub={`avg ${formatUSDC(data.revenue.average_transaction)}/txn`}
                icon={<ArrowUpRight className="size-3.5" />}
                color="#00ff88"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Revenue Trend */}
              <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                  Revenue Trend
                </h3>
                {data.revenue.by_day.length > 0 ? (
                  <SparkLine
                    data={data.revenue.by_day.map((d) => d.total_usdc)}
                    color="#00ff88"
                    height={60}
                  />
                ) : (
                  <p className="text-xs text-[#6b6b80]">No data yet</p>
                )}
                {data.revenue.by_day.length > 0 && (
                  <div className="flex justify-between mt-2 text-[10px] text-[#6b6b80]">
                    <span>{data.revenue.by_day[0]?.date}</span>
                    <span>
                      {
                        data.revenue.by_day[data.revenue.by_day.length - 1]
                          ?.date
                      }
                    </span>
                  </div>
                )}
              </div>

              {/* Revenue by Action */}
              <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                  Revenue by Action
                </h3>
                <div className="space-y-2.5">
                  {data.revenue.by_action.map((a) => {
                    const maxVal = Math.max(
                      ...data.revenue.by_action.map((x) => x.total_usdc)
                    );
                    return (
                      <MiniBar
                        key={a.action}
                        label={actionLabels[a.action] || a.action}
                        value={a.total_usdc}
                        max={maxVal}
                        color="#00ff88"
                        suffix={` (${a.count})`}
                      />
                    );
                  })}
                  {data.revenue.by_action.length === 0 && (
                    <p className="text-xs text-[#6b6b80]">No transactions</p>
                  )}
                </div>
              </div>
            </div>

            {/* Top Payers + Unique Wallets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider">
                    Top Payers
                  </h3>
                  <span className="text-[10px] text-[#00ff88] font-mono">
                    {data.revenue.unique_wallets} unique wallets
                  </span>
                </div>
                <div className="space-y-2">
                  {data.revenue.top_payers.slice(0, 5).map((p, i) => (
                    <div
                      key={p.wallet_address}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[#6b6b80] w-4">{i + 1}.</span>
                        <span className="font-mono text-[#e8e8ed]">
                          {truncateWallet(p.wallet_address)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[#6b6b80]">
                          {p.transaction_count} txns
                        </span>
                        <span className="font-mono text-[#00ff88]">
                          {formatUSDC(p.total_usdc)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {data.revenue.top_payers.length === 0 && (
                    <p className="text-xs text-[#6b6b80]">No payers yet</p>
                  )}
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                  Recent Transactions
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {data.recent_activity.transactions.slice(0, 8).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[#6b6b80] shrink-0">
                          {actionLabels[tx.action] || tx.action}
                        </span>
                        <span className="font-mono text-[#e8e8ed] truncate">
                          {truncateWallet(tx.wallet_address)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[#00ff88]">
                          {formatUSDC(parseFloat(tx.amount))}
                        </span>
                        <span className="text-[10px] text-[#6b6b80]">
                          {timeAgo(tx.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {data.recent_activity.transactions.length === 0 && (
                    <p className="text-xs text-[#6b6b80]">No transactions</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ═══════════════ STAMPS SECTION ═══════════════ */}
      <section className="mb-8">
        <SectionHeader
          icon={<Shield className="size-4 text-[#00f0ff]" />}
          title="Stamps"
          collapsible
          collapsed={collapsed.stamps}
          onToggle={() => toggle("stamps")}
        />
        {!collapsed.stamps && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Active"
                value={data.stamps.active}
                sub={`of ${data.stamps.total} total`}
                icon={<Shield className="size-3.5" />}
                color="#00f0ff"
              />
              <StatCard
                label="Expired"
                value={data.stamps.expired}
                icon={<Clock className="size-3.5" />}
                color="#6b6b80"
              />
              <StatCard
                label="Expiring Soon"
                value={data.stamps.expiring_soon}
                sub="next 7 days"
                icon={<Activity className="size-3.5" />}
                color="#ffaa00"
              />
              <StatCard
                label="This Month"
                value={data.stamps.this_month}
                sub={`${data.stamps.this_week} this week / ${data.stamps.today} today`}
                icon={<TrendingUp className="size-3.5" />}
                color="#00f0ff"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tier Distribution */}
              <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                  Stamps by Tier
                </h3>
                <div className="space-y-3">
                  {["free", "bronze", "silver", "gold"].map((tier) => (
                    <MiniBar
                      key={tier}
                      label={tier}
                      value={data.stamps.by_tier[tier] || 0}
                      max={data.stamps.total || 1}
                      color={tierColors[tier]}
                    />
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-[#1e1e2a] flex items-center justify-between text-xs">
                  <span className="text-[#6b6b80]">Revoked</span>
                  <span className="font-mono text-[#ff4444]">
                    {data.stamps.revoked}
                  </span>
                </div>
              </div>

              {/* Stamp Trend */}
              <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                  Stamp Minting Trend
                </h3>
                {data.stamps.by_day.length > 0 ? (
                  <>
                    <SparkLine
                      data={data.stamps.by_day.map((d) => d.count)}
                      color="#00f0ff"
                      height={60}
                    />
                    <div className="flex justify-between mt-2 text-[10px] text-[#6b6b80]">
                      <span>{data.stamps.by_day[0]?.date}</span>
                      <span>
                        {
                          data.stamps.by_day[data.stamps.by_day.length - 1]
                            ?.date
                        }
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-[#6b6b80]">No data yet</p>
                )}
              </div>
            </div>

            {/* Recent Stamps */}
            <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
              <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                Recent Stamps
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#6b6b80] border-b border-[#1e1e2a]">
                      <th className="text-left py-2 pr-4">ID</th>
                      <th className="text-left py-2 pr-4">Wallet</th>
                      <th className="text-left py-2 pr-4">Tier</th>
                      <th className="text-left py-2 pr-4">Issued</th>
                      <th className="text-left py-2">Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_activity.stamps.slice(0, 5).map((s) => (
                      <tr key={s.id} className="border-b border-[#1e1e2a]/50">
                        <td className="py-2 pr-4 font-mono text-[#e8e8ed]">
                          {s.id.slice(0, 16)}...
                        </td>
                        <td className="py-2 pr-4 font-mono text-[#6b6b80]">
                          {truncateWallet(s.wallet_address)}
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className="capitalize font-medium"
                            style={{ color: tierColors[s.tier] || "#e8e8ed" }}
                          >
                            {s.tier}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-[#6b6b80]">
                          {timeAgo(s.issued_at)}
                        </td>
                        <td className="py-2 text-[#6b6b80]">
                          {new Date(s.expires_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.recent_activity.stamps.length === 0 && (
                  <p className="text-xs text-[#6b6b80] py-4 text-center">
                    No stamps yet
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ═══════════════ AGENTS SECTION ═══════════════ */}
      <section className="mb-8">
        <SectionHeader
          icon={<Users className="size-4 text-[#a855f7]" />}
          title="Agents"
          collapsible
          collapsed={collapsed.agents}
          onToggle={() => toggle("agents")}
        />
        {!collapsed.agents && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Active"
                value={data.agents.active}
                sub={`of ${data.agents.total} total`}
                icon={<Users className="size-3.5" />}
                color="#a855f7"
              />
              <StatCard
                label="With Stamps"
                value={data.agents.with_stamps}
                sub={`${data.agents.without_stamps} without`}
                icon={<Shield className="size-3.5" />}
                color="#00f0ff"
              />
              <StatCard
                label="Avg Endorsements"
                value={data.agents.average_endorsements}
                icon={<Heart className="size-3.5" />}
                color="#ff6b6b"
              />
              <StatCard
                label="This Month"
                value={data.agents.this_month}
                sub={`${data.agents.this_week} this week / ${data.agents.today} today`}
                icon={<TrendingUp className="size-3.5" />}
                color="#a855f7"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category Distribution */}
              <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                  Agents by Category
                </h3>
                <div className="space-y-2.5">
                  {Object.entries(data.agents.by_category).map(
                    ([cat, count]) => (
                      <MiniBar
                        key={cat}
                        label={cat}
                        value={count}
                        max={data.agents.total || 1}
                        color="#a855f7"
                      />
                    )
                  )}
                  {Object.keys(data.agents.by_category).length === 0 && (
                    <p className="text-xs text-[#6b6b80]">No agents yet</p>
                  )}
                </div>
              </div>

              {/* Registration Trend */}
              <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                  Registration Trend
                </h3>
                {data.agents.by_day.length > 0 ? (
                  <>
                    <SparkLine
                      data={data.agents.by_day.map((d) => d.count)}
                      color="#a855f7"
                      height={60}
                    />
                    <div className="flex justify-between mt-2 text-[10px] text-[#6b6b80]">
                      <span>{data.agents.by_day[0]?.date}</span>
                      <span>
                        {
                          data.agents.by_day[data.agents.by_day.length - 1]
                            ?.date
                        }
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-[#6b6b80]">No data yet</p>
                )}
              </div>
            </div>

            {/* Recent Agents */}
            <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
              <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                Recently Registered
              </h3>
              <div className="space-y-2">
                {data.recent_activity.agents.slice(0, 5).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[#e8e8ed] font-medium truncate">
                        {a.name}
                      </span>
                      <span className="text-[10px] text-[#a855f7] capitalize shrink-0">
                        {a.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[#6b6b80]">
                        {truncateWallet(a.wallet_address)}
                      </span>
                      <span className="text-[10px] text-[#6b6b80]">
                        {timeAgo(a.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
                {data.recent_activity.agents.length === 0 && (
                  <p className="text-xs text-[#6b6b80]">No agents yet</p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ═══════════════ ENDORSEMENTS SECTION ═══════════════ */}
      <section className="mb-8">
        <SectionHeader
          icon={<Heart className="size-4 text-[#ff6b6b]" />}
          title="Endorsements"
          collapsible
          collapsed={collapsed.endorsements}
          onToggle={() => toggle("endorsements")}
        />
        {!collapsed.endorsements && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Total"
                value={data.endorsements.total}
                icon={<Heart className="size-3.5" />}
                color="#ff6b6b"
              />
              <StatCard
                label="Today"
                value={data.endorsements.today}
                icon={<Zap className="size-3.5" />}
                color="#ff6b6b"
              />
              <StatCard
                label="This Week"
                value={data.endorsements.this_week}
                icon={<TrendingUp className="size-3.5" />}
                color="#ff6b6b"
              />
              <StatCard
                label="Unique Endorsers"
                value={data.endorsements.unique_endorsers}
                icon={<Wallet className="size-3.5" />}
                color="#ff6b6b"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Most Endorsed Agents */}
              <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                  Most Endorsed Agents
                </h3>
                <div className="space-y-2.5">
                  {data.endorsements.most_endorsed.slice(0, 5).map((a) => (
                    <MiniBar
                      key={a.agent_id}
                      label={a.name}
                      value={a.count}
                      max={
                        data.endorsements.most_endorsed[0]?.count ||
                        1
                      }
                      color="#ff6b6b"
                    />
                  ))}
                  {data.endorsements.most_endorsed.length === 0 && (
                    <p className="text-xs text-[#6b6b80]">
                      No endorsements yet
                    </p>
                  )}
                </div>
              </div>

              {/* Top Endorsers */}
              <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                  Top Endorsers
                </h3>
                <div className="space-y-2">
                  {data.endorsements.top_endorsers.slice(0, 5).map((e, i) => (
                    <div
                      key={e.wallet}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[#6b6b80] w-4">{i + 1}.</span>
                        <span className="font-mono text-[#e8e8ed]">
                          {truncateWallet(e.wallet)}
                        </span>
                      </div>
                      <span className="font-mono text-[#ff6b6b]">
                        {e.count} endorsements
                      </span>
                    </div>
                  ))}
                  {data.endorsements.top_endorsers.length === 0 && (
                    <p className="text-xs text-[#6b6b80]">
                      No endorsers yet
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Endorsement Trend */}
            {data.endorsements.by_day.length > 0 && (
              <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                  Endorsement Trend
                </h3>
                <SparkLine
                  data={data.endorsements.by_day.map((d) => d.count)}
                  color="#ff6b6b"
                  height={50}
                />
                <div className="flex justify-between mt-2 text-[10px] text-[#6b6b80]">
                  <span>{data.endorsements.by_day[0]?.date}</span>
                  <span>
                    {
                      data.endorsements.by_day[
                        data.endorsements.by_day.length - 1
                      ]?.date
                    }
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ═══════════════ REPUTATION SECTION ═══════════════ */}
      <section className="mb-8">
        <SectionHeader
          icon={<Star className="size-4 text-[#ffaa00]" />}
          title="Reputation"
          collapsible
          collapsed={collapsed.reputation}
          onToggle={() => toggle("reputation")}
        />
        {!collapsed.reputation && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="New (0-25)"
                value={data.reputation.distribution.new || 0}
                icon={<Hash className="size-3.5" />}
                color="#6b6b80"
              />
              <StatCard
                label="Emerging (26-50)"
                value={data.reputation.distribution.emerging || 0}
                icon={<Zap className="size-3.5" />}
                color="#00f0ff"
              />
              <StatCard
                label="Established (51-75)"
                value={data.reputation.distribution.established || 0}
                icon={<Award className="size-3.5" />}
                color="#00ff88"
              />
              <StatCard
                label="Elite (76-100)"
                value={data.reputation.distribution.elite || 0}
                icon={<Star className="size-3.5" />}
                color="#ffd700"
              />
            </div>

            {/* Top Rated Agents */}
            <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
              <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                Top Rated Agents
              </h3>
              <div className="space-y-2.5">
                {data.reputation.top_agents.slice(0, 10).map((a) => {
                  const labelColor =
                    a.label === "elite"
                      ? "#ffd700"
                      : a.label === "established"
                      ? "#00ff88"
                      : a.label === "emerging"
                      ? "#00f0ff"
                      : "#6b6b80";
                  return (
                    <div
                      key={a.agent_id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-[#e8e8ed] font-medium truncate">
                          {a.name}
                        </span>
                        <span
                          className="text-[10px] capitalize"
                          style={{ color: labelColor }}
                        >
                          {a.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-24 h-1.5 bg-[#1e1e2a] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${a.score}%`,
                              backgroundColor: labelColor,
                            }}
                          />
                        </div>
                        <span
                          className="text-xs font-mono w-8 text-right"
                          style={{ color: labelColor }}
                        >
                          {a.score}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {data.reputation.top_agents.length === 0 && (
                  <p className="text-xs text-[#6b6b80]">No agents yet</p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ═══════════════ WISHES SECTION ═══════════════ */}
      <section className="mb-8">
        <SectionHeader
          icon={<Sparkles className="size-4 text-[#ffd700]" />}
          title="Wishing Well"
          collapsible
          collapsed={collapsed.wishes}
          onToggle={() => toggle("wishes")}
        />
        {!collapsed.wishes && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Grant Rate"
                value={`${data.wishes.grant_rate}%`}
                sub={`${data.wishes.granted} of ${data.wishes.total}`}
                icon={<Target className="size-3.5" />}
                color="#ffd700"
              />
              <StatCard
                label="Unmet"
                value={data.wishes.unmet}
                icon={<Sparkles className="size-3.5" />}
                color="#ff6b6b"
              />
              <StatCard
                label="This Month"
                value={data.wishes.this_month}
                sub={`${data.wishes.this_week} this week / ${data.wishes.today} today`}
                icon={<TrendingUp className="size-3.5" />}
                color="#ffd700"
              />
              <StatCard
                label="Granted"
                value={data.wishes.granted}
                icon={<Zap className="size-3.5" />}
                color="#00ff88"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Wish Categories */}
              <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                  Wishes by Category
                </h3>
                <div className="space-y-2.5">
                  {data.wishes.by_category.map((c) => (
                    <MiniBar
                      key={c.category}
                      label={c.category || "uncategorized"}
                      value={c.total}
                      max={data.wishes.total || 1}
                      color="#ffd700"
                      suffix={` (${c.granted} granted)`}
                    />
                  ))}
                  {data.wishes.by_category.length === 0 && (
                    <p className="text-xs text-[#6b6b80]">No wishes yet</p>
                  )}
                </div>
              </div>

              {/* Wish Trend */}
              <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                  Wish Trend
                </h3>
                {data.wishes.by_day.length > 0 ? (
                  <>
                    <SparkLine
                      data={data.wishes.by_day.map((d) => d.count)}
                      color="#ffd700"
                      height={60}
                    />
                    <div className="flex justify-between mt-2 text-[10px] text-[#6b6b80]">
                      <span>{data.wishes.by_day[0]?.date}</span>
                      <span>
                        {
                          data.wishes.by_day[data.wishes.by_day.length - 1]
                            ?.date
                        }
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-[#6b6b80]">No data yet</p>
                )}
              </div>
            </div>

            {/* Top Wishes + Top Wishers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                  Most Granted Wishes
                </h3>
                <div className="space-y-2">
                  {data.wishes.top_wishes.slice(0, 5).map((w) => (
                    <div key={w.id} className="text-xs">
                      <p className="text-[#e8e8ed] truncate">{w.wish_text}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[#ffd700] capitalize">
                          {w.category}
                        </span>
                        <span className="text-[10px] text-[#00ff88]">
                          {w.grant_count} grants
                        </span>
                      </div>
                    </div>
                  ))}
                  {data.wishes.top_wishes.length === 0 && (
                    <p className="text-xs text-[#6b6b80]">No wishes yet</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
                <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                  Top Wishers
                </h3>
                <div className="space-y-2">
                  {data.wishes.top_wishers.slice(0, 5).map((w, i) => (
                    <div
                      key={w.wallet}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[#6b6b80] w-4">{i + 1}.</span>
                        <span className="font-mono text-[#e8e8ed]">
                          {truncateWallet(w.wallet)}
                        </span>
                      </div>
                      <span className="font-mono text-[#ffd700]">
                        {w.count} wishes
                      </span>
                    </div>
                  ))}
                  {data.wishes.top_wishers.length === 0 && (
                    <p className="text-xs text-[#6b6b80]">No wishers yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ═══════════════ HEARTBEATS SECTION ═══════════════ */}
      <section className="mb-8">
        <SectionHeader
          icon={<Activity className="size-4 text-[#00ff88]" />}
          title="Heartbeats & Liveness"
          collapsible
          collapsed={collapsed.heartbeats}
          onToggle={() => toggle("heartbeats")}
        />
        {!collapsed.heartbeats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Total Heartbeats"
              value={data.heartbeats.total}
              icon={<Activity className="size-3.5" />}
              color="#00ff88"
            />
            <StatCard
              label="Today"
              value={data.heartbeats.today}
              icon={<Zap className="size-3.5" />}
              color="#00ff88"
            />
            <StatCard
              label="This Week"
              value={data.heartbeats.this_week}
              icon={<TrendingUp className="size-3.5" />}
              color="#00ff88"
            />
            <StatCard
              label="Active Today"
              value={data.heartbeats.active_agents_today}
              sub="agents with heartbeat"
              icon={<Users className="size-3.5" />}
              color="#00ff88"
            />
          </div>
        )}
      </section>

      {/* ═══════════════ SYSTEM SECTION ═══════════════ */}
      <section className="mb-8">
        <SectionHeader
          icon={<Database className="size-4 text-[#6b6b80]" />}
          title="System"
          collapsible
          collapsed={collapsed.system}
          onToggle={() => toggle("system")}
        />
        {!collapsed.system && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard
                label="Database Size"
                value={`${data.system.db_size_mb} MB`}
                icon={<Database className="size-3.5" />}
                color="#6b6b80"
              />
              <StatCard
                label="Total Rows"
                value={totalRows.toLocaleString()}
                icon={<Layers className="size-3.5" />}
                color="#6b6b80"
              />
              <StatCard
                label="Server Uptime"
                value={formatUptime(data.system.server_start)}
                icon={<Clock className="size-3.5" />}
                color="#6b6b80"
              />
            </div>

            {/* Table Row Counts */}
            <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-5">
              <h3 className="text-xs text-[#6b6b80] uppercase tracking-wider mb-3">
                Table Row Counts
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(data.system.tables).map(([table, count]) => (
                  <div
                    key={table}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-[#6b6b80] font-mono">{table}</span>
                    <span className="text-[#e8e8ed] font-mono">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <div className="text-center pt-4 border-t border-[#1e1e2a]">
        <p className="text-[10px] text-[#6b6b80]">
          AgentStamp Analytics Dashboard · Data as of{" "}
          {new Date(data.generated_at).toLocaleString()} · {days}-day window
        </p>
      </div>
    </div>
  );
}
