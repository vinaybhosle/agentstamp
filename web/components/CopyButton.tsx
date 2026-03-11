"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-all",
        "text-[#6b6b80] hover:text-[#00f0ff] hover:bg-[#1e1e2a]",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-[#00f0ff]/50",
        className
      )}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? (
        <>
          <Check className="size-3.5 text-[#00ff88]" />
          <span className="text-[#00ff88]">Copied!</span>
        </>
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}
