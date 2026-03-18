"use client";

import { useState } from "react";
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
} from "lucide-react";

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

  const canProceedStep1 = walletAddress.length >= 10;
  const canProceedStep2 = name.length >= 2 && description.length >= 10 && category;

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
      setStep(4);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

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

          {/* Upgrade CTA */}
          <div className="rounded-lg border border-[#ffaa00]/20 bg-[#ffaa00]/5 p-5">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Crown className="size-4 text-[#ffaa00]" />
              <p className="text-sm font-semibold text-[#ffaa00]">Upgrade for More</p>
            </div>
            <p className="text-xs text-[#6b6b80] mb-3">
              Upgrade to a paid tier for permanent registration, higher reputation scores, and
              premium verification stamps.
            </p>
            <div className="flex items-center justify-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-[#CD7F32]">
                <Shield className="size-3" />
                Bronze $0.01
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#C0C0C0]">
                <Shield className="size-3" />
                Silver $0.01
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#FFD700]">
                <Shield className="size-3" />
                Gold $0.01
              </span>
            </div>
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
