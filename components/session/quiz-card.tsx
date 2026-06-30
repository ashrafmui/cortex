"use client";

import { useState } from "react";
import type { QuizResponse } from "@/lib/orchestrator/types";

export function QuizCard({ data }: { data: QuizResponse }) {
  const [hintsOpen, setHintsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-muted px-4 py-3 text-sm leading-relaxed max-w-[85%]">
      <p className="font-medium">{data.question}</p>
      {(data.hints ?? []).length > 0 && (
        <button
          onClick={() => setHintsOpen(!hintsOpen)}
          className="text-left text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          {hintsOpen ? "▾ Hide hints" : "▸ Show hints"}
        </button>
      )}
      {hintsOpen && (
        <ul className="list-disc pl-4 text-muted-foreground text-xs space-y-1">
          {(data.hints ?? []).map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
