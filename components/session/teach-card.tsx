import type { TeachResponse } from "@/lib/orchestrator/types";

export function TeachCard({ data }: { data: TeachResponse }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-muted px-4 py-3 text-sm leading-relaxed max-w-[85%]">
      <p className="whitespace-pre-wrap">{data.explanation}</p>
      <div className="border-t pt-2 text-muted-foreground">
        <span className="font-medium text-foreground">Check: </span>
        {data.check_question}
      </div>
    </div>
  );
}
