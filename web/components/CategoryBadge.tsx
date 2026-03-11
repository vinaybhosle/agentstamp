import { cn } from "@/lib/utils";

interface CategoryBadgeProps {
  category: string;
  className?: string;
}

const categoryColors: Record<string, string> = {
  data: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  trading: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  research: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  creative: "text-pink-400 bg-pink-400/10 border-pink-400/20",
  infrastructure: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  other: "text-[#6b6b80] bg-[#6b6b80]/10 border-[#6b6b80]/20",
  capability: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  connection: "text-teal-400 bg-teal-400/10 border-teal-400/20",
  existential: "text-rose-400 bg-rose-400/10 border-rose-400/20",
};

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const colors =
    categoryColors[category.toLowerCase()] ?? categoryColors.other;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
        colors,
        className
      )}
    >
      {category}
    </span>
  );
}
