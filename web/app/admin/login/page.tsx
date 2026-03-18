"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, AlertCircle, ArrowRight } from "lucide-react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/admin/analytics");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Invalid password");
      }
    } catch {
      setError("Connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#111118] border border-[#1e1e2a] mb-4">
            <Lock className="size-5 text-[#00f0ff]" />
          </div>
          <h1 className="text-2xl font-bold text-[#e8e8ed]">Admin Access</h1>
          <p className="text-sm text-[#6b6b80] mt-1">
            AgentStamp Analytics Dashboard
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-[#1e1e2a] bg-[#111118] p-6 space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-xs text-[#6b6b80] uppercase tracking-wider mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[#1e1e2a] bg-[#050508] px-4 py-3 text-sm text-[#e8e8ed] placeholder-[#6b6b80] focus:border-[#00f0ff] focus:outline-none focus:ring-1 focus:ring-[#00f0ff] transition-colors"
                placeholder="Enter admin password"
                autoFocus
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-[#ff4444] bg-[#ff4444]/10 rounded-lg px-3 py-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#00f0ff] to-[#00ff88] px-4 py-3 text-sm font-medium text-[#050508] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin size-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Authenticating...
                </span>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </div>
        </form>

        <p className="text-center text-[10px] text-[#6b6b80] mt-6">
          Protected admin area. Unauthorized access is prohibited.
        </p>
      </div>
    </div>
  );
}
