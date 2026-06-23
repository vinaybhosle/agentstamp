"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Wallet,
  User,
  FileText,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  Shield,
  Zap,
  Crown,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import {
  type StampTier,
  type StampResult,
  NoWalletError,
  UserRejectedError,
  BackendError,
  payAndMintStamp,
} from "@/lib/payment";
import { track } from "@/lib/analytics";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://agentstamp.org";

const CATEGORIES = [
  "research",
  "trading",
  "data",
  "creative",
  "communication",
  "security",
  "infrastructure",
  "other",
];

// ---------------------------------------------------------------------------
// Tier metadata
// ---------------------------------------------------------------------------

interface TierMeta {
  tier: StampTier;
  label: string;
  price: string;
  validity: string;
  hint: string;
  color: string;
  textColor: string;
  borderColor: string;
  badgeColor: string;
  maxValueUsdc: bigint; // in USDC base units (6 decimals)
}

const TIERS: TierMeta[] = [
  {
    tier: "bronze",
    label: "Bronze",
    price: "$0.001",
    validity: "24h",
    hint: "Try paid verification for a day",
    color: "#CD7F32",
    textColor: "text-[#CD7F32]",
    borderColor: "border-[#CD7F32]",
    badgeColor: "bg-[#CD7F32]/10",
    maxValueUsdc: BigInt(1_000), // $0.001 = 1000 units (6 dec)
  },
  {
    tier: "silver",
    label: "Silver",
    price: "$0.005",
    validity: "7d",
    hint: "Weekly stamp, higher trust score",
    color: "#C0C0C0",
    textColor: "text-[#C0C0C0]",
    borderColor: "border-[#C0C0C0]",
    badgeColor: "bg-[#C0C0C0]/10",
    maxValueUsdc: BigInt(5_000), // $0.005
  },
  {
    tier: "gold",
    label: "Gold",
    price: "$0.01",
    validity: "30d",
    hint: "Monthly premium — top reputation tier",
    color: "#FFD700",
    textColor: "text-[#FFD700]",
    borderColor: "border-[#FFD700]",
    badgeColor: "bg-[#FFD700]/10",
    maxValueUsdc: BigInt(10_000), // $0.01
  },
];

// ---------------------------------------------------------------------------
// Paid-mint UI states
// ---------------------------------------------------------------------------

type PaidMintState =
  | { status: "idle" }
  | { status: "confirm"; tier: TierMeta }
  | { status: "connecting" }
  | { status: "awaiting-payment"; tier: TierMeta }
  | { status: "success"; stamp: StampResult; tier: TierMeta }
  | { status: "error"; message: string; tier?: TierMeta; paymentMaybeCharged?: boolean };

// ---------------------------------------------------------------------------
// Free-mint registration result
// ---------------------------------------------------------------------------

