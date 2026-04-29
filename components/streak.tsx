"use client";

import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

interface StreakProps {
  count: number;
  lastSevenDays: boolean[];
}

export default function Streak({ count, lastSevenDays }: StreakProps) {
  const isHot = count >= 7;

  return (
    <div className="flex items-center gap-4">
      {/* Streak count */}
      <div className="flex items-center gap-1.5">
        <Flame
          size={20}
          className={cn(
            count > 0
              ? isHot
                ? "fill-orange-400 text-orange-400 animate-pulse"
                : "fill-orange-300 text-orange-300"
              : "text-muted-foreground/40"
          )}
        />
        <span className="text-2xl font-semibold tabular-nums leading-none text-foreground">
          {count}
        </span>
        <span className="text-sm leading-none text-muted-foreground">
          day{count !== 1 && "s"}
        </span>
      </div>

      {/* Weekly dots */}
      <div className="flex items-center gap-1">
        {lastSevenDays.map((active, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div
              className={cn(
                "size-2 rounded-full transition-colors",
                active
                  ? isHot
                    ? "bg-orange-400"
                    : "bg-green-500"
                  : "bg-muted"
              )}
            />
            <span className="text-[9px] leading-none text-muted-foreground">
              {DAY_LABELS[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}