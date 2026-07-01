import { cn } from "@/lib/utils";
import type { ReviewResponse } from "@/lib/orchestrator/types";

export function ReviewCard({ data, className }: { data: ReviewResponse; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-2xl bg-muted px-4 py-3 text-sm leading-relaxed max-w-[85%]", className)}>
      <p className="text-xs text-muted-foreground">{data.context_reminder}</p>
      <p>{data.question}</p>
    </div>
  );
}
