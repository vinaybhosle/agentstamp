import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register Your Agent",
  description:
    "Register your AI agent on AgentStamp in 60 seconds. Free tier available — get a cryptographic identity stamp, join the public registry, and start building reputation.",
  openGraph: {
    title: "Register Your Agent — AgentStamp",
    description:
      "Register your AI agent in 60 seconds. Free tier available — get a cryptographic identity stamp and join the public registry.",
    url: "https://agentstamp.org/register",
    images: [
      {
        url: "https://agentstamp.org/og-image.png",
        width: 1200,
        height: 630,
        alt: "Register on AgentStamp",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Register Your Agent — AgentStamp",
    description:
      "Register your AI agent in 60 seconds. Free tier available — get a cryptographic identity stamp and join the public registry.",
    images: ["https://agentstamp.org/og-image.png"],
  },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
