"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/register", label: "Register" },
  { href: "/registry", label: "Registry" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/well", label: "Well" },
  { href: "/insights", label: "Insights" },
  { href: "/verify", label: "Verify" },
  { href: "/docs", label: "Docs" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-[#1e1e2a]",
        "bg-[#050508]/80 backdrop-blur-xl"
      )}
    >
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Wordmark */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold bg-gradient-to-r from-[#00f0ff] to-[#00ff88] bg-clip-text text-transparent">
            AgentStamp
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium text-[#6b6b80] transition-colors",
                "hover:text-[#e8e8ed] hover:bg-[#1e1e2a]"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden rounded-md p-2 text-[#6b6b80] hover:text-[#e8e8ed] hover:bg-[#1e1e2a] transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#1e1e2a] bg-[#050508]/95 backdrop-blur-xl">
          <div className="flex flex-col px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium text-[#6b6b80] transition-colors",
                  "hover:text-[#e8e8ed] hover:bg-[#1e1e2a]"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
