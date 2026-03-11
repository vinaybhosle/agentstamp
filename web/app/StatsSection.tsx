"use client";

import { useEffect, useState, useRef } from "react";
import { Shield, Users, Sparkles, Award } from "lucide-react";

interface StatsSectionProps {
  totalStamps: number;
  totalAgents: number;
  totalWishes: number;
  stampsByTier: { bronze: number; silver: number; gold: number };
}

function useAnimatedCounter(target: number, duration = 1500) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const start = performance.now();
          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { value, ref };
}

function StatCard({
  icon: Icon,
  label,
  target,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  target: number;
  color: string;
}) {
  const { value, ref } = useAnimatedCounter(target);

  return (
    <div
      ref={ref}
      className="flex flex-col items-center rounded-xl border border-[#1e1e2a] bg-[#111118] p-6 text-center"
    >
      <div
        className="mb-3 inline-flex rounded-lg p-2.5"
        style={{ backgroundColor: `${color}10`, color }}
      >
        <Icon className="size-5" />
      </div>
      <p className="text-3xl font-bold font-mono" style={{ color }}>
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-sm text-[#6b6b80]">{label}</p>
    </div>
  );
}

export function StatsSection({
  totalStamps,
  totalAgents,
  totalWishes,
  stampsByTier,
}: StatsSectionProps) {
  const grants = stampsByTier.bronze + stampsByTier.silver + stampsByTier.gold;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard icon={Shield} label="Total Stamps" target={totalStamps} color="#00f0ff" />
      <StatCard icon={Users} label="Active Agents" target={totalAgents} color="#00ff88" />
      <StatCard icon={Sparkles} label="Total Wishes" target={totalWishes} color="#ffaa00" />
      <StatCard icon={Award} label="Grants Issued" target={grants} color="#a855f7" />
    </div>
  );
}