interface RegistrationResult {
  agent: {
    id: string;
    name: string;
    category: string;
    expires_at: string;
  };
  stamp?: {
    id: string;
    tier: string;
    expires_at: string;
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RegistrationResult | null>(null);

  // Form fields
  const [walletAddress, setWalletAddress] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [capabilities, setCapabilities] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");

  // Paid mint state
  const [paidMint, setPaidMint] = useState<PaidMintState>({ status: "idle" });

  // Upgrade card ref for IntersectionObserver
  const upgradeCardRef = useRef<HTMLDivElement>(null);
  const upgradeViewTracked = useRef(false);

  const canProceedStep1 = walletAddress.length >= 10;
  const canProceedStep2 =
    name.length >= 2 && description.length >= 10 && category;

  // ---------------------------------------------------------------------------
  // Analytics: register_view on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    track("register_view");
  }, []);

  // ---------------------------------------------------------------------------
  // Analytics: upgrade_card_view via IntersectionObserver
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!upgradeCardRef.current || upgradeViewTracked.current) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !upgradeViewTracked.current) {
            upgradeViewTracked.current = true;
            track("upgrade_card_view");
            observer.disconnect();
          }
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(upgradeCardRef.current);
    return () => observer.disconnect();
  }, [step]); // re-run when step changes so the ref is in the DOM

  // ---------------------------------------------------------------------------
  // Free mint
  // ---------------------------------------------------------------------------
  async function handleRegister() {
    setLoading(true);
    setError("");

    try {
      const caps = capabilities
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 3);

      const res = await fetch(`${API_BASE}/api/v1/registry/register/free`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: walletAddress,
          name,
          description,
          category,
          capabilities: caps.length > 0 ? caps : [category],
          endpoint_url: endpointUrl || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed. Please try again.");
        return;
      }

      setResult(data);
      track("free_mint_success");
      setStep(4);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Paid mint — tier badge click handler
  // ---------------------------------------------------------------------------
  function handleTierClick(tierMeta: TierMeta) {
    track("pay_click", { tier: tierMeta.tier, price: tierMeta.price });
    setPaidMint({ status: "confirm", tier: tierMeta });
  }

  async function handleConfirmPay(tierMeta: TierMeta) {
    setPaidMint({ status: "connecting" });

    try {
      setPaidMint({ status: "awaiting-payment", tier: tierMeta });

      const stamp = await payAndMintStamp({
        tier: tierMeta.tier,
        name: name || undefined,
        apiBase: API_BASE,
        maxValueUsdc: tierMeta.maxValueUsdc,
      });

      track("paid_mint_success", { tier: tierMeta.tier });
      setPaidMint({ status: "success", stamp, tier: tierMeta });
    } catch (err: unknown) {
      let reason = "unknown";
      let message = "Payment failed. Please try again.";

      // If the request reached the backend (any BackendError other than a 402
      // "payment required"), the x402 payment was already accepted — so a naive
      // retry would charge the user a SECOND time. Flag it and suppress retry.
      const paymentMaybeCharged =
        err instanceof BackendError && err.statusCode !== 402;

      if (err instanceof NoWalletError) {
        reason = "no-wallet";
        message = err.message;
      } else if (err instanceof UserRejectedError) {
        reason = "user-rejected";
        message = "You rejected the request. No payment was taken.";
      } else if (err instanceof BackendError) {
        reason = "backend-error";
        // Defense-in-depth: cap + flatten any server error text before display.
        message = err.message.replace(/\s+/g, " ").trim().slice(0, 200);
      } else if (err instanceof Error) {
        reason = err.message.includes("payment") ? "payment-failed" : "unknown";
        message = err.message.replace(/\s+/g, " ").trim().slice(0, 200);
      }

      track("pay_error", { reason });
      setPaidMint({ status: "error", message, tier: tierMeta, paymentMaybeCharged });
    }
  }

  function handleCancelPay() {
    setPaidMint({ status: "idle" });
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderPaidMintOverlay() {
    if (paidMint.status === "idle") return null;

    if (paidMint.status === "confirm") {
      const t = paidMint.tier;
      return (
        <div className="mt-4 rounded-lg border border-[#ffaa00]/30 bg-[#111118] p-5">
          <p className="text-sm font-semibold text-[#e8e8ed] mb-1">
            Confirm Paid Stamp — {t.label}
          </p>
          <p className="text-xs text-[#6b6b80] mb-3">
            You will pay exactly{" "}
            <span className={`font-bold ${t.textColor}`}>{t.price} USDC</span> on Base
            for a {t.validity} stamp. Your wallet will prompt for signature and
            payment. No payment is taken until you approve both.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => handleConfirmPay(t)}
              className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold text-[#050508] transition-all`}
              style={{ backgroundColor: t.color }}
            >
              <Zap className="size-3.5" />
              Pay {t.price} &amp; Mint
            </button>
            <button
              onClick={handleCancelPay}
              className="inline-flex items-center gap-2 rounded-lg border border-[#1e1e2a] px-5 py-2 text-sm text-[#6b6b80] hover:text-[#e8e8ed] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    if (
      paidMint.status === "connecting" ||
      paidMint.status === "awaiting-payment"
    ) {
      const label =
        paidMint.status === "connecting"
          ? "Connecting wallet…"
          : "Awaiting payment approval in your wallet…";
      return (
        <div className="mt-4 rounded-lg border border-[#ffaa00]/20 bg-[#111118] p-4 flex items-center gap-3">
          <Loader2 className="size-4 animate-spin text-[#ffaa00]" />
          <p className="text-sm text-[#6b6b80]">{label}</p>
        </div>
      );
    }

    if (paidMint.status === "error") {
      const maybeCharged = paidMint.paymentMaybeCharged === true;
      return (
        <div className="mt-4 rounded-lg border border-[#ff4444]/20 bg-[#ff4444]/5 p-4">
          <div className="flex items-start gap-2 mb-2">
            <AlertCircle className="size-4 text-[#ff4444] mt-0.5 shrink-0" />
            <p className="text-sm text-[#ff4444]">{paidMint.message}</p>
          </div>
          {maybeCharged && (
            <p className="text-xs text-[#ffaa00] mb-1">
              ⚠️ Your payment may have already been processed. Do not retry — that
              could charge you again. Verify your stamp below or contact support.
            </p>
          )}
          <div className="flex gap-3 mt-3">
            {/* Only offer Retry when we are confident NO payment was taken
                (no-wallet, user-rejected, or a pre-payment failure). If the
                request reached the backend, retry would double-charge. */}
            {paidMint.tier && !maybeCharged && (
              <button
                onClick={() =>
                  paidMint.tier && handleConfirmPay(paidMint.tier)
                }
                className="text-xs text-[#ffaa00] hover:underline"
              >
                Retry
              </button>
            )}
            {maybeCharged && (
              <Link
                href="/verify"
                className="text-xs text-[#00ff88] hover:underline"
              >
                Verify my stamp
              </Link>
            )}
            <button
              onClick={handleCancelPay}
              className="text-xs text-[#6b6b80] hover:text-[#e8e8ed]"
            >
              Dismiss
            </button>
            <a
              href={maybeCharged ? "mailto:vinay@agentstamp.org" : "/docs"}
              className="text-xs text-[#00f0ff] hover:underline ml-auto"
            >
              {maybeCharged ? "Contact support" : "Use the API instead"}
            </a>
          </div>
        </div>
      );
    }

    if (paidMint.status === "success") {
      const t = paidMint.tier;
      const s = paidMint.stamp;
      return (
        <div className="mt-4 rounded-lg border border-[#00ff88]/20 bg-[#00ff88]/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="size-4 text-[#00ff88]" />
            <p className="text-sm font-bold text-[#00ff88]">
              {t.label} Stamp Minted!
            </p>
          </div>
          <div className="space-y-1.5 text-xs mb-4">
            <div className="flex justify-between">
              <span className="text-[#6b6b80]">Stamp ID</span>
              <span className="font-mono text-[#00f0ff]">{s.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6b6b80]">Tier</span>
              <span className={`capitalize font-semibold ${t.textColor}`}>
                {s.tier}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6b6b80]">Valid until</span>
              <span className="text-[#e8e8ed]">
                {new Date(s.expires_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          {s.verify_url && (
            <a
              href={s.verify_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#00f0ff] hover:underline"
            >
              <ExternalLink className="size-3" />
              View signed certificate
            </a>
          )}
        </div>
      );
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#00ff88]/20 bg-[#00ff88]/5 px-4 py-1.5 text-sm text-[#00ff88] mb-6">
          <Sparkles className="size-4" />
          Free — No payment required
        </div>
        <h1 className="text-4xl font-bold text-[#e8e8ed]">Register Your Agent</h1>
        <p className="mt-3 text-[#6b6b80] max-w-lg mx-auto">
          Get your agent into the registry in 60 seconds. Free tier includes 30-day registration
          and a 7-day verification stamp.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-3 mb-10">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                s === step
                  ? "bg-[#00f0ff] text-[#050508]"
                  : s < step
                    ? "bg-[#00ff88] text-[#050508]"
                    : "bg-[#1e1e2a] text-[#6b6b80]"
              }`}
            >
              {s < step ? <CheckCircle2 className="size-4" /> : s}
            </div>
            {s < 4 && (
              <div
                className={`w-8 h-px ${s < step ? "bg-[#00ff88]" : "bg-[#1e1e2a]"}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Labels */}
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-[#6b6b80] mb-8 px-2">
        <span className={step >= 1 ? "text-[#00f0ff]" : ""}>Wallet</span>
        <span className={step >= 2 ? "text-[#00f0ff]" : ""}>Details</span>
        <span className={step >= 3 ? "text-[#00f0ff]" : ""}>Confirm</span>
        <span className={step >= 4 ? "text-[#00ff88]" : ""}>Done</span>
      </div>

      {/* Step 1: Wallet */}
      {step === 1 && (
        <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-lg bg-[#00f0ff]/10 p-2.5">
              <Wallet className="size-5 text-[#00f0ff]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#e8e8ed]">Wallet Address</h2>
              <p className="text-xs text-[#6b6b80]">Your agent&apos;s identity on the network</p>
            </div>
          </div>

          <label className="block mb-2 text-sm text-[#6b6b80]">
            Ethereum / Base wallet address
          </label>
          <input
            type="text"
            placeholder="0x..."
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            className="w-full rounded-lg border border-[#1e1e2a] bg-[#050508] px-4 py-3 text-sm font-mono text-[#e8e8ed] placeholder-[#3a3a4a] focus:border-[#00f0ff]/50 focus:outline-none focus:ring-1 focus:ring-[#00f0ff]/20 transition-colors"
          />

          <div className="mt-8 flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="inline-flex items-center gap-2 rounded-lg bg-[#00f0ff] px-6 py-2.5 text-sm font-semibold text-[#050508] transition-all hover:bg-[#00f0ff]/90 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Continue
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Agent Details */}
      {step === 2 && (
        <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-lg bg-[#00f0ff]/10 p-2.5">
              <User className="size-5 text-[#00f0ff]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#e8e8ed]">Agent Details</h2>
              <p className="text-xs text-[#6b6b80]">Tell the world about your agent</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block mb-2 text-sm text-[#6b6b80]">Agent Name *</label>
              <input
                type="text"
                placeholder="My Awesome Agent"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-[#1e1e2a] bg-[#050508] px-4 py-3 text-sm text-[#e8e8ed] placeholder-[#3a3a4a] focus:border-[#00f0ff]/50 focus:outline-none focus:ring-1 focus:ring-[#00f0ff]/20 transition-colors"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm text-[#6b6b80]">Description *</label>
              <textarea
                placeholder="What does your agent do? (min 10 characters)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-[#1e1e2a] bg-[#050508] px-4 py-3 text-sm text-[#e8e8ed] placeholder-[#3a3a4a] focus:border-[#00f0ff]/50 focus:outline-none focus:ring-1 focus:ring-[#00f0ff]/20 transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm text-[#6b6b80]">Category *</label>
              <div className="grid grid-cols-4 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-all ${
                      category === cat
                        ? "border-[#00f0ff] bg-[#00f0ff]/10 text-[#00f0ff]"
                        : "border-[#1e1e2a] bg-[#050508] text-[#6b6b80] hover:border-[#00f0ff]/30"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block mb-2 text-sm text-[#6b6b80]">
                Capabilities <span className="text-[#3a3a4a]">(comma-separated, max 3)</span>
              </label>
              <input
                type="text"
                placeholder="data analysis, web scraping, report generation"
                value={capabilities}
                onChange={(e) => setCapabilities(e.target.value)}
                className="w-full rounded-lg border border-[#1e1e2a] bg-[#050508] px-4 py-3 text-sm text-[#e8e8ed] placeholder-[#3a3a4a] focus:border-[#00f0ff]/50 focus:outline-none focus:ring-1 focus:ring-[#00f0ff]/20 transition-colors"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm text-[#6b6b80]">
                Endpoint URL <span className="text-[#3a3a4a]">(optional)</span>
              </label>
              <input
                type="url"
                placeholder="https://myagent.example.com"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                className="w-full rounded-lg border border-[#1e1e2a] bg-[#050508] px-4 py-3 text-sm font-mono text-[#e8e8ed] placeholder-[#3a3a4a] focus:border-[#00f0ff]/50 focus:outline-none focus:ring-1 focus:ring-[#00f0ff]/20 transition-colors"
              />
            </div>
          </div>

          <div className="mt-8 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#1e1e2a] px-5 py-2.5 text-sm text-[#6b6b80] hover:text-[#e8e8ed] hover:border-[#00f0ff]/30 transition-colors"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!canProceedStep2}
              className="inline-flex items-center gap-2 rounded-lg bg-[#00f0ff] px-6 py-2.5 text-sm font-semibold text-[#050508] transition-all hover:bg-[#00f0ff]/90 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Review
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-lg bg-[#00f0ff]/10 p-2.5">
              <FileText className="size-5 text-[#00f0ff]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#e8e8ed]">Confirm Registration</h2>
              <p className="text-xs text-[#6b6b80]">Review your details before submitting</p>
            </div>
          </div>

          <div className="rounded-lg bg-[#050508] border border-[#1e1e2a] p-5 space-y-3 mb-6">
            <div className="flex justify-between">
              <span className="text-xs text-[#6b6b80]">Wallet</span>
              <span className="text-xs font-mono text-[#e8e8ed]">
                {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-[#6b6b80]">Name</span>
              <span className="text-xs text-[#e8e8ed]">{name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-[#6b6b80]">Category</span>
              <span className="text-xs text-[#00f0ff] capitalize">{category}</span>
            </div>
            {capabilities && (
              <div className="flex justify-between">
                <span className="text-xs text-[#6b6b80]">Capabilities</span>
                <span className="text-xs text-[#e8e8ed]">
                  {capabilities.split(",").filter(Boolean).slice(0, 3).join(", ")}
                </span>
              </div>
            )}
            <div className="border-t border-[#1e1e2a] pt-3 flex justify-between">
              <span className="text-xs text-[#6b6b80]">Plan</span>
              <span className="text-xs text-[#00ff88] font-semibold">Free (30 days)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-[#6b6b80]">Cost</span>
              <span className="text-xs text-[#00ff88] font-bold">$0.00</span>
            </div>
          </div>

          {/* What you get */}
          <div className="rounded-lg border border-[#00ff88]/20 bg-[#00ff88]/5 p-4 mb-6">
            <p className="text-xs font-semibold text-[#00ff88] mb-2">What you get:</p>
            <ul className="space-y-1.5 text-xs text-[#6b6b80]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3 text-[#00ff88]" />
                30-day agent registration in the public registry
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3 text-[#00ff88]" />
                7-day free verification stamp
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3 text-[#00ff88]" />
                Reputation score tracking
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3 text-[#00ff88]" />
                Embeddable trust badge
              </li>
            </ul>
          </div>

          {error && (
            <div className="rounded-lg border border-[#ff4444]/20 bg-[#ff4444]/5 p-3 mb-4">
              <p className="text-xs text-[#ff4444]">{error}</p>
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#1e1e2a] px-5 py-2.5 text-sm text-[#6b6b80] hover:text-[#e8e8ed] hover:border-[#00f0ff]/30 transition-colors"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            <button
              onClick={handleRegister}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-[#00ff88] px-6 py-2.5 text-sm font-bold text-[#050508] transition-all hover:bg-[#00ff88]/90 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  Register Free
                  <Zap className="size-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Success */}
      {step === 4 && result && (
        <div className="rounded-xl border border-[#00ff88]/20 bg-[#111118] p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#00ff88]/10 mb-6">
            <CheckCircle2 className="size-8 text-[#00ff88]" />
          </div>

          <h2 className="text-2xl font-bold text-[#e8e8ed] mb-2">Agent Registered!</h2>
          <p className="text-sm text-[#6b6b80] mb-6">
            Your agent <span className="text-[#00f0ff] font-medium">{result.agent.name}</span> is now live in the registry.
          </p>

          <div className="rounded-lg bg-[#050508] border border-[#1e1e2a] p-5 text-left space-y-3 mb-8">
            <div className="flex justify-between">
              <span className="text-xs text-[#6b6b80]">Agent ID</span>
              <span className="text-xs font-mono text-[#00f0ff]">{result.agent.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-[#6b6b80]">Category</span>
              <span className="text-xs text-[#e8e8ed] capitalize">{result.agent.category}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-[#6b6b80]">Registration Expires</span>
              <span className="text-xs text-[#e8e8ed]">
                {new Date(result.agent.expires_at).toLocaleDateString()}
              </span>
            </div>
            {result.stamp && (
              <>
                <div className="border-t border-[#1e1e2a] pt-3 flex justify-between">
                  <span className="text-xs text-[#6b6b80]">Stamp ID</span>
                  <span className="text-xs font-mono text-[#00f0ff]">{result.stamp.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-[#6b6b80]">Stamp Tier</span>
                  <span className="text-xs text-[#6b6b80] capitalize">{result.stamp.tier}</span>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
            <Link
              href={`/registry/${result.agent.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-[#00f0ff] px-6 py-2.5 text-sm font-semibold text-[#050508] hover:bg-[#00f0ff]/90 transition-all"
            >
              View Agent Profile
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/registry"
              className="inline-flex items-center gap-2 rounded-lg border border-[#1e1e2a] px-6 py-2.5 text-sm text-[#6b6b80] hover:text-[#e8e8ed] hover:border-[#00f0ff]/30 transition-colors"
            >
              Browse Registry
            </Link>
          </div>

          {/* Upgrade CTA — tier badges are now clickable pay buttons */}
          <div ref={upgradeCardRef} className="rounded-lg border border-[#ffaa00]/20 bg-[#ffaa00]/5 p-5">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Crown className="size-4 text-[#ffaa00]" />
              <p className="text-sm font-semibold text-[#ffaa00]">Upgrade for More</p>
            </div>
            <p className="text-xs text-[#6b6b80] mb-4">
              Upgrade to a paid tier for permanent registration, higher reputation scores, and
              premium verification stamps. Pay with USDC on Base — no account needed.
            </p>

            {/* Tier badges — clickable */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mb-3">
              {TIERS.map((t) => (
                <button
                  key={t.tier}
                  onClick={() => handleTierClick(t)}
                  disabled={paidMint.status !== "idle" && paidMint.status !== "error"}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-4 py-3 transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ${t.badgeColor} ${t.borderColor}`}
                  style={{ borderColor: `${t.color}44` }}
                >
                  <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${t.textColor}`}>
                    <Shield className="size-3.5" />
                    {t.label} {t.price}
                  </span>
                  <span className="text-[10px] text-[#6b6b80]">{t.validity} · {t.hint}</span>
                </button>
              ))}
            </div>

            {/* Paid mint overlay (confirm / loading / success / error) */}
            {renderPaidMintOverlay()}

            {/* Fallback API link — always visible */}
            <p className="mt-3 text-[10px] text-[#3a3a4a] text-center">
              No wallet extension?{" "}
              <Link href="/docs" className="text-[#00f0ff] hover:underline">
                Use the API for paid registration
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Bottom info */}
      {step < 4 && (
        <div className="mt-8 text-center text-xs text-[#3a3a4a]">
          <p>
            Already have a paid wallet?{" "}
            <Link href="/docs" className="text-[#00f0ff] hover:underline">
              Use the API for paid registration
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
