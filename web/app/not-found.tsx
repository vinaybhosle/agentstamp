import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-24 text-center">
      <h1 className="text-6xl font-bold bg-gradient-to-r from-[#00f0ff] to-[#00ff88] bg-clip-text text-transparent mb-4">
        404
      </h1>
      <p className="text-xl text-[#e8e8ed] mb-2">Page not found</p>
      <p className="text-sm text-[#6b6b80] mb-8">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-lg bg-[#00f0ff] px-6 py-3 text-sm font-semibold text-[#050508] transition-all hover:bg-[#00f0ff]/90"
      >
        <ArrowLeft className="size-4" />
        Back to Home
      </Link>
    </div>
  );
}
