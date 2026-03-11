"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldX,
  Key,
  Calendar,
  Wallet,
  FileJson,
  Loader2,
  ArrowLeft,
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

export default function DirectVerifyPage({
  params,
}: {
  params: Promise<{ certId: string }>;
}) {
  const { certId } = use(params);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(
        `${baseUrl}/api/v1/stamp/verify/${encodeURIComponent(certId)}`
      );
      if (!res.ok) {
        if (res.status === 404) {
          setResult({
            success: false,
            valid: false,
            error: "Stamp not found. The certificate ID may be invalid.",
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
  }, [certId]);

  useEffect(() => {
    verify();
  }, [verify]);

  const cert = result?.stamp?.certificate
    ? (() => { try { return JSON.parse(result.stamp!.certificate); } catch { return null; } })()
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Back */}
      <Link
        href="/verify"
        className="inline-flex items-center gap-2 text-sm text-[#6b6b80] hover:text-[#00f0ff] transition-colors mb-8"
      >
        <ArrowLeft className="size-4" />
        Back to Verification
      </Link>

      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-[#e8e8ed]">Stamp Verification</h1>
        <p className="mt-2 text-sm font-mono text-[#6b6b80] break-all">
          {certId}
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-20">
          <Loader2 className="size-10 text-[#00f0ff] animate-spin mx-auto mb-4" />
          <p className="text-sm text-[#6b6b80]">Verifying stamp...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-[#ff4444]/30 bg-[#ff4444]/5 p-6 text-center">
          <ShieldX className="size-8 text-[#ff4444] mx-auto mb-3" />
          <p className="text-sm text-[#ff4444]">{error}</p>
          <button
            onClick={verify}
            className="mt-4 rounded-lg border border-[#1e1e2a] px-4 py-2 text-sm text-[#e8e8ed] hover:border-[#00f0ff]/50 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="space-y-6">
          <div
            className={`rounded-xl border p-8 text-center ${
              result.valid
                ? "border-[#00ff88]/30 bg-[#00ff88]/5"
                : "border-[#ff4444]/30 bg-[#ff4444]/5"
            }`}
          >
            {result.valid ? (
              <div className="flex flex-col items-center gap-3">
                <ShieldCheck className="size-16 text-[#00ff88]" />
                <h2 className="text-2xl font-bold text-[#00ff88]">Valid Stamp</h2>
                <p className="text-sm text-[#6b6b80]">This stamp is authentic and verified.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <ShieldX className="size-16 text-[#ff4444]" />
                <h2 className="text-2xl font-bold text-[#ff4444]">
                  {result.error ? "Not Found" : result.expired ? "Expired" : result.revoked ? "Revoked" : "Invalid"}
                </h2>
                <p className="text-sm text-[#6b6b80]">
                  {result.error || "This stamp could not be verified."}
                </p>
              </div>
            )}
          </div>

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
    </div>
  );
}
