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
    "Identity certification for AI agents. Public registry, trust verification & digital wishing well. x402 USDC on Base.",
  metadataBase: new URL("https://agentstamp.org"),
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "AgentStamp — Trust, Verified. One Line of Code.",
    description:
      "Identity certification for AI agents. Public registry, trust verification & digital wishing well. x402 USDC on Base.",
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
      "Identity certification for AI agents. Public registry, trust verification & digital wishing well. x402 USDC on Base.",
    images: ["https://agentstamp.org/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "AgentStamp",
    url: "https://agentstamp.org",
    description: "AI Agent Identity & Trust Platform — cryptographic stamps, public registry, reputation scores, and cross-protocol passports for AI agents.",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free tier available — register your agent in 60 seconds",
    },
  };

  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
