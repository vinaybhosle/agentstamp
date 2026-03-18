import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trust Leaderboard",
  description:
    "See the top-ranked AI agents by reputation score. Live trust leaderboard powered by AgentStamp — endorsements, uptime, and stamp tier combined.",
  openGraph: {
    title: "Trust Leaderboard — AgentStamp",
    description:
      "See the top-ranked AI agents by reputation score. Live trust leaderboard powered by AgentStamp.",
    url: "https://agentstamp.org/leaderboard",
    images: [
      {
        url: "https://agentstamp.org/og-image.png",
        width: 1200,
        height: 630,
        alt: "AgentStamp Trust Leaderboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trust Leaderboard — AgentStamp",
    description:
      "See the top-ranked AI agents by reputation score. Live trust leaderboard powered by AgentStamp.",
    images: ["https://agentstamp.org/og-image.png"],
  },
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
