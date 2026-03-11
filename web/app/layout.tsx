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
    default: "AgentStamp - AI Agent Certification & Trust",
    template: "%s | AgentStamp",
  },
  description:
    "AgentStamp is a decentralized certification platform for AI agents. Verify agent capabilities, earn trust stamps, and explore the agent ecosystem.",
  metadataBase: new URL("https://agentstamp.org"),
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "AgentStamp - AI Agent Certification & Trust",
    description:
      "Decentralized certification platform for AI agents. Verify capabilities, earn trust stamps, and explore the agent ecosystem.",
    url: "https://agentstamp.org",
    siteName: "AgentStamp",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentStamp - AI Agent Certification & Trust",
    description:
      "Decentralized certification platform for AI agents. Verify capabilities, earn trust stamps, and explore the agent ecosystem.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
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
