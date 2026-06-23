/**
 * Cookieless funnel analytics beacon.
 *
 * - Fire-and-forget: never throws, never blocks rendering
 * - Uses sendBeacon (fallback: fetch keepalive)
 * - anon_id is a random UUID stored in sessionStorage — NOT a wallet address, NOT PII
 * - Captures referrer and UTM params automatically
 * - Safe for SSR: all browser API access is guarded
 */

// ---------------------------------------------------------------------------
// Event names (export so callers get type safety)
// ---------------------------------------------------------------------------

export type FunnelEvent =
  | "register_view"
  | "free_mint_success"
  | "upgrade_card_view"
  | "pay_click"
  | "paid_mint_success"
  | "pay_error";

interface TrackProps {
  [key: string]: string | number | boolean | undefined;
}

// ---------------------------------------------------------------------------
// anon_id — one random UUID per browser session, no wallet, no PII
// ---------------------------------------------------------------------------

const ANON_KEY = "as_anon_id";

function getAnonId(): string {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return "ssr";
  }
  const existing = sessionStorage.getItem(ANON_KEY);
  if (existing) return existing;
  // crypto.randomUUID is available in all modern browsers and Node ≥ 14.17.
  // Fall back to crypto.getRandomValues (still unpredictable) before Math.random.
  let id: string;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    id = crypto.randomUUID();
  } else if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  } else {
    id = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }
  sessionStorage.setItem(ANON_KEY, id);
  return id;
}

// ---------------------------------------------------------------------------
// UTM / referrer helpers — parsed once per call (URL may change)
// ---------------------------------------------------------------------------

function getUtmParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ]) {
    const val = params.get(key);
    if (val) utm[key] = val;
  }
  return utm;
}

function getReferrer(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.referrer || undefined;
}

// ---------------------------------------------------------------------------
// API base — mirrors register/page.tsx pattern
// ---------------------------------------------------------------------------

function getApiBase(): string {
  return (
    (typeof process !== "undefined" &&
      process.env?.NEXT_PUBLIC_API_URL) ||
    "https://agentstamp.org"
  );
}

// ---------------------------------------------------------------------------
// track — the public API
// ---------------------------------------------------------------------------

export function track(event: FunnelEvent, props?: TrackProps): void {
  // Never run on the server
  if (typeof window === "undefined") return;

  const payload = {
    event,
    anon_id: getAnonId(),
    timestamp: new Date().toISOString(),
    referrer: getReferrer(),
    ...getUtmParams(),
    ...(props ?? {}),
  };

  const url = `${getApiBase()}/api/v1/funnel/event`;
  const body = JSON.stringify(payload);

  // Primary: sendBeacon (survives page unload)
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const sent = navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    if (sent) return;
  }

  // Fallback: keepalive fetch — also fire-and-forget, with a short timeout so a
  // slow analytics endpoint can never hold a connection open on the page.
  const timeoutSignal =
    typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(3000)
      : undefined;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    signal: timeoutSignal,
  }).catch(() => {
    // Intentionally swallowed — analytics must never crash the page
  });
}
