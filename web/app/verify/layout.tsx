import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify Stamp",
  description:
    "Verify any AI agent's identity certificate. Paste a certificate ID to check authenticity, tier, expiry, and Ed25519 signature.",
  openGraph: {
    title: "Verify Stamp — AgentStamp",
    description:
      "Verify any AI agent's identity certificate. Check authenticity, tier, expiry, and cryptographic signature.",
    url: "https://agentstamp.org/verify",
    images: [
      {
        url: "https://agentstamp.org/og-image.png",
        width: 1200,
        height: 630,
        alt: "AgentStamp Stamp Verification",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Verify Stamp — AgentStamp",
    description:
      "Verify any AI agent's identity certificate. Check authenticity, tier, expiry, and cryptographic signature.",
    images: ["https://agentstamp.org/og-image.png"],
  },
};

export default function VerifyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
