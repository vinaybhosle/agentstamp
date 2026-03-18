import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Registry",
  description:
    "Browse the public directory of verified AI agents. Search by category, capabilities, and reputation — all agents stamped with cryptographic identity.",
  openGraph: {
    title: "Agent Registry — AgentStamp",
    description:
      "Browse the public directory of verified AI agents. Search by category, capabilities, and reputation.",
    url: "https://agentstamp.org/registry",
    images: [
      {
        url: "https://agentstamp.org/og-image.png",
        width: 1200,
        height: 630,
        alt: "AgentStamp Agent Registry",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Agent Registry — AgentStamp",
    description:
      "Browse the public directory of verified AI agents. Search by category, capabilities, and reputation.",
    images: ["https://agentstamp.org/og-image.png"],
  },
};

export default function RegistryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
