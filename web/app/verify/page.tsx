"use client";

import { useState, useCallback } from "react";
import {
  Search,
  ShieldCheck,
  ShieldX,
  Wallet,
  Calendar,
  Key,
  FileJson,
  Loader2,
} from "lucide-react";
import { CopyButton } from "@/components/CopyButton";

interface VerifyResult {
  success: boolean;
  valid: boolean;
  expired?: boolean;
  revoked?: boolean;
  stamp?: {
    id: string;
    tier: string;
    wallet_address: string;
    issued_at: string;
    expires_at: string;
    certificate: string;
  };
  public_key?: string;
  error?: string;
}

export default function VerifyPage() {
  const [stampId, setStampId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleVerify = useCallback(async () => {
    const id = stampId.trim();
    if (!id) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSearched(true);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${baseUrl}/api/v1/stamp/verify/${encodeURIComponent(id)}`);
      if (!res.ok) {
        if (res.status === 404) {
          setResult({
            success: false,
            valid: false,
            error: "Stamp not found. Please check the ID and try again.",
          });
        } else {
          throw new Error(`Verification failed (${res.status})`);
        }
        return;
      }
      const data: VerifyResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [stampId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleVerify();
  };

  const cert = result?.stamp?.certificate
    ? (() => { try { return JSON.parse(result.stamp!.certificate); } catch { return null; } })()
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-[#e8e8ed] flex items-center justify-center gap-3">
          <ShieldCheck className="size-8 text-[#00f0ff]" />
          Verify a Stamp
        </h1>
        <p className="mt-3 text-[#6b6b80] max-w-lg mx-auto">
          Enter a stamp ID to verify its authenticity and view the full
          certification details.
        </p>
      </div>

      {/* Input */}
      <div className="relative mb-10">
        <input
          type="text"
          placeholder="Enter stamp ID (e.g. stmp_QLNhL-Y1CvlyWxnG)"
          value={stampId}
          onChange={(e) => setStampId(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-xl border border-[#1e1e2a] bg-[#111118] px-6 py-4 text-base font-mono text-[#e8e8ed] placeholder-[#6b6b80] focus:outline-none focus:border-[#00f0ff]/50 focus:ring-2 focus:ring-[#00f0ff]/20 transition-all"
        />
        <button
          onClick={handleVerify}
          disabled={loading || !stampId.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-[#00f0ff] px-5 py-2.5 text-sm font-semibold text-[#050508] transition-all hover:bg-[#00f0ff]/90 hover:shadow-[0_0_20px_rgba(0,240,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Verifying
            </>
          ) : (
            <>
              <Search className="size-4" />
              Verify
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-[#ff4444]/30 bg-[#ff4444]/5 p-6 text-center mb-8">
          <ShieldX className="size-8 text-[#ff4444] mx-auto mb-3" />
          <p className="text-sm text-[#ff4444]">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-6">
          {/* Valid / Invalid Banner */}
          <div
            className={`rounded-xl border p-6 text-center ${
              result.valid
                ? "border-[#00ff88]/30 bg-[#00ff88]/5"
                : "border-[#ff4444]/30 bg-[#ff4444]/5"
            }`}
          >
            {result.valid ? (
              <div className="flex flex-col items-center gap-3">
                <ShieldCheck className="size-12 text-[#00ff88]" />
                <h2 className="text-xl font-bold text-[#00ff88]">Valid Stamp</h2>
                <p className="text-sm text-[#6b6b80]">This stamp is authentic and verified.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <ShieldX className="size-12 text-[#ff4444]" />
                <h2 className="text-xl font-bold text-[#ff4444]">
                  {result.error ? "Not Found" : result.expired ? "Expired Stamp" : result.revoked ? "Revoked Stamp" : "Invalid Stamp"}
                </h2>
                <p className="text-sm text-[#6b6b80]">
                  {result.error || (result.expired ? "This stamp has expired." : result.revoked ? "This stamp has been revoked." : "This stamp could not be verified.")}
                </p>
              </div>
            )}
          </div>

          {/* Stamp Details */}
          {result.stamp && (
            <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-6 space-y-4">
              <h3 className="text-sm font-semibold text-[#e8e8ed] uppercase tracking-wider">
                Stamp Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#6b6b80]">ID</span>
                  <span className="text-sm font-mono text-[#e8e8ed]">{result.stamp.id}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#6b6b80]">Tier</span>
                  <span className={`text-sm font-semibold uppercase ${
                    result.stamp.tier === "gold" ? "text-yellow-400" :
                    result.stamp.tier === "silver" ? "text-gray-300" :
                    "text-amber-500"
                  }`}>
                    {result.stamp.tier}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Wallet className="size-4 text-[#6b6b80] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-[#6b6b80]">Wallet</p>
                  <p className="text-sm font-mono text-[#e8e8ed] break-all">
                    {result.stamp.wallet_address}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="size-4 text-[#6b6b80] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-[#6b6b80]">Issued</p>
                  <p className="text-sm text-[#e8e8ed]">
                    {new Date(result.stamp.issued_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="size-4 text-[#6b6b80] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-[#6b6b80]">Expires</p>
                  <p className="text-sm text-[#e8e8ed]">
                    {new Date(result.stamp.expires_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Public Key */}
          {result.public_key && (
            <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#e8e8ed] uppercase tracking-wider flex items-center gap-2">
                  <Key className="size-4 text-[#00f0ff]" />
                  Public Key
                </h3>
                <CopyButton text={result.public_key} />
              </div>
              <p className="text-xs font-mono text-[#6b6b80] break-all bg-[#050508] border border-[#1e1e2a] rounded-lg p-3">
                {result.public_key}
              </p>
            </div>
          )}

          {/* Certificate JSON */}
          {cert && (
            <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#e8e8ed] uppercase tracking-wider flex items-center gap-2">
                  <FileJson className="size-4 text-[#00f0ff]" />
                  Certificate
                </h3>
                <CopyButton text={JSON.stringify(cert, null, 2)} />
              </div>
              <pre className="rounded-lg bg-[#050508] border border-[#1e1e2a] p-4 text-xs font-mono text-[#6b6b80] overflow-x-auto max-h-80 overflow-y-auto">
                {JSON.stringify(cert, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Empty state before search */}
      {!searched && !result && !error && (
        <div className="text-center py-16">
          <ShieldCheck className="size-16 text-[#1e1e2a] mx-auto mb-4" />
          <p className="text-sm text-[#6b6b80]">
            Enter a stamp ID above to verify its authenticity.
          </p>
        </div>
      )}
    </div>
  );
}
