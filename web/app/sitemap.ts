import { MetadataRoute } from "next";

const API_BASE = process.env.API_URL || "http://localhost:4005";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://agentstamp.org";
  const now = new Date().toISOString();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/docs`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/registry`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/verify`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/well`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${baseUrl}/leaderboard`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/insights`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/blog/computer-use-trust-verification`, lastModified: "2026-03-25", changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/blog/why-agents-need-identity`, lastModified: "2026-03-21", changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/blog/trust-verification-3-lines`, lastModified: "2026-03-21", changeFrequency: "monthly", priority: 0.7 },
  ];

  // Dynamic agent pages
  let agentPages: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API_BASE}/api/v1/registry/browse?limit=100`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      agentPages = (data.agents || []).map((agent: { id: string; registered_at?: string }) => ({
        url: `${baseUrl}/registry/${agent.id}`,
        lastModified: agent.registered_at || now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));
    }
  } catch {
    // API unavailable — skip dynamic pages
  }

  // Discovery files (for AI crawlers)
  const discoveryPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/.well-known/openapi.json`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${baseUrl}/.well-known/mcp.json`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${baseUrl}/llms.txt`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
  ];

  return [...staticPages, ...agentPages, ...discoveryPages];
}
