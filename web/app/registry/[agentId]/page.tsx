import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Globe,
  Wallet,
  Calendar,
  Shield,
  Award,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { CategoryBadge } from "@/components/CategoryBadge";
import type { Agent, Endorsement } from "@/types";
import type { Metadata } from "next";

const API_BASE = process.env.API_URL || "http://localhost:3405";

interface AgentResponse extends Agent {
  endorsements?: Endorsement[];
}

async function getAgent(agentId: string): Promise<AgentResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/registry/agent/${agentId}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.agent ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ agentId: string }>;
}): Promise<Metadata> {
  const { agentId } = await params;
  const agent = await getAgent(agentId);
  if (!agent) return { title: "Agent Not Found" };
  return {
    title: agent.name,
    description: agent.description,
  };
}

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const agent = await getAgent(agentId);

  if (!agent) {
    notFound();
  }

  const statusColor =
    agent.status === "active"
      ? "text-[#00ff88]"
      : agent.status === "inactive"
        ? "text-[#6b6b80]"
        : "text-[#e8e8ed]";

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Back */}
      <Link
        href="/registry"
        className="inline-flex items-center gap-2 text-sm text-[#6b6b80] hover:text-[#00f0ff] transition-colors mb-8"
      >
        <ArrowLeft className="size-4" />
        Back to Registry
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-8 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-[#e8e8ed]">{agent.name}</h1>
              {agent.stamp_id && (
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full text-[#00f0ff] bg-[#00f0ff]/10">
                  stamped
                </span>
              )}
            </div>
            {agent.status && (
              <p className={`text-sm font-medium uppercase tracking-wider ${statusColor} mb-3`}>
                {agent.status}
              </p>
            )}
            <p className="text-[#6b6b80] max-w-2xl leading-relaxed">{agent.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <CategoryBadge category={agent.category} />
            <div className="flex items-center gap-1 text-sm text-[#6b6b80]">
              <Shield className="size-4 text-[#00f0ff]" />
              <span className="font-mono">{agent.endorsement_count} endorsements</span>
            </div>
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#e8e8ed] uppercase tracking-wider">
            Agent Details
          </h2>

          {agent.wallet_address && (
            <div className="flex items-start gap-3">
              <Wallet className="size-4 text-[#6b6b80] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-[#6b6b80]">Wallet</p>
                <p className="text-sm font-mono text-[#e8e8ed] break-all">
                  {agent.wallet_address}
                </p>
              </div>
            </div>
          )}

          {agent.endpoint_url && (
            <div className="flex items-start gap-3">
              <Globe className="size-4 text-[#6b6b80] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-[#6b6b80]">Endpoint</p>
                <a
                  href={agent.endpoint_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#00f0ff] hover:underline inline-flex items-center gap-1 break-all"
                >
                  {agent.endpoint_url}
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <Calendar className="size-4 text-[#6b6b80] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-[#6b6b80]">Registered</p>
              <p className="text-sm text-[#e8e8ed]">
                {new Date(agent.registered_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          {agent.last_heartbeat && (
            <div className="flex items-start gap-3">
              <Calendar className="size-4 text-[#6b6b80] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-[#6b6b80]">Last Heartbeat</p>
                <p className="text-sm text-[#e8e8ed]">
                  {new Date(agent.last_heartbeat).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#e8e8ed] uppercase tracking-wider">
            Performance
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-[#050508] border border-[#1e1e2a] p-4 text-center">
              <p className="text-2xl font-bold font-mono text-[#00f0ff]">{agent.endorsement_count}</p>
              <p className="text-xs text-[#6b6b80] mt-1">Endorsements</p>
            </div>
            <div className="rounded-lg bg-[#050508] border border-[#1e1e2a] p-4 text-center">
              <p className="text-2xl font-bold font-mono text-[#00ff88] capitalize">
                {agent.status}
              </p>
              <p className="text-xs text-[#6b6b80] mt-1">Status</p>
            </div>
          </div>

          {/* Protocols */}
          {agent.protocols && agent.protocols.length > 0 && (
            <div className="space-y-2 mt-4">
              <p className="text-xs text-[#6b6b80] uppercase tracking-wider">Protocols</p>
              <div className="flex flex-wrap gap-2">
                {agent.protocols.map((proto) => (
                  <span
                    key={proto}
                    className="rounded-full border border-[#00ff88]/20 bg-[#00ff88]/5 px-3 py-1 text-xs font-medium text-[#00ff88]"
                  >
                    {proto}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Capabilities */}
      {agent.capabilities && agent.capabilities.length > 0 && (
        <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-6 mb-6">
          <h2 className="text-sm font-semibold text-[#e8e8ed] uppercase tracking-wider mb-4">
            Capabilities
          </h2>
          <div className="flex flex-wrap gap-2">
            {agent.capabilities.map((cap) => (
              <span
                key={cap}
                className="rounded-full border border-[#00f0ff]/20 bg-[#00f0ff]/5 px-3 py-1 text-xs font-medium text-[#00f0ff]"
              >
                {cap}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Endorsements */}
      {agent.endorsements && agent.endorsements.length > 0 && (
        <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-6 mb-6">
          <h2 className="text-sm font-semibold text-[#e8e8ed] uppercase tracking-wider mb-4 flex items-center gap-2">
            <Award className="size-4 text-[#00ff88]" />
            Endorsements ({agent.endorsements.length})
          </h2>
          <div className="space-y-4">
            {agent.endorsements.map((endorsement, i) => (
              <div
                key={i}
                className="rounded-lg bg-[#050508] border border-[#1e1e2a] p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="size-3.5 text-[#6b6b80]" />
                  <span className="text-xs font-mono text-[#6b6b80]">
                    {endorsement.endorser_wallet.slice(0, 6)}...
                    {endorsement.endorser_wallet.slice(-4)}
                  </span>
                  <span className="text-xs text-[#6b6b80] ml-auto">
                    {new Date(endorsement.created_at).toLocaleDateString()}
                  </span>
                </div>
                {endorsement.message && (
                  <p className="text-sm text-[#e8e8ed]">{endorsement.message}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      {agent.metadata && Object.keys(agent.metadata).length > 0 && (
        <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-6">
          <h2 className="text-sm font-semibold text-[#e8e8ed] uppercase tracking-wider mb-4">
            Metadata
          </h2>
          <pre className="rounded-lg bg-[#050508] border border-[#1e1e2a] p-4 text-xs font-mono text-[#6b6b80] overflow-x-auto">
            {JSON.stringify(agent.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
