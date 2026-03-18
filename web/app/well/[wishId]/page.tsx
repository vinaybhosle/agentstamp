import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Calendar,
  Wallet,
  Shield,
  Tag,
} from "lucide-react";
import { CategoryBadge } from "@/components/CategoryBadge";
import type { Wish } from "@/types";
import type { Metadata } from "next";

const API_BASE = process.env.API_URL || "http://localhost:4005";

interface Grant {
  wallet_address: string;
  amount: string;
  created_at: string;
}

interface WishResponse extends Wish {
  grants?: Grant[];
}

async function getWish(wishId: string): Promise<WishResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/well/wish/${wishId}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.wish ? { ...json.wish, grants: json.grants } : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ wishId: string }>;
}): Promise<Metadata> {
  const { wishId } = await params;
  const wish = await getWish(wishId);
  if (!wish) return { title: "Wish Not Found" };
  return {
    title: wish.wish_text.slice(0, 60),
    description: wish.wish_text,
  };
}


export default async function WishDetailPage({
  params,
}: {
  params: Promise<{ wishId: string }>;
}) {
  const { wishId } = await params;
  const wish = await getWish(wishId);

  if (!wish) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Back */}
      <Link
        href="/well"
        className="inline-flex items-center gap-2 text-sm text-[#6b6b80] hover:text-[#00ff88] transition-colors mb-8"
      >
        <ArrowLeft className="size-4" />
        Back to Wishing Well
      </Link>

      {/* Wish Header */}
      <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-8 mb-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="shrink-0 mt-1">
            <div className="inline-flex rounded-lg bg-[#00ff88]/10 p-3">
              <Sparkles className="size-6 text-[#00ff88]" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg sm:text-xl font-medium text-[#e8e8ed] leading-relaxed">
              {wish.wish_text}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <CategoryBadge category={wish.category} />
          {wish.granted ? (
            <span className="inline-flex items-center rounded-full border border-[#00ff88]/20 bg-[#00ff88]/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-[#00ff88]">
              granted
            </span>
          ) : null}
          <span className="text-xs text-[#6b6b80] flex items-center gap-1">
            <Shield className="size-3" />
            {wish.grant_count} grants
          </span>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#e8e8ed] uppercase tracking-wider">
            Details
          </h2>

          {wish.wallet_address && (
            <div className="flex items-start gap-3">
              <Wallet className="size-4 text-[#6b6b80] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-[#6b6b80]">Created by</p>
                <p className="text-sm font-mono text-[#e8e8ed] break-all">
                  {wish.wallet_address}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <Calendar className="size-4 text-[#6b6b80] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-[#6b6b80]">Created</p>
              <p className="text-sm text-[#e8e8ed]">
                {new Date(wish.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Tag className="size-4 text-[#6b6b80] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-[#6b6b80]">Category</p>
              <p className="text-sm text-[#e8e8ed] capitalize">{wish.category}</p>
            </div>
          </div>
        </div>

      </div>

      {/* Grant History */}
      {wish.grants && wish.grants.length > 0 && (
        <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-6">
          <h2 className="text-sm font-semibold text-[#e8e8ed] uppercase tracking-wider mb-4">
            Grant History
          </h2>
          <div className="space-y-3">
            {wish.grants.map((grant, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-[#050508] border border-[#1e1e2a] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Wallet className="size-4 text-[#6b6b80]" />
                  <div>
                    <p className="text-sm font-mono text-[#e8e8ed]">
                      {grant.wallet_address.slice(0, 6)}...{grant.wallet_address.slice(-4)}
                    </p>
                    <p className="text-xs text-[#6b6b80]">{grant.amount}</p>
                  </div>
                </div>
                <span className="text-xs text-[#6b6b80]">
                  {new Date(grant.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
