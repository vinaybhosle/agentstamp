import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";

const API_URL = process.env.API_URL || "http://localhost:4005";
const ANALYTICS_KEY = process.env.ANALYTICS_KEY;

export async function GET(request: NextRequest) {
  // Verify admin session
  const session = await getSessionFromCookies();
  if (!session.valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ANALYTICS_KEY) {
    return NextResponse.json(
      { error: "Analytics not configured" },
      { status: 503 }
    );
  }

  const days = request.nextUrl.searchParams.get("days") || "30";

  try {
    const res = await fetch(
      `${API_URL}/api/v1/analytics/dashboard?days=${days}`,
      {
        cache: "no-store",
        headers: { "X-Analytics-Key": ANALYTICS_KEY },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Backend error: ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Analytics proxy error:", err);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 502 }
    );
  }
}
