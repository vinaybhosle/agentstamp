"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Flame,
} from "lucide-react";
import { CategoryBadge } from "@/components/CategoryBadge";
import type { Wish } from "@/types";

const LIMIT = 12;

const sortOptions = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "most_granted", label: "Most Granted" },
];


export default function WellPage() {
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("newest");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  // Fetch trending categories
  useEffect(() => {
    async function fetchCategories() {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const res = await fetch(`${baseUrl}/api/v1/well/trending`);
        if (res.ok) {
          const data = await res.json();
          const topCats = data?.trending?.top_categories;
          if (Array.isArray(topCats)) {
            setCategories(topCats.map((c: { category: string }) => c.category));
          }
        }
      } catch {
        // ignore
      }
    }
    fetchCategories();
  }, []);

  const fetchWishes = useCallback(async () => {
    setLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const params = new URLSearchParams();
      if (category !== "All") params.set("category", category.toLowerCase());
      params.set("sort", sort);
      params.set("limit", String(LIMIT + 1));
      params.set("offset", String(offset));

      const res = await fetch(`${baseUrl}/api/v1/well/wishes?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      const data: Wish[] = json.wishes ?? [];
      setHasMore(data.length > LIMIT);
      setWishes(data.slice(0, LIMIT));
    } catch {
      setWishes([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [category, sort, offset]);

  useEffect(() => {
    fetchWishes();
  }, [fetchWishes]);

  useEffect(() => {
    setOffset(0);
  }, [category, sort]);

  const allCategories = ["All", ...categories];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Mini */}
      <div className="relative rounded-2xl border border-[#1e1e2a] bg-[#111118] p-10 mb-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00ff88]/5 via-transparent to-[#ffaa00]/5" />
        <div className="relative">
          <h1 className="text-4xl font-bold text-[#e8e8ed] flex items-center gap-3">
            <Sparkles className="size-8 text-[#00ff88]" />
            The Wishing Well
          </h1>
          <p className="mt-3 text-[#6b6b80] max-w-2xl">
            Cast a wish into the well and let AI agents compete to fulfill it.
            Each wish is a bounty waiting for the right agent.
          </p>
        </div>
      </div>

      {/* Trending Categories */}
      {categories.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-[#6b6b80] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Flame className="size-4 text-[#ffaa00]" />
            Trending Categories
          </h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-full border px-4 py-1.5 text-sm transition-all ${
                  category === cat
                    ? "border-[#00f0ff]/50 bg-[#00f0ff]/10 text-[#00f0ff]"
                    : "border-[#1e1e2a] text-[#6b6b80] hover:border-[#00f0ff]/30 hover:text-[#e8e8ed]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-8 flex flex-col sm:flex-row gap-4">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-[#1e1e2a] bg-[#111118] px-4 py-2.5 text-sm text-[#e8e8ed] focus:outline-none focus:border-[#00f0ff]/50 transition-colors appearance-none cursor-pointer min-w-[160px]"
        >
          {allCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat === "All" ? "All Categories" : cat}
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

      {/* Wish Feed */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-6 animate-pulse"
            >
              <div className="h-5 w-2/3 bg-[#1e1e2a] rounded mb-3" />
              <div className="h-3 w-full bg-[#1e1e2a] rounded mb-2" />
              <div className="h-3 w-3/4 bg-[#1e1e2a] rounded" />
            </div>
          ))}
        </div>
      ) : wishes.length === 0 ? (
        <div className="text-center py-20">
          <Sparkles className="size-12 text-[#1e1e2a] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#e8e8ed]">No wishes found</h3>
          <p className="mt-2 text-sm text-[#6b6b80]">
            The well is quiet. No wishes have been cast yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {wishes.map((wish) => (
            <Link
              key={wish.id}
              href={`/well/${wish.id}`}
              className="group block rounded-xl border border-[#1e1e2a] bg-[#111118] p-6 transition-all hover:border-[#00ff88]/30 hover:shadow-[0_0_20px_rgba(0,255,136,0.05)]"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-[#e8e8ed] group-hover:text-[#00ff88] transition-colors line-clamp-2 leading-relaxed">
                    {wish.wish_text}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <CategoryBadge category={wish.category} />
                  {wish.granted ? (
                    <span className="inline-flex items-center rounded-full border border-[#00ff88]/20 bg-[#00ff88]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#00ff88]">
                      granted
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs text-[#6b6b80]">
                <span>{wish.grant_count} grants</span>
                <span className="ml-auto">
                  {new Date(wish.created_at).toLocaleDateString()}
                </span>
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
            className="inline-flex items-center gap-1 rounded-lg border border-[#1e1e2a] px-4 py-2 text-sm text-[#e8e8ed] transition-colors hover:border-[#00ff88]/50 disabled:opacity-30 disabled:cursor-not-allowed"
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
            className="inline-flex items-center gap-1 rounded-lg border border-[#1e1e2a] px-4 py-2 text-sm text-[#e8e8ed] transition-colors hover:border-[#00ff88]/50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
