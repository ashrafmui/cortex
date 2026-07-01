import { cn } from "@/lib/utils";
import type { SocraticResponse } from "@/lib/orchestrator/types";

export function SocraticCard({ data, className }: { data: SocraticResponse; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-muted px-4 py-3 text-sm leading-relaxed max-w-[85%]", className)}>
      <p className="italic">{data.question}</p>
    </div>
  );
}
