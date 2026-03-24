import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Outfit } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AgentStamp — Trust, Verified. One Line of Code.",
    template: "%s | AgentStamp",
  },
  description:
    "Identity certification for AI agents. Cryptographic trust scoring, public registry, EU AI Act compliance, W3C Verifiable Credentials, and 17 MCP tools. Free tier available.",
  metadataBase: new URL("https://agentstamp.org"),
  keywords: [
    "AI agent trust",
    "agent identity verification",
    "MCP trust tools",
    "agent reputation score",
    "ERC-8004",
    "AI agent registry",
    "cryptographic identity",
    "agent stamp",
    "x402 payments",
    "EU AI Act compliance",
    "W3C Verifiable Credentials",
    "agent trust scoring",
  ],
  authors: [{ name: "AgentStamp", url: "https://agentstamp.org" }],
  applicationName: "AgentStamp",
  icons: {
    icon: "/favicon.ico",
  },
  alternates: {
    canonical: "https://agentstamp.org",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "AgentStamp — Trust, Verified. One Line of Code.",
    description:
      "Identity certification for AI agents. Cryptographic trust scoring, public registry, 17 MCP tools. Free tier available.",
    url: "https://agentstamp.org",
    siteName: "AgentStamp",
    type: "website",
    images: [
      {
        url: "https://agentstamp.org/og-image.png",
        width: 1200,
        height: 630,
        alt: "AgentStamp — Identity certification for AI agents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentStamp — Trust, Verified. One Line of Code.",
    description:
      "Identity certification for AI agents. Cryptographic trust scoring, public registry, 17 MCP tools. Free tier available.",
    images: ["https://agentstamp.org/og-image.png"],
    creator: "@AgentStampHQ",
  },
  verification: {
    google: "PENDING_VERIFICATION_CODE",
  },
  other: {
    "application-name": "AgentStamp",
    subject: "AI Agent Trust & Identity Platform",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLdOrg = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AgentStamp",
    url: "https://agentstamp.org",
    logo: "https://agentstamp.org/og-image.png",
    description: "Trust Intelligence Platform for AI agents. Cryptographic identity, public registry, reputation scoring, and forensic audit trails.",
    foundingDate: "2026",
    sameAs: [
      "https://github.com/vinaybhosle/agentstamp",
      "https://dev.to/vinaybhosle",
      "https://glama.ai/mcp/servers/vinaybhosle/agentstamp",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      email: "vinay@agentstamp.org",
      contactType: "technical support",
    },
  };

  const jsonLdApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AgentStamp",
    url: "https://agentstamp.org",
    description: "AI Agent Identity & Trust Platform — cryptographic stamps, public registry, reputation scores (0-100), EU AI Act compliance, W3C Verifiable Credentials, and 17 MCP tools.",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    softwareVersion: "2.3.0",
    dateModified: "2026-03-25",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free tier — register your agent, get trust score, 17 MCP tools. Paid stamps from $0.001.",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "3",
      bestRating: "5",
    },
  };

  const jsonLdWebsite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AgentStamp",
    url: "https://agentstamp.org",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://agentstamp.org/registry?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify([jsonLdOrg, jsonLdApp, jsonLdWebsite]) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} font-sans antialiased`}
        style={{ backgroundColor: "#050508" }}
      >
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
