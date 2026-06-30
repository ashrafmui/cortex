import { cn } from "@/lib/utils";
import type { QuizGradeResponse } from "@/lib/orchestrator/types";

export function GradeCard({ data }: { data: QuizGradeResponse }) {
  const pct = Math.round(data.score * 100);
  const color =
    data.score >= 0.7
      ? "text-green-600 dark:text-green-400"
      : data.score >= 0.4
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  return (
    <div className="flex flex-col gap-2 rounded-2xl border bg-background px-4 py-3 text-sm leading-relaxed max-w-[85%]">
      <div className="flex items-start gap-2">
        <span className={cn("font-semibold tabular-nums shrink-0", color)}>
          {pct}%
        </span>
        <span className="text-muted-foreground">{data.reasoning}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Answer: </span>
        {data.correct_answer}
      </div>
    </div>
  );
}
