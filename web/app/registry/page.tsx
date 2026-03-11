"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, Database, ChevronLeft, ChevronRight } from "lucide-react";
import { CategoryBadge } from "@/components/CategoryBadge";
import type { Agent } from "@/types";

const LIMIT = 12;

const categories = [
  "All",
  "Data",
  "Trading",
  "Research",
  "Creative",
  "Infrastructure",
  "Other",
];

const sortOptions = [
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name" },
  { value: "endorsements", label: "Most Endorsed" },
];

export default function RegistryPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("newest");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (category !== "All") params.set("category", category.toLowerCase());
      params.set("sort", sort);
      params.set("limit", String(LIMIT + 1));
      params.set("offset", String(offset));

      if (search) params.set("q", search);

      const endpoint = search
        ? `/api/v1/registry/search?${params}`
        : `/api/v1/registry/browse?${params}`;

      const res = await fetch(`${baseUrl}${endpoint}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      const data: Agent[] = json.agents ?? [];
      setHasMore(data.length > LIMIT);
      setAgents(data.slice(0, LIMIT));
    } catch {
      setAgents([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [search, category, sort, offset]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    setOffset(0);
  }, [search, category, sort]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-[#e8e8ed] flex items-center gap-3">
          <Database className="size-8 text-[#00f0ff]" />
          Agent Registry
        </h1>
        <p className="mt-3 text-[#6b6b80] max-w-2xl">
          Browse verified AI agents in the decentralized registry. Each agent has been stamped
          and certified through the AgentStamp protocol.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#6b6b80]" />
          <input
            type="text"
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#1e1e2a] bg-[#111118] pl-10 pr-4 py-2.5 text-sm text-[#e8e8ed] placeholder-[#6b6b80] focus:outline-none focus:border-[#00f0ff]/50 focus:ring-1 focus:ring-[#00f0ff]/20 transition-colors"
          />
        </div>
        <div className="flex gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-[#1e1e2a] bg-[#111118] px-4 py-2.5 text-sm text-[#e8e8ed] focus:outline-none focus:border-[#00f0ff]/50 transition-colors appearance-none cursor-pointer min-w-[140px]"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-[#1e1e2a] bg-[#111118] px-4 py-2.5 text-sm text-[#e8e8ed] focus:outline-none focus:border-[#00f0ff]/50 transition-colors appearance-none cursor-pointer min-w-[140px]"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-6 animate-pulse"
            >
              <div className="h-5 w-2/3 bg-[#1e1e2a] rounded mb-3" />
              <div className="h-3 w-full bg-[#1e1e2a] rounded mb-2" />
              <div className="h-3 w-4/5 bg-[#1e1e2a] rounded mb-4" />
              <div className="h-4 w-1/3 bg-[#1e1e2a] rounded" />
            </div>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-20">
          <SlidersHorizontal className="size-12 text-[#1e1e2a] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#e8e8ed]">No agents found</h3>
          <p className="mt-2 text-sm text-[#6b6b80]">
            {search
              ? "Try adjusting your search terms."
              : "No agents have been registered yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href={`/registry/${agent.id}`}
              className="group rounded-xl border border-[#1e1e2a] bg-[#111118] p-6 transition-all hover:border-[#00f0ff]/30 hover:shadow-[0_0_20px_rgba(0,240,255,0.05)]"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-base font-semibold text-[#e8e8ed] group-hover:text-[#00f0ff] transition-colors truncate">
                  {agent.name}
                </h3>
                {agent.stamp_id && (
                  <span className="ml-2 shrink-0 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full text-[#00f0ff] bg-[#00f0ff]/10">
                    stamped
                  </span>
                )}
              </div>
              <p className="text-sm text-[#6b6b80] line-clamp-2 mb-4 leading-relaxed">
                {agent.description}
              </p>
              <div className="flex items-center justify-between">
                <CategoryBadge category={agent.category} />
                <div className="flex items-center gap-3 text-xs text-[#6b6b80]">
                  <span>{agent.endorsement_count} endorsements</span>
                  <span className="capitalize text-[#00ff88]">{agent.status}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {(offset > 0 || hasMore) && (
        <div className="flex items-center justify-center gap-4 mt-10">
          <button
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            disabled={offset === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-[#1e1e2a] px-4 py-2 text-sm text-[#e8e8ed] transition-colors hover:border-[#00f0ff]/50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="size-4" />
            Previous
          </button>
          <span className="text-sm text-[#6b6b80]">
            Page {Math.floor(offset / LIMIT) + 1}
          </span>
          <button
            onClick={() => setOffset(offset + LIMIT)}
            disabled={!hasMore}
            className="inline-flex items-center gap-1 rounded-lg border border-[#1e1e2a] px-4 py-2 text-sm text-[#e8e8ed] transition-colors hover:border-[#00f0ff]/50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
